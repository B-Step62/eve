# eve/extensions/computer-use/tools

## Export names

- computer_use: src/computer-use/extension/tools/computer_use.d.ts#_default

## Peer boundaries

## Declaration closure

### src/approval/definition.d.ts

```ts
export interface ApprovalConfiguration<TInput = Record<string, unknown>> {
  readonly prompt?: ApprovalPrompt<TInput>;
  readonly request: ApprovalPolicy<TInput>;
  readonly response?: ApprovalResponsePolicy<TInput>;
}
export interface ApprovalContext<TInput = Record<string, unknown>> extends SessionContext {
  readonly abortSignal: AbortSignal;
  readonly callId: string;
  readonly toolAnnotations?: ConnectionToolAnnotations;
  readonly toolInput?: ApprovalToolInput<TInput>;
  readonly toolName: string;
}
export interface ApprovalPromptContext<TInput = Record<string, unknown>> {
  readonly callId: string;
  readonly input: TInput;
  readonly toolName: string;
}
export interface ApprovalRequest<TInput = Record<string, unknown>> {
  readonly callId: string;
  readonly interactionId: string;
  readonly principal: SessionAuthContext | null;
  readonly toolInput?: ApprovalToolInput<TInput>;
  readonly toolName: string;
}
export interface ApprovalResponse {
  readonly decision: "approve" | "deny";
  readonly principal: SessionAuthContext;
}
export interface ApprovalResponseAuth {
  getToken(provider: ToolAuthProvider, options?: ToolAuthOptions): Promise<TokenResult>;
  requireAuth(provider: ToolAuthProvider, options?: ToolAuthOptions): never;
}
export interface ApprovalResponseContext<TInput = Record<string, unknown>> {
  readonly auth: ApprovalResponseAuth;
  readonly request: ApprovalRequest<TInput>;
  readonly response: ApprovalResponse;
  readonly session: ApprovalResponseSession;
}
export interface ApprovalResponseSession {
  readonly id: string;
  readonly initiator: SessionAuthContext | null;
  readonly parent?: SessionParent;
  readonly turn: SessionTurn;
}
export interface ConnectionToolAnnotations {
  readonly title?: string;
  readonly readOnlyHint?: boolean;
  readonly destructiveHint?: boolean;
  readonly idempotentHint?: boolean;
  readonly openWorldHint?: boolean;
  readonly [key: string]: unknown;
}
export type Approval<TInput = Record<string, unknown>> =
  ApprovalPolicy<TInput> | ApprovalConfiguration<TInput>;
export type ApprovalPolicy<TInput = Record<string, unknown>> = (
  ctx: ApprovalContext<TInput>,
) => ApprovalStatus | Promise<ApprovalStatus>;
export type ApprovalPrompt<TInput = Record<string, unknown>> = (
  context: ApprovalPromptContext<TInput>,
) => string;
export type ApprovalResponseDecision =
  | {
      readonly status: "allowed";
    }
  | {
      readonly reason: string;
      readonly status: "rejected";
    };
export type ApprovalResponsePolicy<TInput = Record<string, unknown>> = (
  ctx: ApprovalResponseContext<TInput>,
) => ApprovalResponseDecision | Promise<ApprovalResponseDecision>;
export type ApprovalStatus =
  | undefined
  | boolean
  | "not-applicable"
  | "approved"
  | "denied"
  | "user-approval"
  | {
      readonly type: "not-applicable";
      readonly reason?: never;
    }
  | {
      readonly type: "approved";
      readonly reason?: string;
    }
  | {
      readonly type: "denied";
      readonly reason?: string;
    }
  | {
      readonly type: "user-approval";
      readonly reason?: never;
    };
type ApprovalToolInput<TInput> = TInput extends object ? Readonly<TInput> : TInput;
```

### src/channel/types.d.ts

```ts
export interface SessionAuthContext {
  readonly attributes: Readonly<Record<string, string | readonly string[]>>;
  readonly authenticator: string;
  readonly issuer?: string;
  readonly principalId: string;
  readonly principalType: string;
  readonly subject?: string;
}
export interface SessionParent {
  readonly callId: string;
  readonly rootSessionId: string;
  readonly sessionId: string;
  readonly turn: SessionTurn;
}
export interface SessionTurn {
  readonly id: string;
  readonly sequence: number;
}
```

### src/compiled/@standard-schema/spec/index.d.ts

