//! fx-mini: the fx CLI case on the in-process runner.
//!
//!   fx-mini --scenarios <json> --scenario <name> --workspace <dir> [--no-save] [--resume]
//!
//! Prints one JSON object per line: kernel events, commands, and the final
//! state. A crash scenario calls `abort()` after the side effect, so the
//! process really dies; run again with `--resume` to recover from the log.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use kernel::{
    Effect, EffectRequest, EffectResult, Input, InterruptReason, Message, ModelPurpose,
    SessionConfig,
};
use runner::{Handlers, HostCtx, JsonlStore, MemoryStore, Msg, NoStore, Runner, Store};
use serde_json::{json, Value};

struct Mini {
    ws: PathBuf,
    scenario: Value,
    trace: Mutex<()>,
    steered: AtomicBool,
    cancelled: AtomicBool,
}

impl Mini {
    fn trace(&self, line: Value) {
        let _guard = self.trace.lock().unwrap();
        let mut f = OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.ws.join(".trace.jsonl"))
            .unwrap();
        writeln!(f, "{line}").unwrap();
    }

    fn trace_count(&self, pred: impl Fn(&Value) -> bool) -> usize {
        let _guard = self.trace.lock().unwrap();
        fs::read_to_string(self.ws.join(".trace.jsonl"))
            .unwrap_or_default()
            .lines()
            .filter_map(|l| serde_json::from_str::<Value>(l).ok())
            .filter(|v| pred(v))
            .count()
    }

    fn sleep_or_cancel(&self, ms: u64, ctx: &HostCtx) -> bool {
        let mut left = ms;
        while left > 0 {
            if ctx.cancelled() {
                return true;
            }
            let step = left.min(10);
            std::thread::sleep(Duration::from_millis(step));
            left -= step;
        }
        ctx.cancelled()
    }

    fn model(&self, messages: &[Message], ctx: &HostCtx) -> EffectResult {
        let index = messages
            .iter()
            .filter(|m| matches!(m, Message::Assistant { .. }))
            .count();
        self.trace(json!({ "kind": "model_call", "index": index }));
        let crash = &self.scenario["crash"];
        if crash["at"] == "model" && crash["index"] == index {
            let calls = self.trace_count(|v| v["kind"] == "model_call" && v["index"] == index);
            if calls == 1 {
                std::process::abort();
            }
        }
        let step = &self.scenario["script"][index];
        let text = step["text"].as_str().unwrap_or("").to_string();
        let chunks = step["chunks"].as_u64().unwrap_or(1).max(1) as usize;
        let chunk_ms = step["chunk_ms"].as_u64().unwrap_or(0);
        let chars: Vec<char> = text.chars().collect();
        let size = chars.len().div_ceil(chunks).max(1);
        let mut emitted = String::new();
        for (n, piece) in chars.chunks(size).enumerate() {
            if self.sleep_or_cancel(chunk_ms, ctx) {
                return EffectResult::Interrupted {
                    reason: InterruptReason::Cancelled,
                    partial: json!({ "text": emitted }),
                };
            }
            emitted.extend(piece);
            let steer = &self.scenario["steer"];
            if steer["after_chunks"] == n + 1 && !self.steered.swap(true, Ordering::SeqCst) {
                let text = steer["text"].as_str().unwrap_or("").to_string();
                let _ = ctx.inputs.send(Msg::Input(Input::Steer {
                    id: "steer-1".into(),
                    text,
                }));
            }
        }
        EffectResult::Completed {
            output: json!({ "text": text, "tool_calls": step["tool_calls"].as_array().cloned().unwrap_or_default() }),
        }
    }

    fn tool(&self, call_id: &str, name: &str, input: &Value, ctx: &HostCtx) -> EffectResult {
        self.trace(json!({ "kind": "tool_start", "id": call_id, "name": name }));
        if self.scenario["cancel"]["after_tool_start"] == name
            && !self.cancelled.swap(true, Ordering::SeqCst)
        {
            let _ = ctx.inputs.send(Msg::Input(Input::Cancel {
                id: "cancel-1".into(),
            }));
        }
        let path = self.ws.join(input["path"].as_str().unwrap_or(""));
        let result = match name {
            "read_file" => {
                if self.sleep_or_cancel(input["delay_ms"].as_u64().unwrap_or(0), ctx) {
                    return EffectResult::Interrupted {
                        reason: InterruptReason::Cancelled,
                        partial: Value::Null,
                    };
                }
                match fs::read_to_string(&path) {
                    Ok(s) => EffectResult::Completed { output: json!(s) },
                    Err(e) => EffectResult::Failed {
                        error: e.to_string(),
                        retryable: false,
                    },
                }
            }
            "write_file" => {
                let mut f = OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&path)
                    .unwrap();
                f.write_all(input["content"].as_str().unwrap_or("").as_bytes())
                    .unwrap();
                f.sync_data().unwrap();
                self.trace(json!({ "kind": "side_effect", "id": call_id }));
                let crash = &self.scenario["crash"];
                let first =
                    self.trace_count(|v| v["kind"] == "side_effect" && v["id"] == call_id) == 1;
                if crash["at"] == "tool" && crash["name"] == name && first {
                    std::process::abort();
                }
                EffectResult::Completed {
                    output: json!("ok"),
                }
            }
            other => EffectResult::Failed {
                error: format!("no tool {other}"),
                retryable: false,
            },
        };
        self.trace(json!({ "kind": "tool_end", "id": call_id, "name": name }));
        result
    }
}

