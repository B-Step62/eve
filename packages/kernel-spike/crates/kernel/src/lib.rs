//! An agent kernel with no I/O.
//!
//! The host calls [`advance`] with the saved state and new inputs. The kernel
//! returns the effects to run, commands for open effects, and events. The
//! kernel never reads the clock, the environment, the network, or the disk.
//!
//! Version 2 decides tool approval (`approval`) and compaction
//! (`compaction`), after eve. Calls of one response run together, a crashed
//! effect may run again, and a failed model call is tried 3 times, as in eve.
//! A steer stops generation, as in fx.

pub mod approval;
pub mod compaction;
pub mod types;

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use approval::Verdict;
use compaction::UsageMark;
pub use types::*;

const CANCELLED_TOOL: &str = "Cancelled by the user.";
const STEP_LIMIT_NOTICE: &str =
    "Agent step limit reached; continue with a follow-up prompt if needed.";
/// eve's `MODEL_CALL_MAX_ATTEMPTS`.
const MODEL_CALL_MAX_ATTEMPTS: u32 = 3;
/// eve's first backoff; it doubles. eve adds jitter, which needs randomness the kernel does not have.
const RETRY_BASE_MS: u64 = 500;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct State {
    pub v: u32,
    pub config: SessionConfig,
    pub history: Vec<Message>,
    pub turn: Option<Turn>,
    /// Prompts that arrived during a turn. They start the next turn.
    pub queued: Vec<Queued>,
    /// Input ids already applied, so a redelivered input is a no-op.
    pub seen: BTreeSet<String>,
    pub turns: u64,
    /// Tools a person approved this session (eve `once()`).
    pub approved_tools: BTreeSet<String>,
    pub usage: Option<UsageMark>,
    pub compactions: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Queued {
    pub id: String,
    pub text: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Turn {
    pub n: u64,
    pub step: u32,
    pub attempt: u32,
    pub phase: Phase,
    pub steers: Vec<Queued>,
    pub cancelling: bool,
    /// Compaction ran (or was skipped) for this step's model call.
    pub compacted: bool,
    /// A call needed a person and none can answer: the turn fails, as in eve and fx.
    #[serde(default)]
    pub unavailable: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "phase", rename_all = "snake_case")]
pub enum Phase {
    Model {
        key: String,
        steered: bool,
    },
    Compacting {
        key: String,
        record: Option<String>,
        keep_from: usize,
        summary: Option<String>,
    },
    Tools {
        calls: Vec<PendingCall>,
    },
    Waiting {
        key: String,
    },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct PendingCall {
    pub call_id: String,
    pub name: String,
    pub input: Value,
    pub approval: Approval,
    pub stage: Stage,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "stage", rename_all = "snake_case")]
pub enum Stage {
    Policy { key: String },
    Review { key: String },
    Ask { key: String },
    Run { key: String },
    Done { content: String, is_error: bool },
}

impl Stage {
    fn open_key(&self) -> Option<&str> {
        match self {
            Stage::Policy { key }
            | Stage::Review { key }
            | Stage::Ask { key }
            | Stage::Run { key } => Some(key),
            Stage::Done { .. } => None,
        }
    }
}

pub fn open(config: SessionConfig) -> State {
    State {
        v: STATE_VERSION,
        config,
        history: Vec::new(),
        turn: None,
        queued: Vec::new(),
        seen: BTreeSet::new(),
        turns: 0,
        approved_tools: BTreeSet::new(),
        usage: None,
        compactions: 0,
    }
}

/// Reads a saved state of this version.
pub fn migrate(state: Value) -> Result<State, String> {
    let v = state.get("v").and_then(Value::as_u64).unwrap_or(0);
    if v != u64::from(STATE_VERSION) {
        return Err(format!("unsupported kernel state version {v}"));
    }
    serde_json::from_value(state).map_err(|e| e.to_string())
}

pub fn advance(state: &mut State, inputs: Vec<Input>) -> Output {
    let mut out = Output {
        effects: Vec::new(),
        commands: Vec::new(),
        events: Vec::new(),
    };
    for input in inputs {
        state.apply(input, &mut out);
    }
    out
}

fn effect(key: String, effect: Effect) -> EffectRequest {
    EffectRequest {
        key,
        replay: Replay::Safe,
        after: Vec::new(),
        effect,
    }
}

impl State {
    pub fn is_idle(&self) -> bool {
        self.turn.is_none() && self.queued.is_empty()
    }

    fn tool_specs(&self) -> Vec<ToolSpec> {
        let spec = |t: &ToolDescriptor| ToolSpec {
            name: t.name.clone(),
            description: t.description.clone(),
            input_schema: None,
        };
        self.config.tools.iter().map(spec).collect()
    }

    /// The request before its history: the system prompt and the tool list.
    fn prefix_chars(&self) -> usize {
        self.config.system.len()
            + serde_json::to_string(&self.tool_specs())
                .map(|s| s.len())
                .unwrap_or(0)
    }

    fn turn_mut(&mut self) -> &mut Turn {
        self.turn.as_mut().expect("a turn")
    }

    fn first_time(&mut self, id: &str, out: &mut Output) -> bool {
        if self.seen.insert(id.to_string()) {
            true
        } else {
            out.events.push(Event::Ignored {
                reason: format!("duplicate input {id}"),
            });
            false
        }
    }

    fn apply(&mut self, input: Input, out: &mut Output) {
        match input {
            Input::Prompt { id, text } => {
                if !self.first_time(&id, out) {
                    return;
                }
                if self.turn.is_some() {
                    self.queued.push(Queued { id, text });
                } else {
                    self.start_turn(text, out);
                }
            }
            Input::Steer { id, text } => {
                if self.first_time(&id, out) {
                    self.steer(id, text, out);
                }
            }
            Input::Cancel { id } => {
                if self.first_time(&id, out) {
                    self.cancel(out);
                }
            }
            Input::EffectResult { key, result } => self.effect_result(key, result, out),
        }
    }

    // ---- turn ----------------------------------------------------------

    fn start_turn(&mut self, text: String, out: &mut Output) {
        self.turns += 1;
        self.history.push(Message::User { text });
        self.turn = Some(Turn {
            n: self.turns,
            step: 0,
            attempt: 0,
            phase: Phase::Waiting { key: String::new() },
            steers: Vec::new(),
            cancelling: false,
            compacted: false,
            unavailable: false,
        });
        out.events.push(Event::TurnStarted { turn: self.turns });
        self.request_model(out);
    }

    fn request_model(&mut self, out: &mut Output) {
        let limit = self.config.step_limit;
        if limit > 0 && self.turn_mut().step >= limit {
            self.end_turn(TurnEnd::StepLimit, Some(STEP_LIMIT_NOTICE.to_string()), out);
            return;
        }
        if !self.turn_mut().compacted
            && compaction::due(
                &self.config.compaction,
                self.prefix_chars(),
                &self.history,
                self.usage,
            )
        {
            if let Some(keep_from) = compaction::keep_from(&self.history, &self.config.compaction) {
                self.start_compaction(keep_from, out);
                return;
            }
        }
        let tools = self.tool_specs();
        let turn = self.turn.as_mut().expect("a turn");
        let key = format!("t{}.s{}.a{}.model", turn.n, turn.step, turn.attempt);
        turn.phase = Phase::Model {
            key: key.clone(),
            steered: false,
        };
        let request = ModelRequest {
            system: self.config.system.clone(),
            messages: self.history.clone(),
            tools,
        };
        out.effects.push(effect(
            key,
            Effect::ModelCall {
                purpose: ModelPurpose::Agent,
                model: None,
                request,
            },
        ));
    }

    fn steer(&mut self, id: String, text: String, out: &mut Output) {
        let Some(turn) = self.turn.as_mut() else {
            self.start_turn(text, out);
            return;
        };
        if turn.cancelling {
            out.events.push(Event::SteersReturned { ids: vec![id] });
            return;
        }
        let mut interrupted_generation = false;
        if let Phase::Model { key, steered } = &mut turn.phase {
            if !*steered {
                *steered = true;
                out.commands.push(Command::Cancel { key: key.clone() });
            }
            interrupted_generation = true;
        }
        turn.steers.push(Queued {
            id: id.clone(),
            text,
        });
        out.events.push(Event::Steered {
            id,
            interrupted_generation,
        });
    }

    fn cancel(&mut self, out: &mut Output) {
        let Some(turn) = self.turn.as_mut() else {
            out.events.push(Event::Ignored {
                reason: "cancel with no turn".into(),
            });
            return;
        };
        if turn.cancelling {
            return;
        }
        turn.cancelling = true;
        if !turn.steers.is_empty() {
            let ids = turn.steers.drain(..).map(|s| s.id).collect();
            out.events.push(Event::SteersReturned { ids });
        }
        match &turn.phase {
            Phase::Model { key, .. } | Phase::Waiting { key } | Phase::Compacting { key, .. } => {
                out.commands.push(Command::Cancel { key: key.clone() })
            }
            Phase::Tools { calls } => {
                for key in calls.iter().filter_map(|c| c.stage.open_key()) {
                    out.commands.push(Command::Cancel {
                        key: key.to_string(),
                    });
                }
            }
        }
    }

    fn effect_result(&mut self, key: String, result: EffectResult, out: &mut Output) {
        let Some(turn) = self.turn.as_ref() else {
            out.events.push(Event::Ignored {
                reason: format!("result for {key} with no turn"),
            });
            return;
        };
        match &turn.phase {
            Phase::Model { key: open, steered } if *open == key => {
                let steered = *steered;
                self.model_result(steered, result, out)
            }
            Phase::Compacting { key: open, .. } if *open == key => {
                self.compaction_result(result, out)
            }
            Phase::Compacting {
                record: Some(open), ..
            } if *open == key => self.record_result(out),
            Phase::Waiting { key: open } if *open == key => self.wait_result(out),
            Phase::Tools { calls } if calls.iter().any(|c| c.stage.open_key() == Some(&key)) => {
                self.call_result(key, result, out)
            }
            _ => out.events.push(Event::Ignored {
                reason: format!("stale result for {key}"),
            }),
        }
    }

    // ---- model ---------------------------------------------------------

    fn model_result(&mut self, steered: bool, result: EffectResult, out: &mut Output) {
        let cancelling = self.turn_mut().cancelling;
        match result {
            EffectResult::Completed { output } => {
                let parsed: ModelOutput = serde_json::from_value(output).unwrap_or_default();
                if let Some(tokens) = parsed.usage.and_then(|u| u.input_tokens) {
                    self.usage = Some(UsageMark {
                        input_tokens: tokens,
                        messages: self.history.len(),
                    });
                }
                if cancelling {
                    self.push_assistant(parsed.text, Vec::new(), false);
                    self.end_turn(TurnEnd::Cancelled, None, out);
                    return;
                }
                let n = self.turn_mut().n;
                self.turn_mut().attempt = 0;
                if parsed.tool_calls.is_empty() {
                    self.push_assistant(parsed.text.clone(), Vec::new(), false);
                    if self.take_steers() {
                        self.next_step(out);
                    } else {
                        out.events.push(Event::MessageCompleted {
                            turn: n,
                            text: parsed.text,
                        });
                        self.end_turn(TurnEnd::Completed, None, out);
                    }
                    return;
                }
                self.push_assistant(parsed.text, parsed.tool_calls.clone(), false);
                self.start_tools(n, parsed.tool_calls, out);
            }
            EffectResult::Interrupted { partial, .. } => {
                let text = partial
                    .get("text")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string();
                if !text.is_empty() {
                    self.push_assistant(text, Vec::new(), true);
                }
                if cancelling {
                    self.end_turn(TurnEnd::Cancelled, None, out);
                } else if steered && self.take_steers() {
                    self.next_step(out);
                } else {
                    self.turn_mut().attempt += 1;
                    self.request_model(out);
                }
            }
            EffectResult::Failed { error, retryable } => {
                if cancelling {
                    self.end_turn(TurnEnd::Cancelled, None, out);
                    return;
                }
                let turn = self.turn_mut();
                if !retryable || turn.attempt + 1 >= MODEL_CALL_MAX_ATTEMPTS {
                    self.end_turn(TurnEnd::Failed, Some(error), out);
                    return;
                }
                let delay_ms = RETRY_BASE_MS << turn.attempt;
                let key = format!("t{}.s{}.a{}.wait", turn.n, turn.step, turn.attempt);
                turn.phase = Phase::Waiting { key: key.clone() };
                out.events.push(Event::Retrying {
                    attempt: turn.attempt + 1,
                    delay_ms,
                });
                out.effects.push(effect(
                    key,
                    Effect::Wait {
                        ms: delay_ms,
                        reason: error,
                    },
                ));
            }
        }
    }

    fn wait_result(&mut self, out: &mut Output) {
        if self.turn_mut().cancelling {
            self.end_turn(TurnEnd::Cancelled, None, out);
            return;
        }
        self.turn_mut().attempt += 1;
        self.request_model(out);
    }

    // ---- compaction ----------------------------------------------------

    fn start_compaction(&mut self, keep_from: usize, out: &mut Output) {
        let request = compaction::request(&self.history[..keep_from]);
        let records = self.config.compaction.records;
        let n = self.compactions + 1;
        let turn = self.turn.as_mut().expect("a turn");
        let key = format!("t{}.s{}.compaction", turn.n, turn.step);
        let record = records.then(|| format!("{key}.record"));
        turn.phase = Phase::Compacting {
            key: key.clone(),
            record: record.clone(),
            keep_from,
            summary: None,
        };
        let estimated_tokens =
            compaction::estimate_tokens(self.prefix_chars(), &self.history, self.usage);
        out.events.push(Event::CompactionStarted {
            messages: keep_from,
            estimated_tokens,
        });
        out.effects.push(effect(
            key,
            Effect::ModelCall {
                purpose: ModelPurpose::Compaction,
                model: None,
                request,
            },
        ));
        if let Some(record) = record {
            let content = serde_json::to_string(&self.history[..keep_from]).unwrap_or_default();
            out.effects.push(effect(
                record,
                Effect::BlobPut {
                    name: format!("compaction-{n}.json"),
                    content,
                },
            ));
        }
    }

    fn compaction_result(&mut self, result: EffectResult, out: &mut Output) {
        let summary = match result {
            EffectResult::Completed { output } => serde_json::from_value::<ModelOutput>(output)
                .map(|o| o.text)
                .unwrap_or_default(),
            _ => String::new(),
        };
        let turn = self.turn_mut();
        if turn.cancelling {
            self.end_turn(TurnEnd::Cancelled, None, out);
            return;
        }
        if summary.trim().is_empty() {
            // A failed compaction keeps the history and makes the model call anyway.
            turn.compacted = true;
            self.request_model(out);
            return;
        }
        if let Phase::Compacting { summary: s, .. } = &mut turn.phase {
            *s = Some(summary);
        }
        self.maybe_finish_compaction(out);
    }

    fn record_result(&mut self, out: &mut Output) {
        if let Phase::Compacting { record, .. } = &mut self.turn_mut().phase {
            *record = None;
        }
        self.maybe_finish_compaction(out);
    }

    fn maybe_finish_compaction(&mut self, out: &mut Output) {
        let turn = self.turn_mut();
        let Phase::Compacting {
            record: None,
            keep_from,
            summary: Some(summary),
            ..
        } = &turn.phase
        else {
            return;
        };
        let (keep_from, summary) = (*keep_from, summary.clone());
        turn.compacted = true;
        let kept = self.history[keep_from..].to_vec();
        self.history = compaction::compacted(summary, &kept);
        self.usage = None;
        self.compactions += 1;
        out.events.push(Event::CompactionCompleted {
            removed: keep_from,
            kept: kept.len(),
        });
        self.request_model(out);
    }

    // ---- tools and approval -------------------------------------------

    fn start_tools(&mut self, n: u64, tool_calls: Vec<ToolCall>, out: &mut Output) {
        let mut calls = Vec::with_capacity(tool_calls.len());
        for call in tool_calls {
            let descriptor = self
                .config
                .tools
                .iter()
                .find(|t| t.name == call.name)
                .cloned();
            let mut pending = PendingCall {
                call_id: call.id.clone(),
                name: call.name.clone(),
                input: call.input,
                approval: descriptor.as_ref().map(|d| d.approval).unwrap_or_default(),
                stage: Stage::Done {
                    content: format!("Unknown tool: {}", call.name),
                    is_error: true,
                },
            };
            if descriptor.is_some() {
                pending.stage = if self.config.host_policy {
                    self.policy(n, &pending, out)
                } else {
                    self.by_tool_policy(n, &pending, out)
                };
            }
            calls.push(pending);
        }
        self.turn_mut().phase = Phase::Tools { calls };
        self.maybe_finish_tools(out);
    }

    fn policy(&self, n: u64, call: &PendingCall, out: &mut Output) -> Stage {
        let key = format!("t{n}.tool.{}.policy", call.call_id);
        out.effects.push(effect(
            key.clone(),
            Effect::PolicyDecide {
                call_id: call.call_id.clone(),
                name: call.name.clone(),
                input: call.input.clone(),
            },
        ));
        Stage::Policy { key }
    }

    /// The stage a call goes to under its tool's own policy.
    fn by_tool_policy(&self, n: u64, call: &PendingCall, out: &mut Output) -> Stage {
        match call.approval {
            Approval::Never => self.run(n, call, out),
            Approval::Always => self.ask(n, call, "This tool asks for approval every time.", out),
            Approval::Once if self.approved_tools.contains(&call.name) => self.run(n, call, out),
            Approval::Once => self.ask(
                n,
                call,
                "This tool asks for approval once each session.",
                out,
            ),
            Approval::Auto => self.review(n, call, out),
            Approval::Host => self.policy(n, call, out),
        }
    }

    fn run(&self, n: u64, call: &PendingCall, out: &mut Output) -> Stage {
        let key = format!("t{n}.tool.{}", call.call_id);
        out.effects.push(effect(
            key.clone(),
            Effect::ToolCall {
                call_id: call.call_id.clone(),
                name: call.name.clone(),
                input: call.input.clone(),
            },
        ));
        Stage::Run { key }
    }

    fn ask(&self, n: u64, call: &PendingCall, reason: &str, out: &mut Output) -> Stage {
        let key = format!("t{n}.tool.{}.ask", call.call_id);
        out.events.push(Event::ApprovalRequested {
            call_id: call.call_id.clone(),
            name: call.name.clone(),
            reason: reason.to_string(),
        });
        out.effects.push(effect(
            key.clone(),
            Effect::UserAsk {
                request: AskRequest::Approval {
                    call_id: call.call_id.clone(),
                    name: call.name.clone(),
                    input: call.input.clone(),
                    reason: reason.to_string(),
                },
            },
        ));
        Stage::Ask { key }
    }

    fn review(&self, n: u64, call: &PendingCall, out: &mut Output) -> Stage {
        if approval::too_large_to_review(&call.input) {
            return self.cautioned(n, call, out);
        }
        let key = format!("t{n}.tool.{}.review", call.call_id);
        let request = approval::review_request(
            &call.name,
            &call.input,
            self.config.review.instructions.as_deref(),
        );
        out.effects.push(effect(
            key.clone(),
            Effect::ModelCall {
                purpose: ModelPurpose::PermissionReview,
                model: self.config.review.model.clone(),
                request,
            },
        ));
        Stage::Review { key }
    }

    fn cautioned(&self, n: u64, call: &PendingCall, out: &mut Output) -> Stage {
        match self.config.caution {
            Caution::Ask => self.ask(n, call, "The safety review returned caution.", out),
            Caution::Hold => {
                out.events.push(Event::ToolHeld {
                    call_id: call.call_id.clone(),
                    name: call.name.clone(),
                });
                Stage::Done {
                    content: approval::HELD.into(),
                    is_error: true,
                }
            }
        }
    }

    fn call_result(&mut self, key: String, result: EffectResult, out: &mut Output) {
        let turn = self.turn.as_ref().expect("a turn");
        let n = turn.n;
        let cancelling = turn.cancelling;
        let Phase::Tools { calls } = &turn.phase else {
            return;
        };
        let index = calls
            .iter()
            .position(|c| c.stage.open_key() == Some(&key))
            .expect("a call");
        let call = calls[index].clone();
        let next = if cancelling && !matches!(call.stage, Stage::Run { .. }) {
            Stage::Done {
                content: CANCELLED_TOOL.into(),
                is_error: true,
            }
        } else {
            match (&call.stage, result) {
                (Stage::Policy { .. }, result) => self.after_policy(n, &call, result, out),
                (Stage::Review { .. }, EffectResult::Completed { output }) => {
                    let parsed: ModelOutput = serde_json::from_value(output).unwrap_or_default();
                    match approval::verdict(&parsed) {
                        Verdict::Clear => self.run(n, &call, out),
                        Verdict::Caution => self.cautioned(n, &call, out),
                    }
                }
                (Stage::Review { .. }, _) => self.cautioned(n, &call, out),
                (Stage::Ask { .. }, result) => self.after_ask(n, &call, result, out),
                (Stage::Run { .. }, result) => {
                    let (content, is_error) = match result {
                        EffectResult::Completed { output } => (value_text(output), false),
                        EffectResult::Failed { error, .. } => (format!("Error: {error}"), true),
                        EffectResult::Interrupted { .. } => (CANCELLED_TOOL.into(), true),
                    };
                    out.events.push(Event::ToolFinished {
                        call_id: call.call_id.clone(),
                        name: call.name.clone(),
                        is_error,
                    });
                    Stage::Done { content, is_error }
                }
                (Stage::Done { .. }, _) => unreachable!("a done call has no open key"),
            }
        };
        if let Phase::Tools { calls } = &mut self.turn_mut().phase {
            calls[index].stage = next;
        }
        self.maybe_finish_tools(out);
    }

    fn after_policy(
        &mut self,
        n: u64,
        call: &PendingCall,
        result: EffectResult,
        out: &mut Output,
    ) -> Stage {
        let EffectResult::Completed { output } = result else {
            return Stage::Done {
                content: "Error: the session policy could not decide.".into(),
                is_error: true,
            };
        };
        let reason = output
            .get("reason")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        match output
            .get("decision")
            .and_then(Value::as_str)
            .unwrap_or("default")
        {
            "allow" => self.run(n, call, out),
            "deny" => Stage::Done {
                content: format!("Denied by the session policy. {reason}")
                    .trim()
                    .into(),
                is_error: true,
            },
            "ask" => self.ask(
                n,
                call,
                if reason.is_empty() {
                    "The session policy asks for approval."
                } else {
                    &reason
                },
                out,
            ),
            "review" => self.review(n, call, out),
            _ if call.approval == Approval::Host => {
                self.ask(n, call, "The tool's policy did not decide.", out)
            }
            _ => self.by_tool_policy(n, call, out),
        }
    }

    fn after_ask(
        &mut self,
        n: u64,
        call: &PendingCall,
        result: EffectResult,
        out: &mut Output,
    ) -> Stage {
        match result {
            EffectResult::Completed { output }
                if output.get("approved").and_then(Value::as_bool) == Some(true) =>
            {
                out.events.push(Event::ApprovalResolved {
                    call_id: call.call_id.clone(),
                    approved: true,
                });
                if call.approval == Approval::Once {
                    self.approved_tools.insert(call.name.clone());
                }
                self.run(n, call, out)
            }
            EffectResult::Completed { output } => {
                out.events.push(Event::ApprovalResolved {
                    call_id: call.call_id.clone(),
                    approved: false,
                });
                let reason = output.get("reason").and_then(Value::as_str).unwrap_or("");
                Stage::Done {
                    content: format!("{} {reason}", approval::DENIED).trim().into(),
                    is_error: true,
                }
            }
            EffectResult::Failed { .. } => {
                self.stop_for_no_person(&call.call_id, out);
                Stage::Done {
                    content: approval::NO_PERSON.into(),
                    is_error: true,
                }
            }
            EffectResult::Interrupted { .. } => Stage::Done {
                content: CANCELLED_TOOL.into(),
                is_error: true,
            },
        }
    }

    /// Stops the other calls of the response; the turn fails once they settle.
    fn stop_for_no_person(&mut self, call_id: &str, out: &mut Output) {
        let turn = self.turn_mut();
        turn.unavailable = true;
        turn.cancelling = true;
        if let Phase::Tools { calls } = &turn.phase {
            for c in calls.iter().filter(|c| c.call_id != call_id) {
                if let Some(key) = c.stage.open_key() {
                    out.commands.push(Command::Cancel {
                        key: key.to_string(),
                    });
                }
            }
        }
    }

    fn maybe_finish_tools(&mut self, out: &mut Output) {
        let turn = self.turn_mut();
        let Phase::Tools { calls } = &turn.phase else {
            return;
        };
        if calls.iter().any(|c| c.stage.open_key().is_some()) {
            return;
        }
        let (cancelling, unavailable) = (turn.cancelling, turn.unavailable);
        let messages: Vec<Message> = calls
            .iter()
            .map(|c| {
                let Stage::Done { content, is_error } = &c.stage else {
                    unreachable!()
                };
                Message::Tool {
                    call_id: c.call_id.clone(),
                    name: c.name.clone(),
                    content: content.clone(),
                    is_error: *is_error,
                }
            })
            .collect();
        self.history.extend(messages);
        if unavailable {
            self.end_turn(TurnEnd::Failed, Some(approval::NO_PERSON.into()), out);
            return;
        }
        if cancelling {
            self.end_turn(TurnEnd::Cancelled, None, out);
            return;
        }
        self.take_steers();
        self.next_step(out);
    }

    // ---- shared --------------------------------------------------------

    fn next_step(&mut self, out: &mut Output) {
        let turn = self.turn_mut();
        turn.step += 1;
        turn.attempt = 0;
        turn.compacted = false;
        self.request_model(out);
    }

    /// Moves pending steers into the history. Returns whether there were any.
    fn take_steers(&mut self) -> bool {
        let turn = self.turn_mut();
        if turn.steers.is_empty() {
            return false;
        }
        let steers: Vec<Queued> = turn.steers.drain(..).collect();
        for s in steers {
            self.history.push(Message::Steering { text: s.text });
        }
        true
    }

    fn push_assistant(&mut self, text: String, tool_calls: Vec<ToolCall>, partial: bool) {
        if text.is_empty() && tool_calls.is_empty() {
            return;
        }
        self.history.push(Message::Assistant {
            text,
            tool_calls,
            partial,
        });
    }

    fn end_turn(&mut self, reason: TurnEnd, notice: Option<String>, out: &mut Output) {
        let turn = self.turn.take().expect("a turn");
        out.events.push(Event::TurnEnded {
            turn: turn.n,
            reason,
            notice,
        });
        if !self.queued.is_empty() {
            let text = self
                .queued
                .drain(..)
                .map(|q| q.text)
                .collect::<Vec<_>>()
                .join("\n\n");
            self.start_turn(text, out);
        }
    }
}

fn value_text(v: Value) -> String {
    match v {
        Value::String(s) => s,
        other => other.to_string(),
    }
}

/// JSON-in, JSON-out form for bindings.
pub mod json {
    use super::*;

    pub fn open(config: &str) -> Result<String, String> {
        let config: SessionConfig = serde_json::from_str(config).map_err(|e| e.to_string())?;
        serde_json::to_string(&super::open(config)).map_err(|e| e.to_string())
    }

    #[derive(Serialize)]
    struct Advanced<'a> {
        state: &'a State,
        #[serde(flatten)]
        output: Output,
    }

    /// `{ state, effects, commands, events }`.
    pub fn advance(state: &str, inputs: &str) -> Result<String, String> {
        let value: Value = serde_json::from_str(state).map_err(|e| e.to_string())?;
        let mut state = migrate(value)?;
        let inputs: Vec<Input> = serde_json::from_str(inputs).map_err(|e| e.to_string())?;
        let output = super::advance(&mut state, inputs);
        serde_json::to_string(&Advanced {
            state: &state,
            output,
        })
        .map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests;