```ts
declare namespace StandardJSONSchemaV1 {
  interface Props<Input = unknown, Output = Input> extends StandardTypedV1.Props<Input, Output> {
    readonly jsonSchema: StandardJSONSchemaV1.Converter;
  }
  interface Converter {
    readonly input: (options: StandardJSONSchemaV1.Options) => Record<string, unknown>;
    readonly output: (options: StandardJSONSchemaV1.Options) => Record<string, unknown>;
  }
  type Target = "draft-2020-12" | "draft-07" | "openapi-3.0" | ({} & string);
  interface Options {
    readonly target: Target;
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }
  interface Types<Input = unknown, Output = Input> extends StandardTypedV1.Types<Input, Output> {}
  type InferInput<Schema extends StandardTypedV1> = StandardTypedV1.InferInput<Schema>;
  type InferOutput<Schema extends StandardTypedV1> = StandardTypedV1.InferOutput<Schema>;
}
declare namespace StandardSchemaV1 {
  interface Props<Input = unknown, Output = Input> extends StandardTypedV1.Props<Input, Output> {
    readonly validate: (
      value: unknown,
      options?: StandardSchemaV1.Options | undefined,
    ) => Result<Output> | Promise<Result<Output>>;
  }
  type Result<Output> = SuccessResult<Output> | FailureResult;
  interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }
  interface Options {
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }
  interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }
  interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }
  interface PathSegment {
    readonly key: PropertyKey;
  }
  interface Types<Input = unknown, Output = Input> extends StandardTypedV1.Types<Input, Output> {}
  type InferInput<Schema extends StandardTypedV1> = StandardTypedV1.InferInput<Schema>;
  type InferOutput<Schema extends StandardTypedV1> = StandardTypedV1.InferOutput<Schema>;
}
declare namespace StandardTypedV1 {
  interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly types?: Types<Input, Output> | undefined;
  }
  interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }
  type InferInput<Schema extends StandardTypedV1> = NonNullable<
    Schema["~standard"]["types"]
  >["input"];
  type InferOutput<Schema extends StandardTypedV1> = NonNullable<
    Schema["~standard"]["types"]
  >["output"];
}
interface StandardJSONSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardJSONSchemaV1.Props<Input, Output>;
}
interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}
interface StandardTypedV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardTypedV1.Props<Input, Output>;
}
```

### src/computer-use/extension/tools/computer_use.d.ts

