use serde_json::json;

use super::*;

fn config() -> SessionConfig {
    SessionConfig {
        system: "test".into(),
        tools: vec![
            ToolDescriptor {
                name: "read_file".into(),
                description: "".into(),
                read_only: true,
                replay: Replay::Safe,
            },
            ToolDescriptor {
                name: "write_file".into(),
                description: "".into(),
                read_only: false,
                replay: Replay::Never,
            },
        ],
        step_limit: 0,
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

fn calls(out: &Output) -> Vec<(&str, &str, Vec<String>)> {
    out.effects
        .iter()
        .map(|e| match &e.effect {
            Effect::ToolCall { name, .. } => (e.key.as_str(), name.as_str(), e.after.clone()),
            Effect::ModelCall { .. } => (e.key.as_str(), "model", e.after.clone()),
            Effect::Wait { .. } => (e.key.as_str(), "wait", e.after.clone()),
        })
        .collect()
}

fn ended(out: &Output) -> Option<TurnEnd> {
    out.events.iter().find_map(|e| match e {
        Event::TurnEnded { reason, .. } => Some(*reason),
        _ => None,
    })
}

#[test]
fn reads_run_together_and_the_write_waits() {
    let mut s = open(config());
    let out = advance(&mut s, vec![prompt("go")]);
    assert_eq!(calls(&out), vec![("t1.s0.a0.model", "model", vec![])]);
    let out = advance(
        &mut s,
        vec![done(
            "t1.s0.a0.model",
            json!({ "tool_calls": [
                { "id": "a", "name": "read_file", "input": {} },
                { "id": "b", "name": "read_file", "input": {} },
                { "id": "c", "name": "write_file", "input": {} },
            ]}),
        )],
    );
    assert_eq!(
        calls(&out),
        vec![
            ("t1.tool.a", "read_file", vec![]),
            ("t1.tool.b", "read_file", vec![]),
            (
                "t1.tool.c",
                "write_file",
                vec!["t1.tool.a".into(), "t1.tool.b".into()]
            ),
        ]
    );
    assert_eq!(out.effects[2].replay, Replay::Never);
    // Results arrive out of order; the model sees them in call order.
    advance(
        &mut s,
        vec![done("t1.tool.b", json!("B")), done("t1.tool.a", json!("A"))],
    );
    let out = advance(&mut s, vec![done("t1.tool.c", json!("ok"))]);
    assert_eq!(calls(&out), vec![("t1.s1.a0.model", "model", vec![])]);
    let Effect::ModelCall { request, .. } = &out.effects[0].effect else {
        panic!()
    };
    let tool_ids: Vec<_> = request
        .messages
        .iter()
        .filter_map(|m| match m {
            Message::Tool { call_id, .. } => Some(call_id.as_str()),
            _ => None,
        })
        .collect();
    assert_eq!(tool_ids, vec!["a", "b", "c"]);
    let out = advance(
        &mut s,
        vec![done("t1.s1.a0.model", json!({ "text": "done" }))],
    );
    assert_eq!(ended(&out), Some(TurnEnd::Completed));
    assert!(s.is_idle());
}

#[test]
fn a_crashed_never_effect_tells_the_model_it_may_have_run() {
    let mut s = open(config());
    advance(&mut s, vec![prompt("go")]);
    advance(
        &mut s,
        vec![done(
            "t1.s0.a0.model",
            json!({ "tool_calls": [{ "id": "w", "name": "write_file", "input": {} }] }),
        )],
    );
    let out = advance(
        &mut s,
        vec![Input::EffectResult {
            key: "t1.tool.w".into(),
            result: EffectResult::Interrupted {
                reason: InterruptReason::Crashed,
                partial: Value::Null,
            },
        }],
    );
    let Effect::ModelCall { request, .. } = &out.effects[0].effect else {
        panic!()
    };
    let last = request.messages.last().unwrap();
    assert!(
        matches!(last, Message::Tool { content, is_error: true, .. } if content.contains("may or may not have taken effect"))
    );
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
    let tail: Vec<_> = request.messages.iter().rev().take(2).collect();
    assert!(matches!(tail[0], Message::Steering { text } if text == "look at b"));
    assert!(
        matches!(tail[1], Message::Assistant { partial: true, text, .. } if text == "I will lo")
    );
    // The same steer delivered again is a no-op.
    let out = advance(
        &mut s,
        vec![Input::Steer {
            id: "s1".into(),
            text: "look at b".into(),
        }],
    );
    assert!(out.commands.is_empty());
}

#[test]
fn a_steer_during_a_tool_waits_for_the_boundary() {
    let mut s = open(config());
    advance(&mut s, vec![prompt("go")]);
    advance(
        &mut s,
        vec![done(
            "t1.s0.a0.model",
            json!({ "tool_calls": [{ "id": "a", "name": "read_file", "input": {} }] }),
        )],
    );
    let out = advance(
        &mut s,
        vec![Input::Steer {
            id: "s1".into(),
            text: "also c".into(),
        }],
    );
    assert!(out.commands.is_empty());
    let out = advance(&mut s, vec![done("t1.tool.a", json!("A"))]);
    let Effect::ModelCall { request, .. } = &out.effects[0].effect else {
        panic!()
    };
    assert!(matches!(
        request.messages.last(),
        Some(Message::Steering { .. })
    ));
}

#[test]
fn cancel_during_a_tool_pairs_every_call_and_ends_the_turn() {
    let mut s = open(config());
    advance(&mut s, vec![prompt("go")]);
    advance(
        &mut s,
        vec![done(
            "t1.s0.a0.model",
            json!({ "tool_calls": [{ "id": "a", "name": "read_file", "input": {} }] }),
        )],
    );
    let out = advance(&mut s, vec![Input::Cancel { id: "c1".into() }]);
    assert_eq!(
        out.commands,
        vec![Command::Cancel {
            key: "t1.tool.a".into()
        }]
    );
    let out = advance(
        &mut s,
        vec![Input::EffectResult {
            key: "t1.tool.a".into(),
            result: EffectResult::Interrupted {
                reason: InterruptReason::Cancelled,
                partial: Value::Null,
            },
        }],
    );
    assert_eq!(ended(&out), Some(TurnEnd::Cancelled));
    assert!(matches!(s.history.last(), Some(Message::Tool { call_id, .. }) if call_id == "a"));
    // The next prompt starts a clean turn.
    let out = advance(&mut s, vec![prompt("again")]);
    assert_eq!(calls(&out), vec![("t2.s0.a0.model", "model", vec![])]);
}

#[test]
fn a_failed_model_call_backs_off_through_a_wait_effect() {
    let mut s = open(config());
    advance(&mut s, vec![prompt("go")]);
    let out = advance(
        &mut s,
        vec![Input::EffectResult {
            key: "t1.s0.a0.model".into(),
            result: EffectResult::Failed {
                error: "503".into(),
                evidence: Some(ModelFailureEvidence {
                    cause: recovery::FailureCause::ProviderUnavailable,
                    delivery: recovery::Delivery::PossiblySent,
                    streamed_bytes: 0,
                    progress: recovery::Progress::Unknown,
                    retry_after_seconds: None,
                    recovery_elapsed_ns: None,
                }),
            },
        }],
    );
    assert_eq!(calls(&out), vec![("t1.s0.a0.wait", "wait", vec![])]);
    assert!(matches!(
        &out.effects[0].effect,
        Effect::Wait { ms: 250, .. }
    ));
    let out = advance(&mut s, vec![done("t1.s0.a0.wait", Value::Null)]);
    assert_eq!(calls(&out), vec![("t1.s0.a1.model", "model", vec![])]);
}

#[test]
fn the_step_limit_ends_the_turn_with_a_notice() {
    let mut s = open(SessionConfig {
        step_limit: 1,
        ..config()
    });
    advance(&mut s, vec![prompt("go")]);
    advance(
        &mut s,
        vec![done(
            "t1.s0.a0.model",
            json!({ "tool_calls": [{ "id": "a", "name": "read_file", "input": {} }] }),
        )],
    );
    let out = advance(&mut s, vec![done("t1.tool.a", json!("A"))]);
    assert_eq!(ended(&out), Some(TurnEnd::StepLimit));
}

#[test]
fn the_same_inputs_give_the_same_outputs() {
    let run = || {
        let mut s = open(config());
        let mut all = vec![advance(&mut s, vec![prompt("go")])];
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
}

#[test]
fn state_round_trips_through_json() {
    let mut s = open(config());
    advance(&mut s, vec![prompt("go")]);
    let bytes = serde_json::to_string(&s).unwrap();
    let back = migrate(serde_json::from_str(&bytes).unwrap()).unwrap();
    assert_eq!(back, s);
}
