import {
  createCodeModeTool,
  unwrapCodeModeResult,
} from "#compiled/experimental-ai-sdk-code-mode/index.js";
import { installCodeModeRuntimeModule } from "#shared/code-mode-runtime.js";

installCodeModeRuntimeModule({ createCodeModeTool, unwrapCodeModeResult });

export default function installCodeModeRuntimePlugin(): void {}