```ts
declare const _default: import("eve/tools").ToolDefinition<
  {
    request:
      | {
          action: "type";
          text: string;
          typingDelayMs?: number | undefined;
          typingStyle?: "natural" | undefined;
        }
      | {
          action: "screenshot";
          path?: string | undefined;
        }
      | {
          action: "click";
          x: number;
          y: number;
          button: "back" | "forward" | "left" | "middle" | "right" | "wheel";
          keys?: string[] | undefined;
          durationMs?: number | undefined;
          movementStyle?: "natural" | "precision" | undefined;
        }
      | {
          action: "double_click";
          x: number;
          y: number;
          button: "back" | "forward" | "left" | "middle" | "right" | "wheel";
          keys?: string[] | undefined;
          durationMs?: number | undefined;
          movementStyle?: "natural" | "precision" | undefined;
        }
      | {
          action: "triple_click";
          x: number;
          y: number;
          button: "back" | "forward" | "left" | "middle" | "right" | "wheel";
          keys?: string[] | undefined;
          durationMs?: number | undefined;
          movementStyle?: "natural" | "precision" | undefined;
        }
      | {
          action: "drag";
          path: {
            x: number;
            y: number;
          }[];
          keys?: string[] | undefined;
          movementStyle?: "precision" | undefined;
          durationMs?: number | undefined;
        }
      | {
          action: "keypress";
          keys: string[];
        }
      | {
          action: "move";
          x: number;
          y: number;
          keys?: string[] | undefined;
          durationMs?: number | undefined;
          movementStyle?: "natural" | "precision" | undefined;
        }
      | {
          action: "scroll";
          x: number;
          y: number;
          scroll_x: number;
          scroll_y: number;
          keys?: string[] | undefined;
        }
      | {
          action: "clipboard_read";
          selection: "clipboard" | "primary";
        }
      | {
          action: "clipboard_write";
          selection: "clipboard" | "primary";
          text: string;
        }
      | {
          action: "wait";
          durationMs: number;
        }
      | {
          action: "record_start";
          path?: string | undefined;
        }
      | {
          action: "record_stop";
        }
      | {
          action: "sequence";
          actions: (
            | {
                action: "type";
                text: string;
                typingDelayMs?: number | undefined;
                typingStyle?: "natural" | undefined;
              }
            | {
                action: "arrange_windows";
                windows: {
                  selector:
                    | {
                        app: "firefox";
                      }
                    | {
                        app: "xterm";
                        instance: "primary" | "secondary";
                      };
                  region: {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                  };
                }[];
                waitForMs: number;
              }
            | {
                action: "click";
                x: number;
                y: number;
                button: "back" | "forward" | "left" | "middle" | "right" | "wheel";
                durationMs?: number | undefined;
                movementStyle?: "natural" | "precision" | undefined;
              }
            | {
                action: "double_click";
                x: number;
                y: number;
                button: "back" | "forward" | "left" | "middle" | "right" | "wheel";
                durationMs?: number | undefined;
                movementStyle?: "natural" | "precision" | undefined;
              }
            | {
                action: "triple_click";
                x: number;
                y: number;
                button: "back" | "forward" | "left" | "middle" | "right" | "wheel";
                durationMs?: number | undefined;
                movementStyle?: "natural" | "precision" | undefined;
              }
            | {
                action: "drag";
                path: {
                  x: number;
                  y: number;
                }[];
                movementStyle?: "precision" | undefined;
                durationMs?: number | undefined;
              }
            | {
                action: "keypress";
                keys: string[];
              }
            | {
                action: "move";
                x: number;
                y: number;
                durationMs?: number | undefined;
                movementStyle?: "natural" | "precision" | undefined;
              }
            | {
                action: "wait";
                durationMs: number;
              }
            | {
                action: "record_start";
                path: string;
              }
            | {
                action: "record_stop";
              }
          )[];
        }
      | {
          action: "arrange_windows";
          windows: {
            selector:
              | {
                  app: "firefox";
                }
              | {
                  app: "xterm";
                  instance: "primary" | "secondary";
                };
            region: {
              x: number;
              y: number;
              width: number;
              height: number;
            };
          }[];
          waitForMs: number;
        }
      | {
          action: "set_desktop_size";
          size: "full_hd" | "large_16_9" | "social_16_9";
        }
      | {
          action: "launch";
          app: "xterm";
          instance: "primary" | "secondary";
        }
      | {
          action: "focus";
          app: "firefox";
        }
      | {
          action: "focus";
          app: "xterm";
          instance: "primary" | "secondary";
        }
      | {
          action: "arrange_pair";
          pair: "terminal_browser" | "terminal_terminal";
          waitForMs: number;
        }
      | {
          action: "window_layout";
          app: "desktop";
          layout: "left" | "maximized" | "right";
        }
      | {
          action: "launch";
          app: "firefox";
          url?: string | undefined;
        };
  },
  {
    action:
      | "arrange_pair"
      | "arrange_windows"
      | "click"
      | "clipboard_read"
      | "clipboard_write"
      | "double_click"
      | "drag"
      | "focus"
      | "keypress"
      | "launch"
      | "move"
      | "record_start"
      | "record_stop"
      | "screenshot"
      | "scroll"
      | "sequence"
      | "set_desktop_size"
      | "triple_click"
      | "type"
      | "wait"
      | "window_layout";
    result?: unknown;
    backend: "cua-driver";
    timings?: unknown;
    path: string | null;
    screenshot: string;
    state: string;
    version: "0.12.5";
  }
> & {
  execute(
    input: {
      request:
        | {
            action: "type";
            text: string;
            typingDelayMs?: number | undefined;
            typingStyle?: "natural" | undefined;
          }
        | {
            action: "screenshot";
            path?: string | undefined;
          }
        | {
            action: "click";
            x: number;
            y: number;
            button: "back" | "forward" | "left" | "middle" | "right" | "wheel";
            keys?: string[] | undefined;
            durationMs?: number | undefined;
            movementStyle?: "natural" | "precision" | undefined;
          }
        | {
            action: "double_click";
            x: number;
            y: number;
            button: "back" | "forward" | "left" | "middle" | "right" | "wheel";
            keys?: string[] | undefined;
            durationMs?: number | undefined;
            movementStyle?: "natural" | "precision" | undefined;
          }
        | {
            action: "triple_click";
            x: number;
            y: number;
            button: "back" | "forward" | "left" | "middle" | "right" | "wheel";
            keys?: string[] | undefined;
            durationMs?: number | undefined;
            movementStyle?: "natural" | "precision" | undefined;
          }
        | {
            action: "drag";
            path: {
              x: number;
              y: number;
            }[];
            keys?: string[] | undefined;
            movementStyle?: "precision" | undefined;
            durationMs?: number | undefined;
          }
        | {
            action: "keypress";
            keys: string[];
          }
        | {
            action: "move";
            x: number;
            y: number;
            keys?: string[] | undefined;
            durationMs?: number | undefined;
            movementStyle?: "natural" | "precision" | undefined;
          }
        | {
            action: "scroll";
            x: number;
            y: number;
            scroll_x: number;
            scroll_y: number;
            keys?: string[] | undefined;
          }
        | {
            action: "clipboard_read";
            selection: "clipboard" | "primary";
          }
        | {
            action: "clipboard_write";
            selection: "clipboard" | "primary";
            text: string;
          }
        | {
            action: "wait";
            durationMs: number;
          }
        | {
            action: "record_start";
            path?: string | undefined;
          }
        | {
            action: "record_stop";
          }
        | {
            action: "sequence";
            actions: (
              | {
                  action: "type";
                  text: string;
                  typingDelayMs?: number | undefined;
                  typingStyle?: "natural" | undefined;
                }
              | {
                  action: "arrange_windows";
                  windows: {
                    selector:
                      | {
                          app: "firefox";
                        }
                      | {
                          app: "xterm";
                          instance: "primary" | "secondary";
                        };
                    region: {
                      x: number;
                      y: number;
                      width: number;
                      height: number;
                    };
                  }[];
                  waitForMs: number;
                }
              | {
                  action: "click";
                  x: number;
                  y: number;
                  button: "back" | "forward" | "left" | "middle" | "right" | "wheel";
                  durationMs?: number | undefined;
                  movementStyle?: "natural" | "precision" | undefined;
                }
              | {
                  action: "double_click";
                  x: number;
                  y: number;
                  button: "back" | "forward" | "left" | "middle" | "right" | "wheel";
                  durationMs?: number | undefined;
                  movementStyle?: "natural" | "precision" | undefined;
                }
              | {
                  action: "triple_click";
                  x: number;
                  y: number;
                  button: "back" | "forward" | "left" | "middle" | "right" | "wheel";
                  durationMs?: number | undefined;
                  movementStyle?: "natural" | "precision" | undefined;
                }
              | {
                  action: "drag";
                  path: {
                    x: number;
                    y: number;
                  }[];
                  movementStyle?: "precision" | undefined;
                  durationMs?: number | undefined;
                }
              | {
                  action: "keypress";
                  keys: string[];
                }
              | {
                  action: "move";
                  x: number;
                  y: number;
                  durationMs?: number | undefined;
                  movementStyle?: "natural" | "precision" | undefined;
                }
              | {
                  action: "wait";
                  durationMs: number;
                }
              | {
                  action: "record_start";
                  path: string;
                }
              | {
                  action: "record_stop";
                }
            )[];
          }
        | {
            action: "arrange_windows";
            windows: {
              selector:
                | {
                    app: "firefox";
                  }
                | {
                    app: "xterm";
                    instance: "primary" | "secondary";
                  };
              region: {
                x: number;
                y: number;
                width: number;
                height: number;
              };
            }[];
            waitForMs: number;
          }
        | {
            action: "set_desktop_size";
            size: "full_hd" | "large_16_9" | "social_16_9";
          }
        | {
            action: "launch";
            app: "xterm";
            instance: "primary" | "secondary";
          }
        | {
            action: "focus";
            app: "firefox";
          }
        | {
            action: "focus";
            app: "xterm";
            instance: "primary" | "secondary";
          }
        | {
            action: "arrange_pair";
            pair: "terminal_browser" | "terminal_terminal";
            waitForMs: number;
          }
        | {
            action: "window_layout";
            app: "desktop";
            layout: "left" | "maximized" | "right";
          }
        | {
            action: "launch";
            app: "firefox";
            url?: string | undefined;
          };
    },
    ctx: import("eve/tools").ToolContext,
  ): Promise<{
    action:
      | "arrange_pair"
      | "arrange_windows"
      | "click"
      | "clipboard_read"
      | "clipboard_write"
      | "double_click"
      | "drag"
      | "focus"
      | "keypress"
      | "launch"
      | "move"
      | "record_start"
      | "record_stop"
      | "screenshot"
      | "scroll"
      | "sequence"
      | "set_desktop_size"
      | "triple_click"
      | "type"
      | "wait"
      | "window_layout";
    result?: unknown;
    backend: "cua-driver";
    timings?: unknown;
    path: string | null;
    screenshot: string;
    state: string;
    version: "0.12.5";
  }>;
};
```