impl Handlers for Mini {
    fn run(&self, request: &EffectRequest, ctx: &HostCtx) -> EffectResult {
        match &request.effect {
            Effect::ModelCall {
                purpose: ModelPurpose::Agent,
                request,
                ..
            } => self.model(&request.messages, ctx),
            // A scripted review clears unless the scenario says otherwise; a scripted summary is fixed text.
            Effect::ModelCall {
                purpose: ModelPurpose::PermissionReview,
                ..
            } => {
                let decision = self.scenario["review"].as_str().unwrap_or("clear");
                EffectResult::Completed {
                    output: json!({ "tool_calls": [{ "id": "review", "name": "permission_decision", "input": { "decision": decision } }] }),
                }
            }
            Effect::ModelCall {
                purpose: ModelPurpose::Compaction,
                ..
            } => EffectResult::Completed {
                output: json!({ "text": "Summary of earlier work." }),
            },
            // fx-mini has no session policy and no person to ask, unless the scenario scripts an answer.
            Effect::PolicyDecide { .. } => EffectResult::Completed {
                output: json!({ "decision": "default" }),
            },
            Effect::UserAsk { .. } => match self.scenario["approve"].as_bool() {
                Some(approved) => EffectResult::Completed {
                    output: json!({ "approved": approved }),
                },
                None => EffectResult::Failed {
                    error: "no person is available".into(),
                    retryable: false,
                },
            },
            Effect::BlobPut { name, content } => {
                let dir = self.ws.join(".blobs");
                fs::create_dir_all(&dir).unwrap();
                fs::write(dir.join(name), content).unwrap();
                EffectResult::Completed {
                    output: Value::Null,
                }
            }
            Effect::ToolCall {
                call_id,
                name,
                input,
            } => self.tool(call_id, name, input, ctx),
            Effect::Wait { ms, .. } => {
                if self.sleep_or_cancel(*ms, ctx) {
                    EffectResult::Interrupted {
                        reason: InterruptReason::Cancelled,
                        partial: Value::Null,
                    }
                } else {
                    EffectResult::Completed {
                        output: Value::Null,
                    }
                }
            }
        }
    }
}

fn arg(args: &[String], name: &str) -> Option<String> {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1).cloned())
}

fn say(v: Value) {
    let mut out = std::io::stdout().lock();
    writeln!(out, "{v}").unwrap();
    out.flush().unwrap();
}

fn drive<S: Store>(config: SessionConfig, store: S, mini: Arc<Mini>, prompt: Option<String>) {
    let mut runner = Runner::open(config, store, mini).expect("open session");
    runner.on_event(|e| say(json!({ "event": e })));
    runner.on_command(|c| say(json!({ "command": c })));
    let inputs = prompt
        .map(|text| {
            vec![Input::Prompt {
                id: "prompt-1".into(),
                text,
            }]
        })
        .unwrap_or_default();
    runner.run(inputs).expect("run");
    say(json!({ "final_state": runner.state() }));
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--version") {
        println!("fx-mini 0.0.0");
        return;
    }
    let file: Value = serde_json::from_str(
        &fs::read_to_string(arg(&args, "--scenarios").expect("--scenarios")).unwrap(),
    )
    .unwrap();
    let name = arg(&args, "--scenario").expect("--scenario");
    let ws = PathBuf::from(arg(&args, "--workspace").expect("--workspace"));
    let scenario = file["scenarios"][&name].clone();
    let config: SessionConfig = serde_json::from_value(file["config"].clone()).unwrap();
    let resume = args.iter().any(|a| a == "--resume");
    if !resume {
        fs::create_dir_all(&ws).unwrap();
        for (path, content) in scenario["files"].as_object().cloned().unwrap_or_default() {
            fs::write(ws.join(path), content.as_str().unwrap()).unwrap();
        }
    }
    let prompt = (!resume).then(|| scenario["prompt"].as_str().unwrap().to_string());
    let mini = Arc::new(Mini {
        ws: ws.clone(),
        scenario,
        trace: Mutex::new(()),
        steered: AtomicBool::new(resume),
        cancelled: AtomicBool::new(resume),
    });
    let session = ws.join(".session.jsonl");
    if args.iter().any(|a| a == "--no-save") {
        drive(config, NoStore, mini, prompt);
    } else if args.iter().any(|a| a == "--memory") {
        drive(config, MemoryStore::default(), mini, prompt);
    } else {
        drive(config, JsonlStore::new(&session), mini, prompt);
    }
    let _ = Path::new(&session);
}
