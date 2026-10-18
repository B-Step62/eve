# eve/ai

## Export names

- DecisionAnswer: src/ai/decision-types.d.ts#DecisionAnswer
- DecisionInput: src/ai/decision-types.d.ts#DecisionInput
- DecisionModel: src/ai/decision-types.d.ts#DecisionModel
- DecisionOptions: src/ai/decision-types.d.ts#DecisionOptions
- DecisionQuestion: src/ai/decision-types.d.ts#DecisionQuestion
- DecisionResult: src/ai/decision-types.d.ts#DecisionResult
- DecisionState: src/ai/decision-types.d.ts#DecisionState
- DecisionStatePart: src/ai/decision-types.d.ts#DecisionStatePart
- decide: src/ai/decide.d.ts#decide

## Peer boundaries

## Declaration closure

### src/ai/decide.d.ts

```ts
export declare function decide<const Questions extends Readonly<Record<string, DecisionQuestion>>>(
  options: DecisionOptions<Questions>,
): Promise<DecisionResult<Questions>>;
```

### src/ai/decision-types.d.ts

```ts
export interface DecisionOptions<Questions extends Readonly<Record<string, DecisionQuestion>>> {
  readonly model?: DecisionModel;
  readonly state: DecisionState;
  readonly questions: Questions;
  readonly maxRetries?: number;
  readonly signal?: AbortSignal;
}
export interface DecisionResult<Questions extends Readonly<Record<string, DecisionQuestion>>> {
  readonly answers: {
    readonly [Id in keyof Questions]: DecisionAnswer<Questions[Id]>;
  };
  readonly usage: {
    readonly inputTokens: number | undefined;
    readonly outputTokens: number | undefined;
    readonly totalTokens: number | undefined;
  };
}
export type DecisionAnswer<Q extends DecisionQuestion> = Q extends {
  type: "choice";
  criteria: infer Criteria;
}
  ? {
      readonly type: "choice";
      readonly choice: Extract<keyof Criteria, string>;
      readonly probabilities?: Readonly<Record<Extract<keyof Criteria, string>, number>>;
    }
  : Q extends {
        type: "score";
      }
    ? {
        readonly type: "score";
        readonly score: number;
        readonly probabilities?: Readonly<Record<string, number>>;
      }
    : {
        readonly type: "boolean";
        readonly probability: number;
      };
export type DecisionInput = string | JsonObject | readonly JsonValue[];
export type DecisionModel =
  | string
  | ({
      readonly provider: string;
      readonly modelId: string;
      readonly specificationVersion: string;
    } & (
      | {
          readonly doDecide: (...args: never[]) => unknown;
        }
      | {
          readonly doEvaluate: (...args: never[]) => unknown;
        }
    ));
export type DecisionQuestion =
  | {
      readonly type: "choice";
      readonly instructions: DecisionInput;
      readonly criteria: Readonly<Record<string, DecisionInput | null>>;
    }
  | {
      readonly type: "score";
      readonly instructions: DecisionInput;
      readonly criteria: readonly (DecisionInput | null)[];
    }
  | {
      readonly type: "boolean";
      readonly instructions: DecisionInput;
      readonly criteria?: {
        readonly true?: DecisionInput | null;
        readonly false?: DecisionInput | null;
      };
    };
export type DecisionState = string | JsonObject | readonly DecisionStatePart[];
export type DecisionStatePart =
  | Extract<
      Exclude<UserContent, string>[number],
      {
        type: "text" | "file";
      }
    >
  | {
      readonly type: "json";
      readonly value: JsonValue;
    };
type UserContent = Extract<
  HistoryMessage,
  {
    role: "user";
  }
>["content"];
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