### src/connections/errors.d.ts

```ts
export interface ConnectionAuthorizationChallenge {
  readonly url?: string;
  readonly userCode?: string;
  readonly expiresAt?: string;
  readonly instructions?: string;
  readonly displayName?: string;
}
```

### src/context/keys.d.ts

```ts
export interface SessionAuth {
  readonly current: SessionAuthContext | null;
  readonly initiator: SessionAuthContext | null;
}
```

### src/context/session-context.d.ts

```ts
export interface SessionContext {
  readonly session: {
    readonly id: string;
    readonly auth: SessionAuth;
    readonly turn: SessionTurn;
    readonly parent?: SessionParent;
    readonly schedule?: SessionSchedule;
    readonly predecessor?: SessionPredecessor;
  };
  getSandbox(): Promise<RuntimeSandboxSession>;
  getSandbox<Session extends SandboxSession>(
    environment: SandboxEnvironment<object | undefined, Session>,
  ): Promise<RuntimeSandboxSession<Session>>;
}
```

### src/context/session-schedule.d.ts

```ts
export interface SessionSchedule {
  readonly definition: string;
  readonly instance?: string;
  readonly occurrenceId?: string;
}
```

### src/protocol/session-events/families/session.d.ts

```ts
export interface SessionPredecessor {
  readonly sessionId: string;
}
```

### src/protocol/session-events/json.d.ts

```ts
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
export type JsonArray = readonly JsonValue[];
export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonArray | JsonObject | JsonPrimitive;
```

### src/public/definitions/connections/events.d.ts

```ts
export interface ConnectionEvent {
  readonly eventId: string;
  readonly name: string;
  readonly timestamp: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly cursor: string | null;
}
```

### src/shared/connection-events.d.ts

