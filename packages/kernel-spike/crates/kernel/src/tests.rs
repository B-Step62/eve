use serde_json::json;

use super::*;

fn tool(name: &str, approval: Approval) -> ToolDescriptor {
    ToolDescriptor {
        name: name.into(),
        description: String::new(),
        approval,
    }
}

fn config() -> SessionConfig {
    SessionConfig {
        system: "test".into(),
        tools: vec![
            tool("read_file", Approval::Never),
            tool("write_file", Approval::Never),
            tool("deploy", Approval::Always),
            tool("send_email", Approval::Once),
            tool("delete", Approval::Auto),
        ],
        step_limit: 0,
        host_policy: false,
        caution: Caution::Ask,
        review: ReviewConfig {
            model: Some("review-model".into()),
            instructions: None,
        },
        compaction: CompactionConfig::default(),
    }
}

fn prompt(text: &str) -> Input {
    Input::Prompt {
        id: format!("p:{text}"),
        text: text.into(),
    }
}

fn done(key: &str, output: Value) -> Input {
    Input::EffectResult {
        key: key.into(),
        result: EffectResult::Completed { output },
    }
}

fn calls_one(name: &str) -> Value {
    json!({ "tool_calls": [{ "id": "c", "name": name, "input": { "x": 1 } }] })
}

fn kinds(out: &Output) -> Vec<(String, &'static str)> {
    out.effects
        .iter()
        .map(|e| {
            let k = match &e.effect {
                Effect::ModelCall {
                    purpose: ModelPurpose::Agent,
                    ..
                } => "model",
                Effect::ModelCall {
                    purpose: ModelPurpose::PermissionReview,
                    ..
                } => "review",
                Effect::ModelCall {
                    purpose: ModelPurpose::Compaction,
                    ..
                } => "compaction",
                Effect::ToolCall { .. } => "tool",
                Effect::PolicyDecide { .. } => "policy",
                Effect::UserAsk { .. } => "ask",
                Effect::BlobPut { .. } => "blob",
                Effect::Wait { .. } => "wait",
            };
            (e.key.clone(), k)
        })
        .collect()
}

fn ended(out: &Output) -> Option<TurnEnd> {
    out.events.iter().find_map(|e| match e {
        Event::TurnEnded { reason, .. } => Some(*reason),
        _ => None,
    })
}

fn last_tool(s: &State) -> (String, bool) {
    s.history
        .iter()
        .rev()
        .find_map(|m| match m {
            Message::Tool {
                content, is_error, ..
            } => Some((content.clone(), *is_error)),
            _ => None,
        })
        .unwrap()
}

/// Starts a turn whose first model reply calls `name`.
fn calling(s: &mut State, name: &str) -> Output {
    advance(s, vec![prompt("go")]);
    advance(s, vec![done("t1.s0.a0.model", calls_one(name))])
}

#[test]
fn calls_of_one_response_run_together_and_results_keep_call_order() {
    let mut s = open(config());
    advance(&mut s, vec![prompt("go")]);
    let out = advance(
        &mut s,
        vec![done(
            "t1.s0.a0.model",
            json!({ "tool_calls": [
                { "id": "a", "name": "read_file", "input": {} },
                { "id": "b", "name": "read_file", "input": {} },
                { "id": "w", "name": "write_file", "input": {} },
            ]}),
        )],
    );
    assert_eq!(out.effects.len(), 3);
    assert!(
        out.effects.iter().all(|e| e.after.is_empty()),
        "no write fence"
    );
    advance(
        &mut s,
        vec![
            done("t1.tool.w", json!("ok")),
            done("t1.tool.b", json!("B")),
        ],
    );
    let out = advance(&mut s, vec![done("t1.tool.a", json!("A"))]);
    let Effect::ModelCall { request, .. } = &out.effects[0].effect else {
        panic!()
    };
    let ids: Vec<_> = request
        .messages
        .iter()
        .filter_map(|m| match m {
            Message::Tool { call_id, .. } => Some(call_id.as_str()),
            _ => None,
        })
        .collect();
    assert_eq!(ids, vec!["a", "b", "w"]);
}

#[test]
fn always_asks_and_a_denial_reaches_the_model() {
    let mut s = open(config());
    let out = calling(&mut s, "deploy");
    assert_eq!(kinds(&out), vec![("t1.tool.c.ask".into(), "ask")]);
    let out = advance(
        &mut s,
        vec![done(
            "t1.tool.c.ask",
            json!({ "approved": false, "reason": "Not today." }),
        )],
    );
    assert_eq!(kinds(&out), vec![("t1.s1.a0.model".into(), "model")]);
    assert_eq!(
        last_tool(&s),
        ("The user denied this tool call. Not today.".into(), true)
    );
}

