import type { PublicAgentDynamicModelDefinition } from "#shared/agent-definition.js";
import type { DynamicResolveContext } from "#dynamic/definition.js";
import { dynamicEventKey } from "#dynamic/definition.js";
import type { ModelMessage } from "ai";

import { buildResolveContext } from "#context/dynamic-resolve-context.js";
import type { AlsContext } from "#context/container.js";
import type { ContextKey } from "#context/key.js";
import { isMockModel } from "#internal/mock-model-identity.js";
import {
  LiveStepDynamicModelSelectionKey,
  SessionDynamicModelReferenceKey,
  TurnDynamicModelReferenceKey,
} from "#context/keys.js";
import type {
  RuntimeDynamicModelReference,
  RuntimeModelReference,
} from "#runtime/agent/bootstrap.js";
import {
  loadDynamicRuntimeModelDefinition,
  resolveRuntimeModelSelection,
  shouldMockAuthoredRuntimeModels,
  type ResolvedRuntimeModelSelection,
  type RuntimeModelResolutionScope,
} from "#runtime/agent/resolve-model.js";
import type { DynamicScopeEvent } from "#dynamic/definition.js";
import { toErrorMessage } from "#shared/errors.js";

const DYNAMIC_MODEL_SELECTION_ERROR_CODE = "EVE_DYNAMIC_MODEL_SELECTION_FAILED";

export class DynamicModelSelectionError extends Error {
  readonly code = DYNAMIC_MODEL_SELECTION_ERROR_CODE;
  override readonly name = "DynamicModelSelectionError";

  constructor(error: unknown) {
    super(toErrorMessage(error), { cause: error });
  }
}

export function isDynamicModelSelectionError(error: unknown): error is DynamicModelSelectionError {
  return (
    error instanceof DynamicModelSelectionError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { readonly code?: unknown }).code === DYNAMIC_MODEL_SELECTION_ERROR_CODE)
  );
}

function durableKeyForEvent(
  eventType: DynamicScopeEvent["type"],
): ContextKey<RuntimeModelReference | null> | undefined {
  switch (eventType) {
    case "session.started":
      return SessionDynamicModelReferenceKey;
    case "turn.started":
      return TurnDynamicModelReferenceKey;
    case "step.started":
      return undefined;
  }
}

/** Runs the dynamic model resolver for a session, a turn, or one model call. */
export async function resolveDynamicModel(input: {
  readonly abortSignal?: AbortSignal;
  readonly ctx: AlsContext;
  readonly dynamicModel: RuntimeDynamicModelReference | undefined;
  readonly event: DynamicScopeEvent;
  readonly messages: readonly ModelMessage[];
  readonly scope: RuntimeModelResolutionScope;
}): Promise<void> {
  if (input.dynamicModel === undefined) return;
  if (!input.dynamicModel.eventNames.includes(dynamicEventKey(input.event.type))) return;

  setSelectionForEvent(input.ctx, input.event.type, null);
  try {
    const definition = await loadDynamicRuntimeModelDefinition({
      dynamicModel: input.dynamicModel,
      scope: input.scope,
    });
    input.abortSignal?.throwIfAborted();
    const rawResult = await invokeModel(definition, input.event, {
      ...buildResolveContext(input.ctx, input.messages),
      abortSignal: input.abortSignal,
    });
    if (rawResult === undefined)
      throw new Error(
        `Dynamic model resolver needs a "${dynamicEventKey(input.event.type)}" handler that returns a model selection or null.`,
      );
    input.abortSignal?.throwIfAborted();
    const selection = await resolveRuntimeModelSelection({
      durability: input.event.type === "step.started" ? "live" : "durable",
      selection: rawResult as never,
      state: input.ctx,
    });

    setSelectionForEvent(input.ctx, input.event.type, selection);
  } catch (error) {
    throw isDynamicModelSelectionError(error) ? error : new DynamicModelSelectionError(error);
  }
}

function setSelectionForEvent(
  ctx: AlsContext,
  eventType: DynamicScopeEvent["type"],
  selection: ResolvedRuntimeModelSelection | null,
): void {
  if (eventType === "step.started") {
    // Replace real providers in mock mode, but keep explicitly scripted responders.
    const stored =
      selection !== null &&
      selection.model !== undefined &&
      !isMockModel(selection.model) &&
      shouldMockAuthoredRuntimeModels()
        ? { reference: selection.reference }
        : selection;
    ctx.setVirtualContext(LiveStepDynamicModelSelectionKey, stored);
    return;
  }

  const durableKey = durableKeyForEvent(eventType);
  if (durableKey === undefined) return;
  ctx.set(durableKey, selection?.reference ?? null);
}

// A switch preserves the correlation between each typed key and its fact.
// Runtime tool/skill registries use widened handler maps, unlike model definitions.
function invokeModel(
  definition: PublicAgentDynamicModelDefinition,
  point: DynamicScopeEvent,
  ctx: DynamicResolveContext,
) {
  switch (point.type) {
    case "session.started":
      return definition.events.beforeSession?.(point.fact, ctx);
    case "turn.started":
      return definition.events.beforeTurn?.(point.fact, ctx);
    case "step.started":
      return definition.events.beforeModel?.(point.fact, ctx);
  }
}
