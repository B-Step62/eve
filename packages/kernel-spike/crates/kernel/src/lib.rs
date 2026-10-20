//! A toy agent kernel with no I/O.
//!
//! The host calls [`advance`] with the saved state and new inputs. The kernel
//! returns the effects to run, commands for open effects, and events. The
//! kernel never reads the clock, the environment, the network, or the disk.

pub mod ordering;
pub mod recovery;
pub mod types;

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use recovery::{AttemptState, Evidence, OutputEvidence, RetryPacingState, Strategy, ToolEvidence};
pub use types::*;

const INTERRUPTED_TOOL: &str = "This tool call was interrupted before its result was recorded. \
It may or may not have taken effect. Check the current state before you try it again.";
const CANCELLED_TOOL: &str = "Cancelled by the user.";
const STEP_LIMIT_NOTICE: &str =
    "Agent step limit reached; continue with a follow-up prompt if needed.";

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
    pub consumed_attempts: usize,
    pub pacing: RetryPacingState,
    pub phase: Phase,
    pub steers: Vec<Queued>,
    pub cancelling: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "phase", rename_all = "snake_case")]
pub enum Phase {
    Model { key: String, steered: bool },
    Tools { calls: Vec<PendingCall> },
    Waiting { key: String },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct PendingCall {
    pub call_id: String,
    pub name: String,
    pub key: Option<String>,
    pub result: Option<(String, bool)>,
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
    }
}

/// Upgrades an older state. Version 1 is the only version.
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