#[test]
fn once_asks_the_first_time_only() {
    let mut s = open(config());
    calling(&mut s, "send_email");
    let out = advance(
        &mut s,
        vec![done("t1.tool.c.ask", json!({ "approved": true }))],
    );
    assert_eq!(kinds(&out), vec![("t1.tool.c".into(), "tool")]);
    advance(&mut s, vec![done("t1.tool.c", json!("sent"))]);
    advance(
        &mut s,
        vec![done("t1.s1.a0.model", json!({ "text": "Sent." }))],
    );
    assert!(s.approved_tools.contains("send_email"));
    advance(&mut s, vec![prompt("again")]);
    let out = advance(
        &mut s,
        vec![done("t2.s0.a0.model", calls_one("send_email"))],
    );
    assert_eq!(kinds(&out), vec![("t2.tool.c".into(), "tool")]);
}

#[test]
fn auto_reviews_with_the_review_model_and_clear_runs() {
    let mut s = open(config());
    let out = calling(&mut s, "delete");
    assert_eq!(kinds(&out), vec![("t1.tool.c.review".into(), "review")]);
    let Effect::ModelCall { model, request, .. } = &out.effects[0].effect else {
        panic!()
    };
    assert_eq!(model.as_deref(), Some("review-model"));
    assert_eq!(request.tools[0].name, approval::DECISION_TOOL);
    let clear = json!({ "tool_calls": [{ "id": "d", "name": "permission_decision", "input": { "decision": "clear" } }] });
    let out = advance(&mut s, vec![done("t1.tool.c.review", clear)]);
    assert_eq!(kinds(&out), vec![("t1.tool.c".into(), "tool")]);
}

#[test]
fn caution_asks_a_person_in_eve_and_holds_in_fx() {
    let caution = json!({ "tool_calls": [{ "id": "d", "name": "permission_decision", "input": { "decision": "caution" } }] });
    let mut eve = open(config());
    calling(&mut eve, "delete");
    let out = advance(&mut eve, vec![done("t1.tool.c.review", caution.clone())]);
    assert_eq!(kinds(&out), vec![("t1.tool.c.ask".into(), "ask")]);

    let mut fx = open(SessionConfig {
        caution: Caution::Hold,
        ..config()
    });
    calling(&mut fx, "delete");
    let out = advance(&mut fx, vec![done("t1.tool.c.review", caution)]);
    assert_eq!(kinds(&out), vec![("t1.s1.a0.model".into(), "model")]);
    assert!(out
        .events
        .iter()
        .any(|e| matches!(e, Event::ToolHeld { .. })));
    assert_eq!(last_tool(&fx), (approval::HELD.into(), true));
}

#[test]
fn a_failed_review_counts_as_caution() {
    let mut s = open(config());
    calling(&mut s, "delete");
    let out = advance(
        &mut s,
        vec![Input::EffectResult {
            key: "t1.tool.c.review".into(),
            result: EffectResult::Failed {
                error: "timeout".into(),
                retryable: false,
            },
        }],
    );
    assert_eq!(kinds(&out), vec![("t1.tool.c.ask".into(), "ask")]);
}

#[test]
fn an_action_too_large_to_review_counts_as_caution() {
    let mut s = open(config());
    advance(&mut s, vec![prompt("go")]);
    let big = json!({ "tool_calls": [{ "id": "c", "name": "delete", "input": { "x": "y".repeat(70_000) } }] });
    let out = advance(&mut s, vec![done("t1.s0.a0.model", big)]);
    assert_eq!(kinds(&out), vec![("t1.tool.c.ask".into(), "ask")]);
}

#[test]
fn the_host_policy_decides_first_and_default_falls_back_to_the_tool() {
    let mut s = open(SessionConfig {
        host_policy: true,
        ..config()
    });
    advance(&mut s, vec![prompt("go")]);
    let out = advance(
        &mut s,
        vec![done(
            "t1.s0.a0.model",
            json!({ "tool_calls": [
                { "id": "a", "name": "read_file", "input": {} },
                { "id": "b", "name": "deploy", "input": {} },
                { "id": "c", "name": "write_file", "input": {} },
            ]}),
        )],
    );
    assert_eq!(
        kinds(&out).iter().filter(|(_, k)| *k == "policy").count(),
        3
    );
    let out = advance(
        &mut s,
        vec![
            done("t1.tool.a.policy", json!({ "decision": "allow" })),
            done("t1.tool.b.policy", json!({ "decision": "default" })),
            done(
                "t1.tool.c.policy",
                json!({ "decision": "deny", "reason": "Outside the workspace." }),
            ),
        ],
    );
    assert_eq!(
        kinds(&out),
        vec![
            ("t1.tool.a".into(), "tool"),
            ("t1.tool.b.ask".into(), "ask")
        ]
    );
    advance(
        &mut s,
        vec![
            done("t1.tool.a", json!("A")),
            done("t1.tool.b.ask", json!({ "approved": true })),
        ],
    );
    advance(&mut s, vec![done("t1.tool.b", json!("deployed"))]);
    let denied = s.history.iter().find_map(|m| match m {
        Message::Tool {
            call_id, content, ..
        } if call_id == "c" => Some(content.clone()),
        _ => None,
    });
    assert_eq!(
        denied.as_deref(),
        Some("Denied by the session policy. Outside the workspace.")
    );
}