```ts
export interface ConnectionEventsAdapter {
  subscribe(input: ManagedEventSubscribeInput): Promise<ManagedEventSubscription>;
  getSubscription(input: {
    id: string;
    options?: {
      timeout?: number;
    };
  }): Promise<ManagedEventSubscription>;
  unsubscribe(input: {
    id: string;
    options?: {
      timeout?: number;
    };
  }): Promise<ManagedEventSubscription>;
}
export interface ConnectionEventsBackend {
  createAdapter(input: {
    principal: ConnectionPrincipal;
    connection: {
      url: string;
    };
    destination: {
      path: string;
    };
  }): Promise<ConnectionEventsAdapter>;
  verify(
    request: Request,
    options: {
      path: string;
    },
  ): Promise<ConnectionEventDelivery>;
}
export interface ManagedEventSubscription {
  id: string;
  name: string;
  arguments: EventJsonObject;
  status: "pending" | "active" | "needs_auth" | "stopped" | "expired" | "failed";
  expiresAt: string | null;
  cleanupStatus?: "pending" | "complete" | "exhausted";
}
export type ConnectionEventDelivery = {
  version: 1;
  deliveryId: string;
  subscriptionId: string;
  source: {
    type: "mcp";
    connectorId: string;
  };
  context: Record<string, unknown>;
} & (
  | {
      event: ConnectionEvent;
    }
  | {
      control: {
        type: "gap";
        cursor: string | null;
        truncated?: true;
      };
    }
  | {
      control: {
        type: "terminated";
        error: {
          code: number;
          message: string;
          data?: unknown;
        };
      };
    }
);
export type EventJson = string | number | boolean | null | readonly EventJson[] | EventJsonObject;
export type EventJsonObject = {
  [key: string]: EventJson | undefined;
};
export type ManagedEventSubscribeInput = {
  name: string;
  arguments: EventJsonObject;
  context?: EventJsonObject;
  idempotencyKey: string;
  ttlMs: number | null;
  options?: {
    signal?: AbortSignal;
    timeout?: number;
    maxTotalTimeout?: number;
  };
};
```

### src/shared/connection-types.d.ts

```ts
export interface AuthorizationCallback {
  readonly params: Readonly<Record<string, string>>;
  readonly method: string;
  readonly body?: string;
}
export interface ConnectionAuthorizationContext {
  readonly url: string;
}
export interface InteractiveAuthorizationDefinition<
  Resume = JsonValue,
> extends AuthorizationDefinitionBase {
  readonly principalType: "user";
  getToken(opts: {
    readonly principal: ConnectionPrincipal;
    readonly connection: ConnectionAuthorizationContext;
  }): Promise<TokenResult>;
  startAuthorization(opts: {
    readonly principal: ConnectionPrincipal;
    readonly connection: ConnectionAuthorizationContext;
    readonly callbackUrl: string;
  }): Promise<{
    readonly challenge: ConnectionAuthorizationChallenge;
    readonly resume?: Resume;
  }>;
  completeAuthorization(opts: {
    readonly principal: ConnectionPrincipal;
    readonly connection: ConnectionAuthorizationContext;
    readonly callbackUrl: string;
    readonly resume?: Resume;
    readonly callback: AuthorizationCallback;
  }): Promise<TokenResult>;
}
export interface NonInteractiveAuthorizationDefinition extends AuthorizationDefinitionBase {
  getToken(opts: {
    readonly principal: ConnectionPrincipal;
    readonly connection: ConnectionAuthorizationContext;
  }): Promise<TokenResult>;
  readonly startAuthorization?: undefined;
  readonly completeAuthorization?: undefined;
}
export interface TokenResult {
  readonly token: string;
  readonly expiresAt?: number;
  readonly providerSubject?: string;
}
export type AuthorizationDefinition<Resume extends JsonValue = JsonValue> =
  NonInteractiveAuthorizationDefinition | InteractiveAuthorizationDefinition<Resume>;
export type ConnectionPrincipal =
  | {
      readonly type: "app";
    }
  | {
      readonly type: "user";
      readonly id: string;
      readonly issuer?: string;
      readonly attributes?: Readonly<Record<string, string | readonly string[]>>;
    };
interface AuthorizationDefinitionBase {
  readonly principalType?: "app" | "user";
  readonly vercelConnect?: {
    readonly experimental_events?: ConnectionEventsBackend;
    readonly connector: string;
  };
  readonly displayName?: string;
  evict?(opts: {
    readonly principal: ConnectionPrincipal;
    readonly connection: ConnectionAuthorizationContext;
  }): void | Promise<void>;
}
```

### src/shared/history-message.d.ts