impl State {
    pub fn is_idle(&self) -> bool {
        self.turn.is_none() && self.queued.is_empty()
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
                if !self.first_time(&id, out) {
                    return;
                }
                self.steer(id, text, out);
            }
            Input::Cancel { id } => {
                if !self.first_time(&id, out) {
                    return;
                }
                self.cancel(out);
            }
            Input::EffectResult { key, result } => self.effect_result(key, result, out),
        }
    }

    fn start_turn(&mut self, text: String, out: &mut Output) {
        self.turns += 1;
        self.history.push(Message::User { text });
        self.turn = Some(Turn {
            n: self.turns,
            step: 0,
            attempt: 0,
            consumed_attempts: 0,
            pacing: RetryPacingState::Idle,
            phase: Phase::Waiting { key: String::new() },
            steers: Vec::new(),
            cancelling: false,
        });
        out.events.push(Event::TurnStarted { turn: self.turns });
        self.request_model(out);
    }

    fn request_model(&mut self, out: &mut Output) {
        let limit = self.config.step_limit;
        let turn = self.turn.as_mut().expect("a turn");
        if limit > 0 && turn.step >= limit {
            self.end_turn(TurnEnd::StepLimit, Some(STEP_LIMIT_NOTICE.to_string()), out);
            return;
        }
        let key = format!("t{}.s{}.a{}.model", turn.n, turn.step, turn.attempt);
        turn.phase = Phase::Model {
            key: key.clone(),
            steered: false,
        };
        let request = ModelRequest {
            system: self.config.system.clone(),
            messages: self.history.clone(),
            tools: self
                .config
                .tools
                .iter()
                .map(|t| ToolSpec {
                    name: t.name.clone(),
                    description: t.description.clone(),
                })
                .collect(),
        };
        out.effects.push(EffectRequest {
            key,
            replay: Replay::Safe,
            after: Vec::new(),
            effect: Effect::ModelCall {
                purpose: ModelPurpose::Agent,
                request,
            },
        });
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
            Phase::Model { key, .. } | Phase::Waiting { key } => {
                out.commands.push(Command::Cancel { key: key.clone() })
            }
            Phase::Tools { calls } => {
                for call in calls {
                    if let (Some(key), None) = (&call.key, &call.result) {
                        out.commands.push(Command::Cancel { key: key.clone() });
                    }
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
            Phase::Waiting { key: open } if *open == key => self.wait_result(out),
            Phase::Tools { calls } if calls.iter().any(|c| c.key.as_deref() == Some(&key)) => {
                self.tool_result(key, result, out)
            }
            _ => out.events.push(Event::Ignored {
                reason: format!("stale result for {key}"),
            }),
        }
    }

    fn model_result(&mut self, steered: bool, result: EffectResult, out: &mut Output) {
        let cancelling = self.turn.as_ref().is_some_and(|t| t.cancelling);
        match result {
            EffectResult::Completed { output } => {
                let parsed: ModelOutput = serde_json::from_value(output).unwrap_or_default();
                if cancelling {
                    self.push_assistant(parsed.text, Vec::new(), false);
                    self.end_turn(TurnEnd::Cancelled, None, out);
                    return;
                }
                let turn = self.turn.as_mut().expect("a turn");
                turn.consumed_attempts = 0;
                turn.pacing = RetryPacingState::Idle;
                let n = turn.n;
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
                    // A model call is `safe`; an interruption without a cancel is retried.
                    self.turn.as_mut().expect("a turn").attempt += 1;
                    self.request_model(out);
                }
            }
            EffectResult::Failed { error, evidence } => {
                if cancelling {
                    self.end_turn(TurnEnd::Cancelled, None, out);
                    return;
                }
                self.recover(error, evidence, out);
            }
        }
    }

    fn recover(&mut self, error: String, evidence: Option<ModelFailureEvidence>, out: &mut Output) {
        let turn = self.turn.as_mut().expect("a turn");
        let ev = evidence.unwrap_or(ModelFailureEvidence {
            cause: recovery::FailureCause::ProviderUnavailable,
            delivery: recovery::Delivery::PossiblySent,
            streamed_bytes: 0,
            progress: recovery::Progress::Unknown,
            retry_after_seconds: None,
            recovery_elapsed_ns: None,
        });
        let decision = recovery::decide(Evidence {
            cause: ev.cause,
            delivery: ev.delivery,
            attempts: AttemptState::consumed(turn.consumed_attempts),
            output: if ev.streamed_bytes > 0 {
                OutputEvidence::Partial
            } else {
                OutputEvidence::None
            },
            tool: ToolEvidence::None,
            pacing: turn.pacing,
            retry_after_seconds: ev.retry_after_seconds,
            cancelled: turn.cancelling,
            progress: ev.progress,
            recovery_elapsed_ns: ev.recovery_elapsed_ns,
        });
        if decision.reserve_provider_attempt {
            turn.consumed_attempts += 1;
        }
        turn.pacing = decision.next_pacing;
        let delay_ms = decision.delay_ns / 1_000_000;
        out.events.push(Event::Recovery {
            strategy: format!("{:?}", decision.strategy),
            delay_ms,
            required_action: format!("{:?}", decision.required_action),
        });
        if matches!(decision.strategy, Strategy::Stop | Strategy::Pause) {
            let notice = format!("{error} ({:?})", decision.required_action);
            self.end_turn(TurnEnd::Failed, Some(notice), out);
            return;
        }
        if delay_ms == 0 {
            turn.attempt += 1;
            self.request_model(out);
            return;
        }
        let key = format!("t{}.s{}.a{}.wait", turn.n, turn.step, turn.attempt);
        turn.phase = Phase::Waiting { key: key.clone() };
        out.effects.push(EffectRequest {
            key,
            replay: Replay::Safe,
            after: Vec::new(),
            effect: Effect::Wait {
                ms: delay_ms,
                reason: format!("{:?}", decision.strategy),
            },
        });
    }

    fn wait_result(&mut self, out: &mut Output) {
        let turn = self.turn.as_mut().expect("a turn");
        if turn.cancelling {
            self.end_turn(TurnEnd::Cancelled, None, out);
            return;
        }
        turn.attempt += 1;
        self.request_model(out);
    }

    fn start_tools(&mut self, n: u64, tool_calls: Vec<ToolCall>, out: &mut Output) {
        let descriptors: Vec<Option<ToolDescriptor>> = tool_calls
            .iter()
            .map(|c| self.config.tools.iter().find(|t| t.name == c.name).cloned())
            .collect();
        let read_only: Vec<bool> = descriptors
            .iter()
            .map(|d| d.as_ref().is_some_and(|d| d.read_only))
            .collect();
        let order = ordering::order(&read_only);
        let mut calls = Vec::with_capacity(tool_calls.len());
        for (i, call) in tool_calls.into_iter().enumerate() {
            match &descriptors[i] {
                Some(d) => {
                    let key = format!("t{n}.tool.{}", call.id);
                    calls.push(PendingCall {
                        call_id: call.id.clone(),
                        name: call.name.clone(),
                        key: Some(key.clone()),
                        result: None,
                    });
                    out.effects.push(EffectRequest {
                        key,
                        replay: d.replay,
                        after: Vec::new(),
                        effect: Effect::ToolCall {
                            call_id: call.id,
                            name: call.name,
                            input: call.input,
                        },
                    });
                }
                None => calls.push(PendingCall {
                    call_id: call.id,
                    name: call.name.clone(),
                    key: None,
                    result: Some((format!("Unknown tool: {}", call.name), true)),
                }),
            }
        }
        // Fill `after` now that every call has its key.
        let first = out.effects.len() - calls.iter().filter(|c| c.key.is_some()).count();
        let mut e = first;
        for (i, call) in calls.iter().enumerate() {
            if call.key.is_none() {
                continue;
            }
            out.effects[e].after = order[i]
                .iter()
                .filter_map(|&j| calls[j].key.clone())
                .collect();
            e += 1;
        }
        self.turn.as_mut().expect("a turn").phase = Phase::Tools { calls };
        self.maybe_finish_tools(out);
    }

    fn tool_result(&mut self, key: String, result: EffectResult, out: &mut Output) {
        let turn = self.turn.as_mut().expect("a turn");
        let Phase::Tools { calls } = &mut turn.phase else {
            return;
        };
        let call = calls
            .iter_mut()
            .find(|c| c.key.as_deref() == Some(&key))
            .expect("a call");
        if call.result.is_some() {
            out.events.push(Event::Ignored {
                reason: format!("second result for {key}"),
            });
            return;
        }
        let (content, is_error) = match result {
            EffectResult::Completed { output } => (value_text(output), false),
            EffectResult::Failed { error, .. } => (format!("Error: {error}"), true),
            EffectResult::Interrupted {
                reason: InterruptReason::Crashed,
                ..
            } => (INTERRUPTED_TOOL.into(), true),
            EffectResult::Interrupted {
                reason: InterruptReason::Cancelled,
                ..
            } => (CANCELLED_TOOL.into(), true),
        };
        out.events.push(Event::ToolFinished {
            call_id: call.call_id.clone(),
            name: call.name.clone(),
            is_error,
        });
        call.result = Some((content, is_error));
        self.maybe_finish_tools(out);
    }

    fn maybe_finish_tools(&mut self, out: &mut Output) {
        let turn = self.turn.as_mut().expect("a turn");
        let Phase::Tools { calls } = &turn.phase else {
            return;
        };
        if calls.iter().any(|c| c.result.is_none()) {
            return;
        }
        let cancelling = turn.cancelling;
        let messages: Vec<Message> = calls
            .iter()
            .map(|c| {
                let (content, is_error) = c.result.clone().expect("a result");
                Message::Tool {
                    call_id: c.call_id.clone(),
                    name: c.name.clone(),
                    content,
                    is_error,
                }
            })
            .collect();
        self.history.extend(messages);
        if cancelling {
            self.end_turn(TurnEnd::Cancelled, None, out);
            return;
        }
        self.take_steers();
        self.next_step(out);
    }

    fn next_step(&mut self, out: &mut Output) {
        let turn = self.turn.as_mut().expect("a turn");
        turn.step += 1;
        turn.attempt = 0;
        self.request_model(out);
    }

    /// Moves pending steers into the history. Returns whether there were any.
    fn take_steers(&mut self) -> bool {
        let turn = self.turn.as_mut().expect("a turn");
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