#[test]
fn with_no_person_to_ask_the_turn_fails_as_in_eve_and_fx() {
    let mut s = open(config());
    advance(&mut s, vec![prompt("go")]);
    advance(
        &mut s,
        vec![done(
            "t1.s0.a0.model",
            json!({ "tool_calls": [
                { "id": "c", "name": "deploy", "input": {} },
                { "id": "r", "name": "read_file", "input": {} },
            ]}),
        )],
    );
    let out = advance(
        &mut s,
        vec![Input::EffectResult {
            key: "t1.tool.c.ask".into(),
            result: EffectResult::Failed {
                error: "unavailable".into(),
                retryable: false,
            },
        }],
    );
    assert_eq!(
        out.commands,
        vec![Command::Cancel {
            key: "t1.tool.r".into()
        }]
    );
    let out = advance(
        &mut s,
        vec![Input::EffectResult {
            key: "t1.tool.r".into(),
            result: EffectResult::Interrupted {
                reason: InterruptReason::Cancelled,
                partial: Value::Null,
            },
        }],
    );
    assert_eq!(ended(&out), Some(TurnEnd::Failed));
    assert!(
        out.effects.is_empty(),
        "no model call after a missing approval"
    );
}

#[test]
fn cancel_during_an_approval_closes_the_call_and_the_turn() {
    let mut s = open(config());
    calling(&mut s, "deploy");
    let out = advance(&mut s, vec![Input::Cancel { id: "x".into() }]);
    assert_eq!(
        out.commands,
        vec![Command::Cancel {
            key: "t1.tool.c.ask".into()
        }]
    );
    let out = advance(
        &mut s,
        vec![Input::EffectResult {
            key: "t1.tool.c.ask".into(),
            result: EffectResult::Interrupted {
                reason: InterruptReason::Cancelled,
                partial: Value::Null,
            },
        }],
    );
    assert_eq!(ended(&out), Some(TurnEnd::Cancelled));
    assert_eq!(last_tool(&s), ("Cancelled by the user.".into(), true));
}

fn compacting() -> SessionConfig {
    SessionConfig {
        compaction: CompactionConfig {
            context_window_tokens: 1000,
            threshold_percent: 0.9,
            recent_messages: 2,
            records: true,
            envelope_tokens: 0,
        },
        ..config()
    }
}

fn long_history(s: &mut State) {
    for i in 0..6 {
        s.history.push(Message::User {
            text: format!("{i} {}", "x".repeat(800)),
        });
        s.history.push(Message::Assistant {
            text: format!("reply {i}"),
            tool_calls: vec![],
            partial: false,
        });
    }
}

#[test]
fn compaction_summarizes_older_messages_before_the_model_call() {
    let mut s = open(compacting());
    long_history(&mut s);
    let out = advance(&mut s, vec![prompt("next")]);
    assert_eq!(
        kinds(&out),
        vec![
            ("t1.s0.compaction".into(), "compaction"),
            ("t1.s0.compaction.record".into(), "blob")
        ]
    );
    let Effect::ModelCall { request, .. } = &out.effects[0].effect else {
        panic!()
    };
    let Message::User { text } = &request.messages[0] else {
        panic!()
    };
    assert!(text.contains("### user\n0 xxx") && text.contains("<previous-checkpoint>"));
    advance(
        &mut s,
        vec![done(
            "t1.s0.compaction",
            json!({ "text": "The user sent six notes." }),
        )],
    );
    // The model call waits for the record too.
    let out = advance(&mut s, vec![done("t1.s0.compaction.record", Value::Null)]);
    assert_eq!(kinds(&out), vec![("t1.s0.a0.model".into(), "model")]);
    assert!(out
        .events
        .iter()
        .any(|e| matches!(e, Event::CompactionCompleted { kept: 2, .. })));
    let Effect::ModelCall { request, .. } = &out.effects[0].effect else {
        panic!()
    };
    assert!(matches!(&request.messages[0], Message::User { text } if text == compaction::MARKER));
    assert!(
        matches!(&request.messages[1], Message::Assistant { text, .. } if text == "The user sent six notes.")
    );
    assert!(matches!(request.messages.last(), Some(Message::User { text }) if text == "next"));
    assert_eq!(request.messages.len(), 4);
}

