import type { SessionSendOptions, SessionRespondOptions } from "#channel/session.js";
import type { SessionControlOptions } from "#channel/types.js";
import type { Delivery } from "#shared/delivery.js";
import type { Answer, StrictAnswers } from "#shared/input.js";
import type { MessageContent } from "#shared/message-content.js";
import type { SessionStreamEvent } from "#protocol/session-event.js";

/** Options common to session readers on the client and server. */
export interface SessionStreamOptions {
  readonly startIndex?: number;
  readonly follow?: boolean;
  readonly signal?: AbortSignal;
}

/** A read-only session handle. Attaching it performs no I/O. */
export interface SessionReader {
  readonly id: string;
  stream(options?: SessionStreamOptions): AsyncIterable<SessionStreamEvent>;
}

/** Commands available only on handles that already carry authenticated authority. */
export interface SessionOperations<
  TSendOptions = SessionSendOptions,
  TRespondOptions = SessionRespondOptions,
  TControlOptions = SessionControlOptions,
> extends SessionReader {
  send(message: MessageContent, options: TSendOptions): Promise<Delivery>;
  respond<const TAnswers extends readonly Answer[]>(
    answers: StrictAnswers<TAnswers>,
    options: TRespondOptions,
  ): Promise<Delivery>;
  cancel(options?: TControlOptions & { readonly turnId?: string | null }): Promise<Delivery>;
  clear(options?: TControlOptions): Promise<Delivery>;
  compact(options?: TControlOptions): Promise<Delivery>;
  reset(options?: TControlOptions & { readonly reason?: string }): Promise<Delivery>;
}