```ts
export type HistoryMessage =
  SystemModelMessage | UserModelMessage | AssistantModelMessage | ToolModelMessage;
interface CustomPart {
  type: "custom";
  kind: `${string}.${string}`;
  providerOptions?: ProviderOptions;
}
interface FilePart {
  type: "file";
  data: FileData | DataContent | URL | ProviderReference;
  filename?: string;
  mediaType: string;
  providerOptions?: ProviderOptions;
}
interface ImagePart {
  type: "image";
  image: DataContent | URL | ProviderReference;
  mediaType?: string;
  providerOptions?: ProviderOptions;
}
interface ReasoningFilePart {
  type: "reasoning-file";
  data: FileDataData | FileDataUrl | DataContent | URL;
  mediaType: string;
  providerOptions?: ProviderOptions;
}
interface ReasoningPart {
  type: "reasoning";
  text: string;
  providerOptions?: ProviderOptions;
}
interface TextPart {
  type: "text";
  text: string;
  providerOptions?: ProviderOptions;
}
interface ToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  input: unknown;
  providerOptions?: ProviderOptions;
  providerExecuted?: boolean;
}
interface ToolResultPart {
  type: "tool-result";
  toolCallId: string;
  toolName: string;
  output: ToolResultOutput;
  providerOptions?: ProviderOptions;
}
type AssistantContent =
  | string
  | Array<
      | TextPart
      | CustomPart
      | FilePart
      | ReasoningPart
      | ReasoningFilePart
      | ToolCallPart
      | ToolResultPart
      | ToolApprovalRequest
    >;
type AssistantModelMessage = {
  role: "assistant";
  content: AssistantContent;
  providerOptions?: ProviderOptions;
};
type DataContent = string | Uint8Array | ArrayBuffer;
type FileData =
  | FileDataData
  | FileDataUrl
  | {
      type: "reference";
      reference: ProviderReference;
    }
  | {
      type: "text";
      text: string;
    };
type FileDataData = {
  type: "data";
  data: DataContent;
};
type FileDataUrl = {
  type: "url";
  url: URL;
  originalUrl?: string;
};
type JSONValue =
  | null
  | boolean
  | number
  | string
  | readonly JSONValue[]
  | {
      readonly [key: string]: JSONValue | undefined;
    };
type ProviderOptions = Record<
  string,
  {
    [key: string]: JSONValue | undefined;
  }
>;
type ProviderReference = Record<string, string> & {
  type?: never;
};
type SystemModelMessage = {
  role: "system";
  content: string;
  providerOptions?: ProviderOptions;
};
type ToolApprovalRequest = {
  type: "tool-approval-request";
  approvalId: string;
  toolCallId: string;
  reason?: string;
  isAutomatic?: boolean;
  signature?: string;
  inputSchemaInput?: unknown;
};
type ToolApprovalResponse = {
  type: "tool-approval-response";
  approvalId: string;
  approved: boolean;
  reason?: string;
  providerExecuted?: boolean;
};
type ToolContent = Array<ToolResultPart | ToolApprovalResponse>;
type ToolModelMessage = {
  role: "tool";
  content: ToolContent;
  providerOptions?: ProviderOptions;
};
type ToolResultOutput =
  | {
      type: "text";
      value: string;
      providerOptions?: ProviderOptions;
    }
  | {
      type: "json";
      value: JSONValue;
      providerOptions?: ProviderOptions;
    }
  | {
      type: "execution-denied";
      reason?: string;
      providerOptions?: ProviderOptions;
    }
  | {
      type: "error-text";
      value: string;
      providerOptions?: ProviderOptions;
    }
  | {
      type: "error-json";
      value: JSONValue;
      providerOptions?: ProviderOptions;
    }
  | {
      type: "content";
      value: Array<
        | {
            type: "text";
            text: string;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "file";
            data: FileData;
            mediaType: string;
            filename?: string;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "file-data";
            data: string;
            mediaType: string;
            filename?: string;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "file-url";
            url: string;
            mediaType?: string;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "file-id";
            fileId: string | Record<string, string>;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "file-reference";
            providerReference: ProviderReference;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "image-data";
            data: string;
            mediaType: string;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "image-url";
            url: string;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "image-file-id";
            fileId: string | Record<string, string>;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "image-file-reference";
            providerReference: ProviderReference;
            providerOptions?: ProviderOptions;
          }
        | {
            type: "custom";
            providerOptions?: ProviderOptions;
          }
      >;
    };
type UserContent = string | Array<TextPart | ImagePart | FilePart>;
type UserModelMessage = {
  role: "user";
  content: UserContent;
  providerOptions?: ProviderOptions;
};
```

### src/shared/sandbox-environment.d.ts

```ts
declare const CONFIGURATION_HASH: unique symbol;
declare const ENVIRONMENT: unique symbol;
declare const PROVIDER_RUNTIME: unique symbol;
export interface SandboxEnvironment<
  Options extends object | undefined = object,
  Session extends SandboxSession = SandboxSession,
> extends SandboxEnvironmentIdentity {
  open(...args: SandboxOpenArguments<Options>): Promise<RuntimeSandboxSession<Session>>;
}
export interface SandboxEnvironmentIdentity {
  readonly [CONFIGURATION_HASH]: string;
  readonly [ENVIRONMENT]: true;
  readonly [PROVIDER_RUNTIME]: SandboxProviderRuntime;
  readonly provider: string;
}
export interface SandboxSelectorContext {
  readonly session: {
    readonly auth: SessionAuth;
    readonly id: string;
    readonly parent?: SessionParent;
    readonly turn: SessionTurn;
  };
}
export type SandboxOpenArguments<Options> = Options extends undefined
  ? []
  : Record<never, never> extends Options
    ? [options?: Options]
    : [options: Options];
```

