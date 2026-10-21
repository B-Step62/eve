import type { Answer } from "#shared/input.js";
import type { JsonObject } from "#shared/json.js";
import type { MessageContent } from "#shared/message-content.js";
import type { SessionHistoryMessage } from "#shared/session-history.js";

/** One inbound delivery passed to a channel's `deliver` hook. */
export interface ChannelDelivery<TState = undefined> {
  readonly message?: MessageContent;
  readonly answers?: readonly Answer[];
  /** Context persisted in history before this delivery's message. */
  readonly context?: readonly string[];
  /**
   * Prior conversation added as user and assistant turns before this delivery's input. eve owns
   * it: a `deliver` hook's replacement delivery cannot drop or change it.
   */
  readonly history?: readonly SessionHistoryMessage[];
  /** JSON schema the turn's result must match. */
  readonly outputSchema?: JsonObject;
  /** Per-delivery state; the hook chooses what to merge into durable channel state. */
  readonly state?: Partial<TState>;
}
