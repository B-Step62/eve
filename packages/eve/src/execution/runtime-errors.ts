/**
 * Thrown by a {@link Runtime}'s `deliver` when no in-flight session
 * matches the continuation token. Callers using the resume-or-start
 * pattern (e.g. a channel address send) treat this as the signal to start
 * a fresh session.
 */
export class RuntimeNoActiveSessionError extends Error {
  readonly code = "NO_ACTIVE_SESSION" as const;
  readonly continuationToken: string;

  constructor(continuationToken: string) {
    super(`No active session for continuationToken "${continuationToken}".`);
    this.name = "RuntimeNoActiveSessionError";
    this.continuationToken = continuationToken;
  }
}

/** Type guard for {@link RuntimeNoActiveSessionError}. */
export function isRuntimeNoActiveSessionError(
  error: unknown,
): error is RuntimeNoActiveSessionError {
  return error instanceof RuntimeNoActiveSessionError;
}

/**
 * Thrown by `createSession` when the reserved session id is already recorded
 * for a different delivery. The caller's delivery was not accepted; it belongs
 * in that session as a follow-up.
 */
export class SessionDeliveryConflictError extends Error {
  readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Session "${sessionId}" already exists for a different delivery.`);
    this.name = "SessionDeliveryConflictError";
    this.sessionId = sessionId;
  }
}

/**
 * Thrown by `createSession` when the queue accepted the reserved session but
 * run storage has not recorded it yet. Acceptance is unknown to the caller, who
 * re-sends with the same session and delivery ids.
 */
export class SessionNotRecordedError extends Error {
  readonly sessionId: string;

  constructor(sessionId: string) {
    super(`Session "${sessionId}" is not recorded yet.`);
    this.name = "SessionNotRecordedError";
    this.sessionId = sessionId;
  }
}
