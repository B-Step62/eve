//! Tool approval, after eve's policies (`packages/eve/src/tools/approval/policies.ts`).
//!
//! `never` runs, `always` asks a person, `once` asks until a person approves
//! the tool once in the session, and `auto` asks a review model: `clear`
//! runs, `caution` asks a person (eve) or holds the action (fx). A review
//! that fails, or an action too large to review, counts as `caution`.

use serde_json::{json, Value};

use crate::types::{Message, ModelOutput, ModelRequest, ToolSpec};

/// eve reviews actions up to 64 KiB.
pub const MAX_REVIEW_INPUT_BYTES: usize = 64 * 1024;

const DEFAULT_INSTRUCTIONS: &str = "Review the exact tool action for dangerous effects. Return caution when it could cause meaningful harm, including destructive data loss, credential exposure, financial transactions, deployments or public changes, external communication, privilege or system changes, or concealed execution. Return clear for routine, low-impact actions. Judge the action's actual effects from its name and input. If important effects are unclear, return caution.";
const CLEAR: &str = "The action is routine and low impact.";
const CAUTION: &str = "The action is dangerous or its important effects are unclear.";
pub const DECISION_TOOL: &str = "permission_decision";

pub const HELD: &str = "Action held after safety review. The review found this action could cause harm. Do not try it again; choose a materially different safe action, or ask the user.";
pub const DENIED: &str = "The user denied this tool call.";
pub const NO_PERSON: &str =
    "This tool call needs approval, and no person is available to approve it.";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Verdict {
    Clear,
    Caution,
}

pub fn review_request(name: &str, input: &Value, instructions: Option<&str>) -> ModelRequest {
    let system = format!(
        "{}\n\nCall the {DECISION_TOOL} tool with decision \"clear\" or \"caution\".\nclear: {CLEAR}\ncaution: {CAUTION}",
        instructions.unwrap_or(DEFAULT_INSTRUCTIONS),
    );
    ModelRequest {
        system,
        messages: vec![Message::User {
            text: json!({ "action": { "tool": name, "input": input } }).to_string(),
        }],
        tools: vec![ToolSpec {
            name: DECISION_TOOL.into(),
            description: "Report whether the action is clear or needs caution.".into(),
            input_schema: Some(json!({
                "type": "object",
                "properties": {
                    "decision": { "type": "string", "enum": ["clear", "caution"] },
                    "rationale": { "type": "string" }
                },
                "required": ["decision"],
                "additionalProperties": false
            })),
        }],
    }
}

/// Only an explicit `clear` clears; anything else is `caution`.
pub fn verdict(output: &ModelOutput) -> Verdict {
    let decided = output
        .tool_calls
        .iter()
        .find(|c| c.name == DECISION_TOOL)
        .and_then(|c| c.input.get("decision"))
        .and_then(Value::as_str);
    match decided {
        Some("clear") => Verdict::Clear,
        _ => Verdict::Caution,
    }
}

pub fn too_large_to_review(input: &Value) -> bool {
    input.to_string().len() > MAX_REVIEW_INPUT_BYTES
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ToolCall;

    fn decision(d: &str) -> ModelOutput {
        ModelOutput {
            tool_calls: vec![ToolCall {
                id: "d".into(),
                name: DECISION_TOOL.into(),
                input: json!({ "decision": d }),
            }],
            ..ModelOutput::default()
        }
    }

    #[test]
    fn only_an_explicit_clear_clears() {
        assert_eq!(verdict(&decision("clear")), Verdict::Clear);
        assert_eq!(verdict(&decision("caution")), Verdict::Caution);
        assert_eq!(verdict(&decision("maybe")), Verdict::Caution);
        assert_eq!(
            verdict(&ModelOutput {
                text: "clear".into(),
                ..ModelOutput::default()
            }),
            Verdict::Caution
        );
    }

    #[test]
    fn the_review_sees_the_exact_action() {
        let r = review_request("write_file", &json!({ "path": "a" }), None);
        let Message::User { text } = &r.messages[0] else {
            panic!()
        };
        assert_eq!(
            text,
            r#"{"action":{"input":{"path":"a"},"tool":"write_file"}}"#
        );
        assert_eq!(r.tools[0].name, DECISION_TOOL);
    }
}