### src/shared/sandbox-provider.d.ts

```ts
export interface SandboxDeleteOptions {
  readonly signal?: AbortSignal;
}
export interface SandboxProviderFiles {
  list(): Promise<readonly string[]>;
  read(path: string): Promise<Uint8Array>;
  readText(path: string): Promise<string>;
}
export interface SandboxProviderHandle<Session extends SandboxSession = SandboxSession> {
  readonly sandbox: Session;
  onRuntimeShutdown(): Promise<void>;
  onSandboxDelete(options?: SandboxDeleteOptions): Promise<void>;
  onSandboxStop(): Promise<void>;
}
export interface SandboxProviderHost {
  loadOptionalPackage<T>(input: {
    readonly autoInstall: boolean;
    readonly importModule: () => Promise<T>;
    readonly installPackageName?: string;
    readonly ignoredOptionalDependencies?: readonly string[];
    readonly missingMessage: string;
    readonly packageName: string;
  }): Promise<T>;
  resolveProjectPath(path: string): string;
}
export interface SandboxProviderImplementation<
  OpenOptions extends object | undefined,
  PreparedArtifact extends SandboxPreparedArtifact,
  SessionState,
  Session extends SandboxSession = SandboxSession,
> {
  onSessionEnd?(
    context: SandboxProviderSessionContext,
    artifact: Readonly<PreparedArtifact>,
    state: Readonly<SessionState>,
    options: {
      readonly reason: "completed" | "expired" | "failed";
    },
  ): Promise<void>;
  prepare(context: SandboxProviderPrepareContext): Promise<PreparedArtifact>;
  resume(
    context: SandboxProviderSessionContext,
    artifact: Readonly<PreparedArtifact>,
    state: Readonly<SessionState>,
  ): Promise<SandboxProviderHandle<Session>>;
  start(
    context: SandboxProviderSessionContext,
    options: Readonly<OpenOptions> | undefined,
    artifact: Readonly<PreparedArtifact>,
  ): Promise<{
    readonly handle: SandboxProviderHandle<Session>;
    readonly state: SessionState;
  }>;
}
export interface SandboxProviderPrepareContext {
  readonly files: SandboxProviderFiles;
  readonly host: SandboxProviderHost;
  readonly log?: (message: string) => void;
  readonly resources: SandboxProviderResources;
  readonly sourceRevision: string;
  readonly storagePath: string;
}
export interface SandboxProviderResourceFile {
  readonly content: string | Uint8Array;
  readonly relativePath: string;
}
export interface SandboxProviderResourceTree {
  readonly files: readonly SandboxProviderResourceFile[];
  readonly key: string;
  readonly mountPath: string;
  readonly targetPath: string;
}
export interface SandboxProviderResources {
  readonly skills?: SandboxProviderResourceTree;
  readonly source: SandboxProviderResourceSource;
  readonly workspace?: SandboxProviderResourceTree;
}
export interface SandboxProviderRuntime {
  readonly implementation: ErasedSandboxProviderImplementation;
  readonly providerName: string;
  readonly stateProtocolVersion: number;
}
export interface SandboxProviderSessionContext {
  readonly host: SandboxProviderHost;
  readonly session: SandboxSelectorContext["session"];
  readonly storagePath: string;
}
export type SandboxPreparedArtifact =
  | null
  | boolean
  | number
  | string
  | readonly SandboxPreparedArtifact[]
  | {
      readonly [key: string]: SandboxPreparedArtifact;
    };
export type SandboxProviderResourceSource =
  | {
      readonly kind: "none";
    }
  | {
      readonly key: string;
      readonly kind: "inline";
    }
  | {
      readonly key: string;
      readonly kind: "materialized";
      readonly path: string;
    };
type ErasedSandboxProviderImplementation = SandboxProviderImplementation<
  object | undefined,
  SandboxPreparedArtifact,
  SandboxPreparedArtifact,
  SandboxSession
>;
```

### src/shared/sandbox-session.d.ts

