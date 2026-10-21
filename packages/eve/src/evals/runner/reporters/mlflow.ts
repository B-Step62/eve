import type { EveEval, EveEvalResult, EveEvalRunSummary, EveEvalTarget } from "#evals/types.js";
import type { EvalReporter } from "#evals/runner/reporters/types.js";
import {
  resolveMlflowClient,
  type MlflowRecordingOptions,
  type MlflowReporterClient,
} from "#evals/runner/reporters/mlflow-client.js";

/** Configuration for the MLflow reporter. */
export interface MLflowReporterConfig {
  /** MLflow experiment id. Defaults to `MLFLOW_EXPERIMENT_ID`; one must be supplied. */
  readonly experimentId?: string;
  /** HTTP(S) tracking server or `databricks` / `databricks://profile`. Defaults to `MLFLOW_TRACKING_URI` or `http://127.0.0.1:5000`. */
  readonly trackingUri?: string;
  /** Name of the tracking run created for this invocation. Defaults to a timestamped eve eval run name. */
  readonly runName?: string;
  /** Include the eval description (or id) as trace input. Defaults to true. */
  readonly recordInputs?: boolean;
  /** Include eval output in the trace. Defaults to true. */
  readonly recordOutputs?: boolean;
  /** Include individual assertion details and failed assertion messages. Scores are always reported. Defaults to true. */
  readonly recordAssertionDetails?: boolean;
  /** Include execution error messages in traces. Defaults to true. */
  readonly recordErrors?: boolean;
}

/**
 * Reports each eval as an MLflow trace with assertion assessments, grouped under
 * one tracking run. Requires the optional `@mlflow/core` package and an MLflow 3
 * tracking server. A shared instance groups every eval that references it.
 */
export function MLflow(config: MLflowReporterConfig = {}): EvalReporter {
  return new MLflowReporter(config);
}

class MLflowReporter implements EvalReporter {
  readonly #config: MLflowReporterConfig;
  readonly #recording: MlflowRecordingOptions;
  readonly #evaluations = new Map<string, EveEval>();
  #client: MlflowReporterClient | undefined;
  #experimentId: string | undefined;
  #runId: string | undefined;

  constructor(config: MLflowReporterConfig) {
    this.#config = config;
    this.#recording = {
      recordInputs: config.recordInputs ?? true,
      recordOutputs: config.recordOutputs ?? true,
      recordAssertionDetails: config.recordAssertionDetails ?? true,
      recordErrors: config.recordErrors ?? true,
    };
  }

  async onRunStart(evaluations: readonly EveEval[], target: EveEvalTarget): Promise<void> {
    this.#client = undefined;
    this.#runId = undefined;
    this.#experimentId = undefined;
    this.#evaluations.clear();

    const experimentId = this.#config.experimentId ?? process.env.MLFLOW_EXPERIMENT_ID;
    if (!experimentId?.trim()) {
      throw new Error(
        'MLflow reporting requires an experiment id. Set MLFLOW_EXPERIMENT_ID or pass MLflow({ experimentId: "..." }).',
      );
    }
    const trackingUri =
      this.#config.trackingUri ?? process.env.MLFLOW_TRACKING_URI ?? "http://127.0.0.1:5000";
    if (!/^https?:\/\//.test(trackingUri) && !/^databricks(?::\/\/[^/?#]+)?$/.test(trackingUri)) {
      throw new Error(
        "MLflow reporting requires an HTTP(S) tracking server or a databricks tracking URI. Start a local server with 'mlflow server'.",
      );
    }

    const client = await resolveMlflowClient(trackingUri);
    this.#runId = await client.createRun(
      experimentId,
      this.#config.runName ?? `eve evals ${new Date().toISOString()}`,
      target,
    );
    this.#client = client;
    this.#experimentId = experimentId;
    for (const evaluation of evaluations) this.#evaluations.set(evaluation.id, evaluation);
  }

  async onEvalComplete(result: EveEvalResult): Promise<void> {
    if (!this.#client || !this.#runId || !this.#experimentId) return;
    try {
      await this.#client.logEval(
        this.#experimentId,
        this.#runId,
        result,
        this.#evaluations.get(result.id),
        this.#recording,
      );
    } catch (error) {
      await this.#failRun();
      throw error;
    }
  }

  async onRunComplete(summary: EveEvalRunSummary): Promise<void> {
    if (!this.#client || !this.#runId || !this.#experimentId) return;
    try {
      await this.#client.logSummary(this.#runId, summary);
      await this.#client.endRun(
        this.#runId,
        summary.failed > 0 ? "FAILED" : "FINISHED",
        summary.completedAt,
      );
      console.log(`MLflow experiment: ${this.#client.experimentUrl(this.#experimentId)}\n`);
      this.#runId = undefined;
    } catch (error) {
      await this.#failRun();
      throw error;
    }
  }

  async #failRun(): Promise<void> {
    const runId = this.#runId;
    this.#runId = undefined;
    if (!runId) return;
    // Preserve the upload error if marking the remote run failed also fails.
    await this.#client?.endRun(runId, "FAILED", new Date().toISOString()).catch(() => undefined);
  }
}