#[test]
fn a_failed_compaction_still_makes_the_model_call() {
    let mut s = open(SessionConfig {
        compaction: CompactionConfig {
            records: false,
            ..compacting().compaction
        },
        ..config()
    });
    long_history(&mut s);
    advance(&mut s, vec![prompt("next")]);
    let out = advance(
        &mut s,
        vec![Input::EffectResult {
            key: "t1.s0.compaction".into(),
            result: EffectResult::Failed {
                error: "no".into(),
                retryable: false,
            },
        }],
    );
    assert_eq!(kinds(&out), vec![("t1.s0.a0.model".into(), "model")]);
    assert_eq!(s.history.len(), 13);
}

#[test]
fn a_failed_model_call_is_tried_three_times_with_backoff() {
    let mut s = open(config());
    advance(&mut s, vec![prompt("go")]);
    let fail = |key: &str| Input::EffectResult {
        key: key.into(),
        result: EffectResult::Failed {
            error: "503".into(),
            retryable: true,
        },
    };
    let out = advance(&mut s, vec![fail("t1.s0.a0.model")]);
    assert!(matches!(
        &out.effects[0].effect,
        Effect::Wait { ms: 500, .. }
    ));
    advance(&mut s, vec![done("t1.s0.a0.wait", Value::Null)]);
    let out = advance(&mut s, vec![fail("t1.s0.a1.model")]);
    assert!(matches!(
        &out.effects[0].effect,
        Effect::Wait { ms: 1000, .. }
    ));
    advance(&mut s, vec![done("t1.s0.a1.wait", Value::Null)]);
    let out = advance(&mut s, vec![fail("t1.s0.a2.model")]);
    assert_eq!(ended(&out), Some(TurnEnd::Failed));
}

#[test]
fn a_failure_that_is_not_retryable_ends_the_turn() {
    let mut s = open(config());
    advance(&mut s, vec![prompt("go")]);
    let out = advance(
        &mut s,
        vec![Input::EffectResult {
            key: "t1.s0.a0.model".into(),
            result: EffectResult::Failed {
                error: "401".into(),
                retryable: false,
            },
        }],
    );
    assert_eq!(ended(&out), Some(TurnEnd::Failed));
}

#[test]
fn a_steer_during_generation_cancels_the_model_call_and_continues() {
    let mut s = open(config());
    advance(&mut s, vec![prompt("go")]);
    let out = advance(
        &mut s,
        vec![Input::Steer {
            id: "s1".into(),
            text: "look at b".into(),
        }],
    );
    assert_eq!(
        out.commands,
        vec![Command::Cancel {
            key: "t1.s0.a0.model".into()
        }]
    );
    let out = advance(
        &mut s,
        vec![Input::EffectResult {
            key: "t1.s0.a0.model".into(),
            result: EffectResult::Interrupted {
                reason: InterruptReason::Cancelled,
                partial: json!({ "text": "I will lo" }),
            },
        }],
    );
    let Effect::ModelCall { request, .. } = &out.effects[0].effect else {
        panic!()
    };
    assert!(
        matches!(request.messages.last(), Some(Message::Steering { text }) if text == "look at b")
    );
}

#[test]
fn the_same_inputs_give_the_same_outputs_and_state_round_trips() {
    let run = || {
        let mut s = open(config());
        let mut all = vec![calling(&mut s, "delete")];
        all.push(advance(
            &mut s,
            vec![Input::Steer {
                id: "s".into(),
                text: "x".into(),
            }],
        ));
        (
            serde_json::to_string(&s).unwrap(),
            serde_json::to_string(&all).unwrap(),
        )
    };
    assert_eq!(run(), run());
    let mut s = open(config());
    calling(&mut s, "send_email");
    let back = migrate(serde_json::from_str(&serde_json::to_string(&s).unwrap()).unwrap()).unwrap();
    assert_eq!(back, s);
}

#[test]
fn a_host_tool_asks_the_host_policy_and_default_asks_a_person() {
    let mut s = open(SessionConfig {
        tools: vec![tool("custom", Approval::Host)],
        ..config()
    });
    let out = calling(&mut s, "custom");
    assert_eq!(kinds(&out), vec![("t1.tool.c.policy".into(), "policy")]);
    let out = advance(
        &mut s,
        vec![done("t1.tool.c.policy", json!({ "decision": "default" }))],
    );
    assert_eq!(kinds(&out), vec![("t1.tool.c.ask".into(), "ask")]);
}
