//! Port of fx `src/core/agent/runtime/model_response_recovery.zig`.
//!
//! Pure model-response policy. It describes the next effect but never sleeps,
//! sends, mutates stream state, or persists a checkpoint.

use serde::{Deserialize, Serialize};

pub const DEFAULT_MAX_PROVIDER_ATTEMPTS: usize = 10;
pub const MAX_RETRY_AFTER_SECONDS: u64 = 30;
const NS_PER_MS: u64 = 1_000_000;
const NS_PER_S: u64 = 1_000_000_000;
/// Past this much total recovery time, billable retries throttle to once a
/// minute. The turn never dies from transient failure.
const BILLABLE_RETRY_WINDOW_NS: u64 = 15 * 60 * NS_PER_S;
const THROTTLED_RETRY_DELAY_NS: u64 = 60 * NS_PER_S;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FailureCause {
    ConnectivityLost,
    TransportInterrupted,
    ResponseInterrupted,
    ProviderStreamTimeout,
    ProviderUnavailable,
    RateLimited,
    SystemResumed,
    CompactionPrepared,
    Authentication,
    RequestLimitReached,
    ContentFilter,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Delivery {
    DefinitelyUnsent,
    PossiblySent,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OutputEvidence {
    #[default]
    None,
    Partial,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolEvidence {
    #[default]
    None,
    ProvenUnexecuted,
    Confirmed,
    Uncertain,
}

/// A stall (the same failure at the same progress point, repeatedly) is a
/// broken response, not a network problem.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Progress {
    #[default]
    Unknown,
    Advancing,
    Stalled,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AttemptState {
    pub consumed: usize,
    pub limit: usize,
}

impl AttemptState {
    pub fn consumed(consumed: usize) -> Self {
        Self {
            consumed,
            limit: DEFAULT_MAX_PROVIDER_ATTEMPTS,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum RetryPacingState {
    #[default]
    Idle,
    Implicit {
        cause: FailureCause,
        attempt: usize,
    },
}

impl RetryPacingState {
    fn after_failure(self, cause: FailureCause, retry_after_seconds: Option<u64>) -> Self {
        // A zero or missing server hint carries no useful information; a
        // failing endpoint saying "retry instantly" must not disable backoff.
        if matches!(retry_after_seconds, Some(s) if s > 0) {
            return Self::Idle;
        }
        match self {
            Self::Implicit {
                cause: prev,
                attempt,
            } if prev == cause => Self::Implicit {
                cause,
                attempt: attempt.saturating_add(1),
            },
            _ => Self::Implicit { cause, attempt: 1 },
        }
    }

    fn attempt_or_one(self) -> usize {
        match self {
            Self::Idle => 1,
            Self::Implicit { attempt, .. } => attempt,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Strategy {
    RetryRequest,
    ContinueResponse,
    RegenerateTool,
    ContinueAfterConfirmedTool,
    ReconcileTool,
    /// Park the turn and probe connectivity until the path returns. Never
    /// consumes the attempt budget: probes transmit nothing.
    WaitForConnectivity,
    /// Silence is ambiguous. Probe the liveness channel; never retry on
    /// silence alone.
    ProbeLiveness,
    Pause,
    Stop,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RequiredAction {
    #[default]
    None,
    ContinueLater,
    InspectUncertainTool,
    ChangeRequest,
    SurfaceStall,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Evidence {
    pub cause: FailureCause,
    pub delivery: Delivery,
    pub attempts: AttemptState,
    pub output: OutputEvidence,
    pub tool: ToolEvidence,
    pub pacing: RetryPacingState,
    pub retry_after_seconds: Option<u64>,
    pub cancelled: bool,
    pub progress: Progress,
    /// Total wall-clock time spent recovering this turn, reported by the host.
    pub recovery_elapsed_ns: Option<u64>,
}

impl Evidence {
    pub fn new(cause: FailureCause, delivery: Delivery, attempts: AttemptState) -> Self {
        Self {
            cause,
            delivery,
            attempts,
            output: OutputEvidence::None,
            tool: ToolEvidence::None,
            pacing: RetryPacingState::Idle,
            retry_after_seconds: None,
            cancelled: false,
            progress: Progress::Unknown,
            recovery_elapsed_ns: None,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Decision {
    pub strategy: Strategy,
    pub delay_ns: u64,
    pub next_pacing: RetryPacingState,
    pub reserve_provider_attempt: bool,
    pub required_action: RequiredAction,
    pub throttled: bool,
}

impl Decision {
    fn of(strategy: Strategy) -> Self {
        Self {
            strategy,
            delay_ns: 0,
            next_pacing: RetryPacingState::Idle,
            reserve_provider_attempt: false,
            required_action: RequiredAction::None,
            throttled: false,
        }
    }

    pub fn auto_recovers(&self) -> bool {
        self.reserve_provider_attempt
            || self.strategy == Strategy::WaitForConnectivity
            || self.strategy == Strategy::ProbeLiveness
    }
}

pub fn decide(e: Evidence) -> Decision {
    if e.cancelled {
        return Decision::of(Strategy::Stop);
    }
    match e.cause {
        FailureCause::ContentFilter => {
            return Decision {
                required_action: RequiredAction::ChangeRequest,
                ..Decision::of(Strategy::Stop)
            }
        }
        FailureCause::RequestLimitReached => {
            return Decision {
                required_action: RequiredAction::ContinueLater,
                ..Decision::of(Strategy::Stop)
            }
        }
        _ => {}
    }

    // Connectivity loss waits indefinitely; probes transmit nothing.
    if e.cause == FailureCause::ConnectivityLost {
        let next_pacing = e.pacing.after_failure(FailureCause::ConnectivityLost, None);
        return Decision {
            delay_ns: connectivity_probe_delay_ns(next_pacing.attempt_or_one()),
            next_pacing,
            ..Decision::of(Strategy::WaitForConnectivity)
        };
    }

    // A stalled exchange is a broken response, not a flaky network.
    if e.progress == Progress::Stalled {
        return Decision {
            required_action: RequiredAction::SurfaceStall,
            ..Decision::of(Strategy::Stop)
        };
    }

    // Silence is never a retry trigger.
    if e.cause == FailureCause::ProviderStreamTimeout {
        let next_pacing = e
            .pacing
            .after_failure(FailureCause::ProviderStreamTimeout, None);
        return Decision {
            delay_ns: retry_delay_ns(next_pacing.attempt_or_one()),
            next_pacing,
            required_action: if e.tool == ToolEvidence::Uncertain {
                RequiredAction::InspectUncertainTool
            } else {
                RequiredAction::None
            },
            ..Decision::of(Strategy::ProbeLiveness)
        };
    }

    let strategy = if e.delivery == Delivery::DefinitelyUnsent {
        Strategy::RetryRequest
    } else {
        match e.tool {
            ToolEvidence::ProvenUnexecuted => Strategy::RegenerateTool,
            ToolEvidence::Confirmed => Strategy::ContinueAfterConfirmedTool,
            ToolEvidence::Uncertain => Strategy::ReconcileTool,
            ToolEvidence::None if e.output == OutputEvidence::Partial => Strategy::ContinueResponse,
            ToolEvidence::None => Strategy::RetryRequest,
        }
    };
    let next_pacing = e.pacing.after_failure(e.cause, e.retry_after_seconds);
    let throttled = e.recovery_elapsed_ns.unwrap_or(0) > BILLABLE_RETRY_WINDOW_NS;
    let delay_ns = match e.retry_after_seconds {
        Some(0) => retry_delay_ns(next_pacing.attempt_or_one()),
        Some(seconds) => {
            let hinted = seconds.min(MAX_RETRY_AFTER_SECONDS) * NS_PER_S;
            if throttled {
                hinted.max(THROTTLED_RETRY_DELAY_NS)
            } else {
                hinted
            }
        }
        None if throttled => THROTTLED_RETRY_DELAY_NS,
        None => retry_delay_ns(next_pacing.attempt_or_one()),
    };
    Decision {
        strategy,
        delay_ns,
        next_pacing,
        reserve_provider_attempt: true,
        required_action: RequiredAction::None,
        throttled,
    }
}

/// 1 s, 2 s, then 5 s flat.
fn connectivity_probe_delay_ns(attempt: usize) -> u64 {
    match attempt {
        0 | 1 => NS_PER_S,
        2 => 2 * NS_PER_S,
        _ => 5 * NS_PER_S,
    }
}

/// 250 ms, 1 s, then exponential growth capped at 30 s.
pub fn retry_delay_ns(attempt: usize) -> u64 {
    match attempt {
        0 => 0,
        1 => 250 * NS_PER_MS,
        _ => {
            let mut seconds: u64 = 1;
            let mut current = 2;
            while current < attempt && seconds < MAX_RETRY_AFTER_SECONDS {
                seconds = (seconds * 2).min(MAX_RETRY_AFTER_SECONDS);
                current += 1;
            }
            seconds * NS_PER_S
        }
    }
}

pub fn should_disable_fast_route(fast_mode: bool, cause: FailureCause, replay_safe: bool) -> bool {
    fast_mode && cause == FailureCause::ProviderUnavailable && replay_safe
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ev(cause: FailureCause, delivery: Delivery, consumed: usize) -> Evidence {
        Evidence::new(cause, delivery, AttemptState::consumed(consumed))
    }

    #[test]
    fn fast_fallback_is_limited_to_replay_safe_provider_outages() {
        assert!(should_disable_fast_route(
            true,
            FailureCause::ProviderUnavailable,
            true
        ));
        assert!(!should_disable_fast_route(
            false,
            FailureCause::ProviderUnavailable,
            true
        ));
        assert!(!should_disable_fast_route(
            true,
            FailureCause::ProviderUnavailable,
            false
        ));
        assert!(!should_disable_fast_route(
            true,
            FailureCause::RateLimited,
            true
        ));
        assert!(!should_disable_fast_route(
            true,
            FailureCause::TransportInterrupted,
            true
        ));
    }

    #[test]
    fn policy_is_deterministic_and_never_pauses_transient_failure() {
        let base = ev(
            FailureCause::TransportInterrupted,
            Delivery::PossiblySent,
            1,
        );
        let first = decide(base);
        assert_eq!(first, decide(base));
        assert_eq!(first.strategy, Strategy::RetryRequest);
        assert!(first.reserve_provider_attempt);
        assert_eq!(first.delay_ns, 250 * NS_PER_MS);

        let partial = Evidence {
            output: OutputEvidence::Partial,
            ..base
        };
        assert_eq!(decide(partial).strategy, Strategy::ContinueResponse);
        let unexecuted = Evidence {
            tool: ToolEvidence::ProvenUnexecuted,
            ..partial
        };
        assert_eq!(decide(unexecuted).strategy, Strategy::RegenerateTool);
        let uncertain = Evidence {
            tool: ToolEvidence::Uncertain,
            ..partial
        };
        assert_eq!(decide(uncertain).strategy, Strategy::ReconcileTool);
        let unsent = Evidence {
            delivery: Delivery::DefinitelyUnsent,
            ..uncertain
        };
        assert_eq!(decide(unsent).strategy, Strategy::RetryRequest);

        let exhausted = Evidence {
            attempts: AttemptState {
                consumed: 10,
                limit: 10,
            },
            ..base
        };
        let kept = decide(exhausted);
        assert_eq!(kept.strategy, Strategy::RetryRequest);
        assert!(kept.reserve_provider_attempt);

        let limit = Evidence {
            cause: FailureCause::RequestLimitReached,
            ..base
        };
        let stopped = decide(limit);
        assert_eq!(stopped.strategy, Strategy::Stop);
        assert_eq!(stopped.required_action, RequiredAction::ContinueLater);
        assert!(!stopped.reserve_provider_attempt);
    }

    #[test]
    fn connectivity_loss_waits_without_consuming_the_attempt_budget() {
        let waiting = decide(ev(
            FailureCause::ConnectivityLost,
            Delivery::DefinitelyUnsent,
            3,
        ));
        assert_eq!(waiting.strategy, Strategy::WaitForConnectivity);
        assert!(!waiting.reserve_provider_attempt);
        assert_eq!(waiting.delay_ns, NS_PER_S);
        let again = decide(Evidence {
            pacing: waiting.next_pacing,
            ..ev(
                FailureCause::ConnectivityLost,
                Delivery::DefinitelyUnsent,
                4,
            )
        });
        assert_eq!(again.delay_ns, 2 * NS_PER_S);
        let third = decide(Evidence {
            pacing: again.next_pacing,
            ..ev(
                FailureCause::ConnectivityLost,
                Delivery::DefinitelyUnsent,
                5,
            )
        });
        assert_eq!(third.delay_ns, 5 * NS_PER_S);
        let steady = decide(Evidence {
            pacing: third.next_pacing,
            ..ev(
                FailureCause::ConnectivityLost,
                Delivery::DefinitelyUnsent,
                6,
            )
        });
        assert_eq!(steady.delay_ns, 5 * NS_PER_S);
        let still = decide(ev(
            FailureCause::ConnectivityLost,
            Delivery::PossiblySent,
            10,
        ));
        assert_eq!(still.strategy, Strategy::WaitForConnectivity);
    }

    #[test]
    fn stream_timeout_probes_liveness_instead_of_pausing() {
        let probing = decide(ev(
            FailureCause::ProviderStreamTimeout,
            Delivery::PossiblySent,
            1,
        ));
        assert_eq!(probing.strategy, Strategy::ProbeLiveness);
        assert_eq!(probing.required_action, RequiredAction::None);
        assert!(!probing.reserve_provider_attempt);
        assert_eq!(probing.delay_ns, 250 * NS_PER_MS);
        let again = decide(Evidence {
            pacing: probing.next_pacing,
            ..ev(
                FailureCause::ProviderStreamTimeout,
                Delivery::PossiblySent,
                2,
            )
        });
        assert_eq!(again.delay_ns, NS_PER_S);
        let uncertain = decide(Evidence {
            tool: ToolEvidence::Uncertain,
            ..ev(
                FailureCause::ProviderStreamTimeout,
                Delivery::PossiblySent,
                1,
            )
        });
        assert_eq!(uncertain.strategy, Strategy::ProbeLiveness);
        assert_eq!(
            uncertain.required_action,
            RequiredAction::InspectUncertainTool
        );
        let cancelled = decide(Evidence {
            cancelled: true,
            ..ev(
                FailureCause::ProviderStreamTimeout,
                Delivery::PossiblySent,
                1,
            )
        });
        assert_eq!(cancelled.strategy, Strategy::Stop);
    }

    #[test]
    fn stalled_progress_stops_instead_of_restarting_forever() {
        let stalled_ev = Evidence {
            progress: Progress::Stalled,
            ..ev(FailureCause::ResponseInterrupted, Delivery::PossiblySent, 4)
        };
        let stalled = decide(stalled_ev);
        assert_eq!(stalled.strategy, Strategy::Stop);
        assert_eq!(stalled.required_action, RequiredAction::SurfaceStall);
        assert_eq!(
            decide(Evidence {
                progress: Progress::Advancing,
                ..stalled_ev
            })
            .strategy,
            Strategy::RetryRequest
        );
        let timeout = decide(Evidence {
            cause: FailureCause::ProviderStreamTimeout,
            ..stalled_ev
        });
        assert_eq!(timeout.strategy, Strategy::Stop);
        assert_eq!(timeout.required_action, RequiredAction::SurfaceStall);
    }

    #[test]
    fn retry_after_and_cancellation_override_automatic_recovery() {
        let base = ev(FailureCause::RateLimited, Delivery::PossiblySent, 3);
        let wait = decide(Evidence {
            retry_after_seconds: Some(30),
            ..base
        });
        assert_eq!(wait.strategy, Strategy::RetryRequest);
        assert_eq!(wait.delay_ns, 30 * NS_PER_S);
        let capped = decide(Evidence {
            retry_after_seconds: Some(31),
            ..base
        });
        assert_eq!(capped.delay_ns, MAX_RETRY_AFTER_SECONDS * NS_PER_S);
        assert!(capped.reserve_provider_attempt);
        let overflow = decide(Evidence {
            retry_after_seconds: Some(u64::MAX),
            ..base
        });
        assert_eq!(overflow.delay_ns, MAX_RETRY_AFTER_SECONDS * NS_PER_S);
        assert_eq!(
            decide(Evidence {
                cancelled: true,
                ..base
            })
            .strategy,
            Strategy::Stop
        );
    }

    #[test]
    fn retry_schedule_uses_the_approved_cap() {
        let expected = [
            250 * NS_PER_MS,
            NS_PER_S,
            2 * NS_PER_S,
            4 * NS_PER_S,
            8 * NS_PER_S,
            16 * NS_PER_S,
            30 * NS_PER_S,
            30 * NS_PER_S,
            30 * NS_PER_S,
        ];
        let mut total = 0;
        for (i, delay) in expected.iter().enumerate() {
            assert_eq!(retry_delay_ns(i + 1), *delay);
            total += delay;
        }
        assert_eq!(total, 121_250 * NS_PER_MS);
    }

    #[test]
    fn billable_retries_throttle_past_the_recovery_window_without_dying() {
        let base = ev(FailureCause::ProviderUnavailable, Delivery::PossiblySent, 8);
        let within = decide(base);
        assert!(!within.throttled);
        assert_eq!(within.delay_ns, 250 * NS_PER_MS);
        let past = Evidence {
            recovery_elapsed_ns: Some(BILLABLE_RETRY_WINDOW_NS + 1),
            ..base
        };
        let throttled = decide(past);
        assert!(throttled.throttled);
        assert_eq!(throttled.delay_ns, THROTTLED_RETRY_DELAY_NS);
        assert_eq!(throttled.strategy, Strategy::RetryRequest);
        let hinted = decide(Evidence {
            retry_after_seconds: Some(1),
            ..past
        });
        assert!(hinted.throttled);
        assert_eq!(hinted.delay_ns, THROTTLED_RETRY_DELAY_NS);
    }

    #[test]
    fn implicit_retry_pacing_is_independent_from_the_shared_attempt_budget() {
        let first = decide(ev(
            FailureCause::TransportInterrupted,
            Delivery::PossiblySent,
            6,
        ));
        assert_eq!(first.strategy, Strategy::RetryRequest);
        assert_eq!(first.delay_ns, 250 * NS_PER_MS);
        let second = decide(Evidence {
            pacing: first.next_pacing,
            ..ev(
                FailureCause::TransportInterrupted,
                Delivery::PossiblySent,
                7,
            )
        });
        assert_eq!(second.delay_ns, NS_PER_S);
        let provider = decide(Evidence {
            pacing: second.next_pacing,
            ..ev(FailureCause::ProviderUnavailable, Delivery::PossiblySent, 8)
        });
        assert_eq!(provider.delay_ns, 250 * NS_PER_MS);
        let zero = decide(Evidence {
            pacing: provider.next_pacing,
            retry_after_seconds: Some(0),
            ..ev(FailureCause::ProviderUnavailable, Delivery::PossiblySent, 9)
        });
        assert_eq!(zero.delay_ns, NS_PER_S);
        assert!(matches!(
            zero.next_pacing,
            RetryPacingState::Implicit { .. }
        ));
        let zero_again = decide(Evidence {
            pacing: zero.next_pacing,
            retry_after_seconds: Some(0),
            ..ev(
                FailureCause::ProviderUnavailable,
                Delivery::PossiblySent,
                10,
            )
        });
        assert_eq!(zero_again.delay_ns, 2 * NS_PER_S);
        let timed = decide(Evidence {
            pacing: zero_again.next_pacing,
            retry_after_seconds: Some(4),
            ..ev(
                FailureCause::ProviderUnavailable,
                Delivery::PossiblySent,
                11,
            )
        });
        assert_eq!(timed.delay_ns, 4 * NS_PER_S);
        assert_eq!(timed.next_pacing, RetryPacingState::Idle);
    }

    #[test]
    fn system_resume_strategy_uses_independent_retry_pacing() {
        let retrying = decide(ev(
            FailureCause::SystemResumed,
            Delivery::DefinitelyUnsent,
            4,
        ));
        assert_eq!(retrying.strategy, Strategy::RetryRequest);
        assert_eq!(retrying.delay_ns, 250 * NS_PER_MS);
        assert!(retrying.reserve_provider_attempt);
        let continuing = decide(Evidence {
            output: OutputEvidence::Partial,
            ..ev(FailureCause::SystemResumed, Delivery::PossiblySent, 4)
        });
        assert_eq!(continuing.strategy, Strategy::ContinueResponse);
        let past = decide(Evidence {
            output: OutputEvidence::Partial,
            ..ev(FailureCause::SystemResumed, Delivery::PossiblySent, 10)
        });
        assert_eq!(past.strategy, Strategy::ContinueResponse);
        assert!(past.reserve_provider_attempt);
    }
}
