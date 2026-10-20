//! Compaction, after eve (`packages/eve/src/harness/compaction/`).
//!
//! When the next model request reaches `threshold_percent` of the context
//! window, older messages become a summary from a `compaction` model call.
//! History becomes the checkpoint (`user: MARKER`, `assistant: summary`)
//! followed by the most recent messages, cut so that no tool result loses its
//! call. A previous checkpoint is passed to the next summary, not summarized
//! again. eve also first tries to cut old tool results before it summarizes;
//! this kernel does not.

use crate::types::{CompactionConfig, Message, ModelRequest};

pub const MARKER: &str = "Summary of our conversation so far:";

const SYSTEM: &str = "You are performing a CONTEXT CHECKPOINT COMPACTION. Create a handoff summary for another LLM that will resume the task.

Include:

- Current progress and key decisions made
- Important context, constraints, or user preferences
- What remains to be done, with clear next steps
- Any critical data, examples, or references needed to continue

Be concise, structured, and focused on helping the next LLM seamlessly continue the work. Write in the same language as the conversation. Do not continue the conversation, answer its questions, or invent facts. Only output the handoff summary.";

const CHECKPOINT_PROMPT: &str = "Update the previous checkpoint with the newer information in the conversation. If there is no previous checkpoint, create one from the conversation.

Make completed work explicit so the next model does not repeat it. Keep completed work separate from current and remaining work, and do not describe completed work as pending unless later messages show it must be redone. Preserve exact file paths, function names, commands, error messages, identifiers, and measured values when they are needed to continue.

Large tool outputs are the main thing to compress: reduce each to the findings the next model needs — what was searched or read, what it established, and the exact identifiers involved — rather than reproducing the output. The next model cannot see the originals, so nothing it would need to act on may be lost.";

/// The last model-reported prompt size, and how much history it covered.
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct UsageMark {
    pub input_tokens: u64,
    pub messages: usize,
}

fn chars_to_tokens(chars: usize) -> u64 {
    (chars as u64).div_ceil(4)
}

/// eve's estimate: the last reported prompt tokens plus the size of what was appended since.
pub fn estimate_tokens(system: &str, history: &[Message], mark: Option<UsageMark>) -> u64 {
    let size = |m: &[Message]| serde_json::to_string(m).map(|s| s.len()).unwrap_or(0);
    match mark {
        Some(mark) if mark.messages <= history.len() => {
            mark.input_tokens + chars_to_tokens(size(&history[mark.messages..]))
        }
        _ => chars_to_tokens(system.len() + size(history)),
    }
}

pub fn due(
    config: &CompactionConfig,
    system: &str,
    history: &[Message],
    mark: Option<UsageMark>,
) -> bool {
    if config.context_window_tokens == 0 {
        return false;
    }
    let threshold = (config.context_window_tokens as f64 * config.threshold_percent) as u64;
    estimate_tokens(system, history, mark) >= threshold
}

fn is_checkpoint(history: &[Message]) -> bool {
    matches!(history.first(), Some(Message::User { text }) if text == MARKER)
        && matches!(history.get(1), Some(Message::Assistant { .. }))
}

/// Where the kept tail starts, or `None` when there is nothing new to summarize.
pub fn keep_from(history: &[Message], recent: usize) -> Option<usize> {
    let mut start = history.len().saturating_sub(recent);
    while start > 0 && matches!(history[start], Message::Tool { .. }) {
        start -= 1;
    }
    let summarized = if is_checkpoint(history) { 2 } else { 0 };
    (start > summarized).then_some(start)
}

pub fn request(older: &[Message]) -> ModelRequest {
    let (previous, conversation) = if is_checkpoint(older) {
        let Message::Assistant { text, .. } = &older[1] else {
            unreachable!()
        };
        (text.as_str(), &older[2..])
    } else {
        ("", older)
    };
    let prompt = format!(
        "<previous-checkpoint>\n{previous}\n</previous-checkpoint>\n\n<conversation>\nConversation transcript:\n{}\n</conversation>\n\n{CHECKPOINT_PROMPT}",
        transcript(conversation),
    );
    ModelRequest {
        system: SYSTEM.into(),
        messages: vec![Message::User { text: prompt }],
        tools: Vec::new(),
    }
}

fn transcript(messages: &[Message]) -> String {
    let sections: Vec<String> = messages
        .iter()
        .filter_map(|m| {
            let (role, content) = match m {
                Message::User { text } | Message::Steering { text } => ("user", text.clone()),
                Message::Assistant {
                    text, tool_calls, ..
                } => {
                    let mut lines = vec![text.clone()];
                    lines.extend(
                        tool_calls
                            .iter()
                            .map(|c| format!("Called {} with {}", c.name, c.input)),
                    );
                    ("assistant", lines.join("\n"))
                }
                Message::Tool { name, content, .. } => {
                    ("tool", format!("Result of {name}:\n{content}"))
                }
            };
            let content = content.trim().to_string();
            (!content.is_empty()).then(|| format!("### {role}\n{content}"))
        })
        .collect();
    if sections.is_empty() {
        "(empty)".into()
    } else {
        sections.join("\n\n")
    }
}

pub fn compacted(summary: String, kept: &[Message]) -> Vec<Message> {
    let mut history = vec![
        Message::User {
            text: MARKER.into(),
        },
        Message::Assistant {
            text: summary,
            tool_calls: Vec::new(),
            partial: false,
        },
    ];
    history.extend_from_slice(kept);
    history
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::types::ToolCall;

    fn user(t: &str) -> Message {
        Message::User { text: t.into() }
    }
    fn call(id: &str) -> Message {
        Message::Assistant {
            text: String::new(),
            tool_calls: vec![ToolCall {
                id: id.into(),
                name: "read_file".into(),
                input: json!({}),
            }],
            partial: false,
        }
    }
    fn result(id: &str) -> Message {
        Message::Tool {
            call_id: id.into(),
            name: "read_file".into(),
            content: "x".into(),
            is_error: false,
        }
    }

    #[test]
    fn the_kept_tail_never_starts_with_a_tool_result() {
        let h = vec![user("a"), call("1"), result("1"), call("2"), result("2")];
        // A tail of 1 would start at a tool result; it moves back to its call.
        assert_eq!(keep_from(&h, 1), Some(3));
        assert_eq!(keep_from(&h, 10), None);
    }

    #[test]
    fn a_previous_checkpoint_is_carried_not_summarized_again() {
        let h = compacted("old summary".into(), &[user("b"), call("1"), result("1")]);
        assert_eq!(keep_from(&h, 3), None);
        let r = request(&[h[0].clone(), h[1].clone(), user("b")]);
        let Message::User { text } = &r.messages[0] else {
            panic!()
        };
        assert!(text.contains("<previous-checkpoint>\nold summary\n</previous-checkpoint>"));
        assert!(text.contains("### user\nb"));
        assert!(!text.contains(MARKER));
    }

    #[test]
    fn the_estimate_uses_reported_usage_when_it_has_it() {
        let h = vec![user(&"x".repeat(400))];
        assert!(estimate_tokens("", &h, None) >= 100);
        assert_eq!(
            estimate_tokens(
                "",
                &h,
                Some(UsageMark {
                    input_tokens: 7,
                    messages: 1
                })
            ),
            7 + 1
        );
    }
}