```ts
export interface SandboxCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}
export interface SandboxProcess {
  readonly pid?: number;
  readonly stdout: ReadableStream<Uint8Array>;
  readonly stderr: ReadableStream<Uint8Array>;
  wait(): PromiseLike<{
    exitCode: number;
  }>;
  kill(): PromiseLike<void>;
}
export interface SandboxReadBinaryFileOptions extends SandboxReadFileOptions {}
export interface SandboxReadFileOptions {
  path: string;
  signal?: AbortSignal;
}
export interface SandboxReadTextFileOptions extends SandboxReadFileOptions {
  encoding?: string;
  startLine?: number;
  endLine?: number;
}
export interface SandboxRemovePathOptions {
  readonly signal?: AbortSignal;
  readonly force?: boolean;
  readonly path: string;
  readonly recursive?: boolean;
}
export interface SandboxRunOptions {
  command: string;
  workingDirectory?: string;
  env?: Record<string, string>;
  signal?: AbortSignal;
}
export interface SandboxSession {
  readonly run: (options: SandboxRunOptions) => PromiseLike<SandboxCommandResult>;
  readonly spawn: (options: SandboxSpawnOptions) => PromiseLike<SandboxProcess>;
  readonly readFile: (
    options: SandboxReadFileOptions,
  ) => PromiseLike<ReadableStream<Uint8Array> | null>;
  readonly readBinaryFile: (
    options: SandboxReadBinaryFileOptions,
  ) => PromiseLike<Uint8Array | null>;
  readonly readTextFile: (options: SandboxReadTextFileOptions) => PromiseLike<string | null>;
  readonly writeFile: (options: SandboxWriteFileOptions) => PromiseLike<void>;
  readonly writeBinaryFile: (options: SandboxWriteBinaryFileOptions) => PromiseLike<void>;
  readonly writeTextFile: (options: SandboxWriteTextFileOptions) => PromiseLike<void>;
  resolvePath(path: string): string;
  removePath(options: SandboxRemovePathOptions): Promise<void>;
}
export interface SandboxSpawnOptions extends SandboxRunOptions {}
export interface SandboxWriteBinaryFileOptions extends WriteOptions<Uint8Array> {}
export interface SandboxWriteFileOptions extends WriteOptions<ReadableStream<Uint8Array>> {}
export interface SandboxWriteTextFileOptions extends WriteOptions<string> {
  encoding?: string;
}
export type RuntimeSandboxSession<Session extends SandboxSession = SandboxSession> = Session & {
  delete(options?: SandboxDeleteOptions): Promise<void>;
  stop(): Promise<void>;
};
interface WriteOptions<T> {
  path: string;
  content: T;
  signal?: AbortSignal;
}
```

### src/tools/auth.d.ts

```ts
export interface ToolAuthOptions {
  readonly connection?: ConnectionAuthorizationContext;
  readonly displayName?: string;
  readonly authKey?: string;
}
export type ToolAuthDefinition = AuthorizationDefinition;
export type ToolAuthProvider = ToolAuthDefinition;
```

### src/tools/definition.d.ts

```ts
export interface ApprovalResponder extends SessionAuthContext {
  getToken(provider: ToolAuthProvider, options?: ToolAuthOptions): Promise<TokenResult>;
}
export interface ApprovedCall {
  readonly responder: ApprovalResponder;
}
export interface PublicToolDefinition<
  TInput = unknown,
  TOutput = unknown,
> extends ToolDefinitionBase {
  label?: ToolLabelDefinition<TInput, TOutput>;
  inputSchema: PublicToolInputSchema<TInput>;
  outputSchema?: PublicToolOutputSchema<TOutput>;
}
export interface ToolDefinition<TInput = unknown, TOutput = unknown> extends PublicToolDefinition<
  TInput,
  TOutput
> {
  execute(input: TInput, ctx: ToolContext): Promise<TOutput> | TOutput | AsyncIterable<TOutput>;
  endsTurn?: boolean | ((output: TOutput) => boolean | Promise<boolean>);
  approval?: Approval<ApprovalContextInput<TInput>>;
  toModelOutput?: (output: TOutput) => ToolModelOutput | Promise<ToolModelOutput>;
}
export interface ToolLabelDefinition<TInput = unknown, TOutput = unknown> {
  start(input: Readonly<TInput>): string;
  delta?(input: Readonly<TInput>, partial: Readonly<TOutput>): string;
  complete?(input: Readonly<TInput>, output: Readonly<TOutput>): string;
}
export type PublicToolInputSchema<TInput = unknown> =
  StandardSchemaV1<unknown, TInput> | StandardJSONSchemaV1<unknown, TInput> | JsonObject;
export type PublicToolOutputSchema<TOutput = unknown> =
  StandardJSONSchemaV1<unknown, TOutput> | JsonObject;
export type ToolContext = SessionContext & {
  readonly abortSignal: AbortSignal;
  readonly callId: string;
  readonly toolName: string;
  readonly messages: readonly ModelMessage[];
  getToken(provider: ToolAuthProvider, options?: ToolAuthOptions): Promise<TokenResult>;
  requireAuth(provider: ToolAuthProvider, options?: ToolAuthOptions): never;
  readonly approval?: ApprovedCall;
};
interface ToolDefinitionBase {
  readonly availableInSubagents?: boolean;
  readonly deferred?: boolean;
  readonly description: string;
}
type ApprovalContextInput<TInput> = unknown extends TInput ? Record<string, unknown> : TInput;
```

### src/tools/model-output.d.ts

```ts
export type ToolModelOutput =
  | {
      readonly type: "text";
      readonly value: string;
    }
  | {
      readonly type: "json";
      readonly value: unknown;
    }
  | {
      readonly type: "content";
      readonly value: readonly ToolModelOutputPart[];
    };
export type ToolModelOutputPart =
  | {
      readonly type: "text";
      readonly text: string;
    }
  | {
      readonly type: "file";
      readonly data: {
        readonly type: "data";
        readonly data: string;
      };
      readonly mediaType: string;
      readonly filename?: string;
    };
```
