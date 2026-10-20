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

/// The compaction prompt with an empty transcript, as eve's `COMPACTION_PROMPT_OVERHEAD_TOKENS`.
fn prompt_overhead() -> u64 {
    let empty = request(&[]);
    let size = serde_json::to_string(&empty.messages)
        .map(|s| s.len())
        .unwrap_or(0);
    chars_to_tokens(empty.system.len() + size)
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
    // eve counts the summary call's own prompt too, so the summary call fits.
    estimate_tokens(system, history, mark) + prompt_overhead() > threshold
}

fn is_checkpoint(history: &[Message]) -> bool {
    matches!(history.first(), Some(Message::User { text }) if text == MARKER)
        && matches!(history.get(1), Some(Message::Assistant { .. }))
}

/// eve's room for the summary itself, inside the threshold.
fn summary_reserve(threshold: u64) -> u64 {
    (threshold / 4).clamp(64, 2_048)
}

/// Where the kept tail starts, or `None` when there is nothing to summarize.
///
/// As eve: the tail is the last `recent_messages` messages that fit in the
/// threshold beside the summary reserve, and a tool result at its start moves
/// to the summarized part (a result never survives without its call).
pub fn keep_from(history: &[Message], config: &CompactionConfig) -> Option<usize> {
    let base = if is_checkpoint(history) { 2 } else { 0 };
    let conversation = &history[base..];
    let threshold = (config.context_window_tokens as f64 * config.threshold_percent) as u64;
    let reserve = summary_reserve(threshold);
    let max_keep = config
        .recent_messages
        .min(conversation.len().saturating_sub(1));
    let (mut keep, mut tokens) = (0, 0);
    for message in conversation.iter().rev().take(max_keep) {
        let size = chars_to_tokens(
            serde_json::to_string(&[message])
                .map(|s| s.len())
                .unwrap_or(0),
        );
        if tokens + size + reserve > threshold {
            break;
        }
        tokens += size;
        keep += 1;
    }
    let mut split = conversation.len() - keep;
    while split < conversation.len() && matches!(conversation[split], Message::Tool { .. }) {
        split += 1;
    }
    (split > 0 || base > 0).then_some(base + split)
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

    fn window(recent: usize) -> CompactionConfig {
        CompactionConfig {
            context_window_tokens: 100_000,
            threshold_percent: 0.9,
            recent_messages: recent,
            records: false,
        }
    }

    #[test]
    fn a_tool_result_at_the_tail_start_moves_to_the_summary() {
        let h = vec![user("a"), call("1"), result("1"), call("2"), result("2")];
        // A tail of 3 would start at result 1; it moves into the summarized part.
        assert_eq!(keep_from(&h, &window(3)), Some(3));
        assert_eq!(keep_from(&h, &window(10)), Some(1));
    }

    #[test]
    fn the_tail_stops_where_it_would_not_fit() {
        let big = user(&"x".repeat(4_000));
        let h = vec![user("a"), big.clone(), big.clone(), big];
        let small = CompactionConfig {
            context_window_tokens: 2_000,
            ..window(10)
        };
        // Each big message is about 1000 tokens; with the 450-token reserve only one fits in 1800.
        assert_eq!(keep_from(&h, &small), Some(3));
    }

    #[test]
    fn a_previous_checkpoint_is_carried_not_summarized_again() {
        let h = compacted("old summary".into(), &[user("b"), call("1"), result("1")]);
        assert_eq!(keep_from(&h, &window(10)), Some(3));
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
