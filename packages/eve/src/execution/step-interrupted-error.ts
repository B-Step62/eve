import { FatalError } from "#compiled/@workflow/core/index.js";

/** Fatal to the workflow, with a stable identity after the SDK serializes the error. */
export class StepInterruptedError extends FatalError {
  constructor(message: string) {
    super(message);
    this.name = "StepInterruptedError";
  }
}
