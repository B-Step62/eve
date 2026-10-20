//! The kernel contract: everything that crosses `advance`.

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const STATE_VERSION: u32 = 3;

/// What a host may do with an effect that was open when its process stopped.
/// A host choice: local hosts (fx, libfx, durable-harness) obey `never`;
/// Workflow hosts run the step again, as eve does today.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Replay {
    /// Run it again.
    #[default]
    Safe,
    /// Do not run it again. Record an intent before it starts; after a crash,
    /// report `interrupted { crashed }`, and the model is told it may have run.
    Never,
}

/// eve's tool approval policies.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Approval {
    /// No approval needed (eve `never()`, and tools without a policy).
    #[default]
    Never,
    /// Ask a person every time (eve `always()`).
    Always,
    /// Ask until a person approves this tool once in the session (eve `once()`).
    Once,
    /// A review model decides: clear runs, caution follows `caution` (eve `auto()`).
    Auto,
    /// The host's policy decides with `policy.decide` (an eve policy function). `default` asks.
    Host,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ToolDescriptor {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub approval: Approval,
    /// `never` for a tool with side effects that must not happen twice.
    #[serde(default)]
    pub replay: Replay,
}

/// What a review's `caution` does.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Caution {
    /// Ask a person (eve).
    #[default]
    Ask,
    /// Hold the action and tell the model (fx).
    Hold,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReviewConfig {
    /// The review model; the host's agent model when absent.
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub instructions: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct CompactionConfig {
    /// 0 turns compaction off.
    #[serde(default)]
    pub context_window_tokens: u64,
    #[serde(default = "default_threshold")]
    pub threshold_percent: f64,
    #[serde(default = "default_recent")]
    pub recent_messages: usize,
    /// Store each compacted transcript with a `blob.put` effect.
    #[serde(default)]
    pub records: bool,
    /// Request tokens the kernel does not build, such as the host's tool
    /// schemas (eve's `requestEnvelopeTokens`).
    #[serde(default)]
    pub envelope_tokens: u64,
}

fn default_threshold() -> f64 {
    0.9
}
fn default_recent() -> usize {
    10
}

impl Default for CompactionConfig {
    fn default() -> Self {
        Self {
            context_window_tokens: 0,
            threshold_percent: 0.9,
            recent_messages: 10,
            records: false,
            envelope_tokens: 0,
        }
    }
}

/// Prepared once by the distribution. The kernel never reads settings.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct SessionConfig {
    pub system: String,
    pub tools: Vec<ToolDescriptor>,
    /// 0 means no limit.
    #[serde(default)]
    pub step_limit: u32,
    /// Ask the host's session policy before each tool call (`policy.decide`).
    #[serde(default)]
    pub host_policy: bool,
    #[serde(default)]
    pub caution: Caution,
    #[serde(default)]
    pub review: ReviewConfig,
    #[serde(default)]
    pub compaction: CompactionConfig,
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
    /// The effect was open when the process stopped.
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
        /// Whether trying again may help (eve's error classification).
        #[serde(default)]
        retryable: bool,
    },
    Interrupted {
        reason: InterruptReason,
        #[serde(default)]
        partial: Value,
    },
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
        /// A model other than the agent's, such as the review model.
        #[serde(default)]
        model: Option<String>,
        request: ModelRequest,
    },
    ToolCall {
        call_id: String,
        name: String,
        input: Value,
    },
    /// The host's session policy for one tool call. Output: `{"decision": "allow" | "deny" | "ask" | "review" | "default", "reason"?}`.
    PolicyDecide {
        call_id: String,
        name: String,
        input: Value,
    },
    /// Ask a person. Output: `{"approved": bool, "reason"?}`; `failed` means no person can answer.
    UserAsk { request: AskRequest },
    /// Store bytes the kernel no longer keeps in its state.
    BlobPut { name: String, content: String },
    /// Backoff before a retry. The kernel has no clock.
    Wait { ms: u64, reason: String },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AskRequest {
    Approval {
        call_id: String,
        name: String,
        input: Value,
        reason: String,
    },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelPurpose {
    Agent,
    PermissionReview,
    Compaction,
}

/// The normalized model request. Hosts map it to the AI SDK or to a provider codec.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ModelRequest {
    pub system: String,
    pub messages: Vec<Message>,
    pub tools: Vec<ToolSpec>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ToolSpec {
    pub name: String,
    pub description: String,
    /// JSON Schema for the input; hosts use their own schema when absent.
    #[serde(default)]
    pub input_schema: Option<Value>,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Usage {
    #[serde(default)]
    pub input_tokens: Option<u64>,
    #[serde(default)]
    pub output_tokens: Option<u64>,
}

/// The normalized model output, in `completed.output`.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct ModelOutput {
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub tool_calls: Vec<ToolCall>,
    #[serde(default)]
    pub usage: Option<Usage>,
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
    ApprovalRequested {
        call_id: String,
        name: String,
        reason: String,
    },
    ApprovalResolved {
        call_id: String,
        approved: bool,
    },
    ToolHeld {
        call_id: String,
        name: String,
    },
    ToolFinished {
        call_id: String,
        name: String,
        is_error: bool,
    },
    CompactionStarted {
        messages: usize,
        estimated_tokens: u64,
    },
    CompactionCompleted {
        removed: usize,
        kept: usize,
    },
    Retrying {
        attempt: u32,
        delay_ms: u64,
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
    /// The inputs this call consumed, numbered: what the host appends to the session log.
    #[serde(default)]
    pub entries: Vec<Entry>,
}

/// One record of the session log. Every host stores the same records: the
/// state is the fold of the entries, so a snapshot (a `State`, which carries
/// its `seq`) plus the entries after it restores a session on any host.
/// Effects and commands are not logged; `resume` rebuilds them from the state.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Entry {
    pub seq: u64,
    pub input: Input,
}
