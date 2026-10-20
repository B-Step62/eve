//! The kernel contract: everything that crosses `advance`.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::recovery::{Delivery, FailureCause, Progress};

pub const STATE_VERSION: u32 = 1;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Replay {
    /// The host may run the effect again after a crash.
    Safe,
    /// The host must not run the effect again after a crash. It reports
    /// `interrupted { reason: crashed }` instead.
    Never,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ToolDescriptor {
    pub name: String,
    pub description: String,
    pub read_only: bool,
    pub replay: Replay,
}

/// Prepared once by the distribution. The kernel never reads settings.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SessionConfig {
    pub system: String,
    pub tools: Vec<ToolDescriptor>,
    /// 0 means no limit.
    #[serde(default)]
    pub step_limit: u32,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Input {
    Prompt { id: String, text: String },
    Steer { id: String, text: String },
    Cancel { id: String },
    EffectResult { key: String, result: EffectResult },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InterruptReason {
    /// The host obeyed a `cancel` command.
    Cancelled,
    /// A `never` effect was open when the process stopped.
    Crashed,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum EffectResult {
    Completed {
        output: Value,
    },
    Failed {
        error: String,
        #[serde(default)]
        evidence: Option<ModelFailureEvidence>,
    },
    Interrupted {
        reason: InterruptReason,
        #[serde(default)]
        partial: Value,
    },
}

/// What the host saw when a model call failed. The kernel decides what to do.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModelFailureEvidence {
    pub cause: FailureCause,
    pub delivery: Delivery,
    #[serde(default)]
    pub streamed_bytes: u64,
    #[serde(default)]
    pub progress: Progress,
    #[serde(default)]
    pub retry_after_seconds: Option<u64>,
    #[serde(default)]
    pub recovery_elapsed_ns: Option<u64>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct EffectRequest {
    pub key: String,
    pub replay: Replay,
    /// Keys that must finish before this effect starts.
    pub after: Vec<String>,
    pub effect: Effect,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Effect {
    ModelCall {
        purpose: ModelPurpose,
        request: ModelRequest,
    },
    ToolCall {
        call_id: String,
        name: String,
        input: Value,
    },
    /// Backoff before a retry. The kernel has no clock.
    Wait { ms: u64, reason: String },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelPurpose {
    Agent,
}

/// The normalized model request. Hosts map it to the AI SDK or to a provider codec.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ModelRequest {
    pub system: String,
    pub messages: Vec<Message>,
    pub tools: Vec<ToolSpec>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ToolSpec {
    pub name: String,
    pub description: String,
}

/// The normalized model output, in `completed.output`.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct ModelOutput {
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub tool_calls: Vec<ToolCall>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub input: Value,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "role", rename_all = "snake_case")]
pub enum Message {
    User {
        text: String,
    },
    Steering {
        text: String,
    },
    Assistant {
        text: String,
        #[serde(default)]
        tool_calls: Vec<ToolCall>,
        #[serde(default)]
        partial: bool,
    },
    Tool {
        call_id: String,
        name: String,
        content: String,
        is_error: bool,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Command {
    Cancel { key: String },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TurnEnd {
    Completed,
    Cancelled,
    Failed,
    StepLimit,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Event {
    TurnStarted {
        turn: u64,
    },
    Steered {
        id: String,
        interrupted_generation: bool,
    },
    SteersReturned {
        ids: Vec<String>,
    },
    ToolFinished {
        call_id: String,
        name: String,
        is_error: bool,
    },
    Recovery {
        strategy: String,
        delay_ms: u64,
        required_action: String,
    },
    MessageCompleted {
        turn: u64,
        text: String,
    },
    TurnEnded {
        turn: u64,
        reason: TurnEnd,
        notice: Option<String>,
    },
    Ignored {
        reason: String,
    },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Output {
    pub effects: Vec<EffectRequest>,
    pub commands: Vec<Command>,
    pub events: Vec<Event>,
}
