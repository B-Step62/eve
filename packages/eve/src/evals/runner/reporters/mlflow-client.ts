import { createHash, randomBytes } from "node:crypto";
import type { EveEval, EveEvalResult, EveEvalRunSummary, EveEvalTarget } from "#evals/types.js";
import {
  composeAssertionScoreMetadata,
  exportedAssertionName,
  groupAssertionScores,
} from "#evals/runner/reporters/assertion-scores.js";

export interface MlflowRecordingOptions {
  readonly recordInputs: boolean;
  readonly recordOutputs: boolean;
  readonly recordErrors: boolean;
  readonly recordAssertionDetails: boolean;
}

export interface MlflowReporterClient {
  createRun(experimentId: string, runName: string, target: EveEvalTarget): Promise<string>;
  logSummary(runId: string, summary: EveEvalRunSummary): Promise<void>;
  endRun(runId: string, status: "FINISHED" | "FAILED", endTime: string): Promise<void>;
  logEval(
    experimentId: string,
    runId: string,
    result: EveEvalResult,
    evaluation: EveEval | undefined,
    recording: MlflowRecordingOptions,
  ): Promise<void>;
  experimentUrl(experimentId: string): string;
}

interface MlflowAuthProvider {
  getHost(): string;
  getHeadersProvider(): () => Promise<Record<string, string>>;
}

interface MlflowTraceInfo {
  readonly traceId: string;
}

interface MlflowSdkClient {
  createTrace(info: { toJson(): Record<string, unknown> }): Promise<MlflowTraceInfo>;
  uploadTraceData(
    info: MlflowTraceInfo,
    data: { toJson(): Record<string, unknown> },
  ): Promise<void>;
}

interface MlflowSdk {
  createAuthProvider(options: { trackingUri: string }): MlflowAuthProvider;
  MlflowClient: new (options: {
    trackingUri: string;
    authProvider: MlflowAuthProvider;
  }) => MlflowSdkClient;
}

const MLFLOW_PACKAGE = "@mlflow/core";

export async function resolveMlflowClient(trackingUri: string): Promise<MlflowReporterClient> {
  let sdk: MlflowSdk;
  try {
    sdk = (await import(MLFLOW_PACKAGE)) as MlflowSdk;
  } catch {
    throw new Error(
      "The '@mlflow/core' package is required for MLflow reporting. Install it with: npm install @mlflow/core",
    );
  }
  if (typeof sdk.createAuthProvider !== "function" || typeof sdk.MlflowClient !== "function") {
    throw new Error("MLflow reporting requires @mlflow/core@0.4.0 or newer.");
  }

  const auth = sdk.createAuthProvider({ trackingUri });
  const client = new sdk.MlflowClient({ trackingUri, authProvider: auth });
  if (typeof client.createTrace !== "function" || typeof client.uploadTraceData !== "function") {
    throw new Error("MLflow reporting requires @mlflow/core@0.4.0 or newer.");
  }
  const host = auth.getHost().replace(/\/$/, "");
  const headersProvider = auth.getHeadersProvider();
  const databricks = trackingUri === "databricks" || trackingUri.startsWith("databricks://");

  async function request(path: string, body: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${host}${path}`, {
        method: "POST",
        headers: { ...(await headersProvider()), "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new Error("MLflow reporting request failed. Check the tracking URI and credentials.");
    }
    if (!response.ok) {
      throw new Error(`MLflow reporting request failed (HTTP ${response.status}).`);
    }
    return response.status === 204 ? undefined : response.json();
  }

  return {
    async createRun(experimentId, runName, target) {
      const response = await request("/api/2.0/mlflow/runs/create", {
        experiment_id: experimentId,
        run_name: runName,
        start_time: Date.now(),
        tags: [
          { key: "mlflow.runType", value: "genai_evaluate" },
          { key: "eveTargetKind", value: target.kind },
        ],
      });
      const runId = getRunId(response);
      if (!runId) throw new Error("MLflow did not return a run id when creating the eval run.");
      return runId;
    },

    async logSummary(runId, summary) {
      const values: Record<string, number> = {
        "eve/total": summary.results.length,
        "eve/passed": summary.passed,
        "eve/failed": summary.failed,
        "eve/scored": summary.scored,
        "eve/skipped": summary.skipped,
        "eve/errored": summary.errored,
      };
      const scores = new Map<string, number[]>();
      for (const result of summary.results) {
        for (const [name, score] of assertionScores(result)) {
          const group = scores.get(name) ?? [];
          group.push(score);
          scores.set(name, group);
        }
      }
      for (const [name, group] of scores) {
        values[`${assessmentName(name)}/mean`] =
          group.reduce((total, score) => total + score, 0) / group.length;
      }
      const metrics = Object.entries(values).map(([key, value]) => ({
        key,
        value,
        timestamp: Date.parse(summary.completedAt),
        step: 0,
      }));
      for (let offset = 0; offset < metrics.length; offset += 1000) {
        await request("/api/2.0/mlflow/runs/log-batch", {
          run_id: runId,
          metrics: metrics.slice(offset, offset + 1000),
        });
      }
    },

    async endRun(runId, status, endTime) {
      await request("/api/2.0/mlflow/runs/update", {
        run_id: runId,
        status,
        end_time: Date.parse(endTime),
      });
    },

    async logEval(experimentId, runId, result, evaluation, recording) {
      const traceHex = randomBytes(16).toString("hex");
      const spanHex = randomBytes(8).toString("hex");
      const traceId = `tr-${traceHex}`;
      const startedAt = Date.parse(result.startedAt);
      const completedAt = Date.parse(result.completedAt);
      const input = evaluation?.description ?? result.id;
      const output = result.result.output ?? "";
      const metadata: Record<string, string> = {
        "mlflow.trace_schema.version": "3",
        "mlflow.sourceRun": runId,
        eveEvalId: result.id,
        eveStatus: result.result.status,
        eveVerdict: result.verdict,
      };
      if (result.result.sessionId) metadata.eveSessionId = result.result.sessionId;
      const traceInfo: Record<string, unknown> = {
        trace_id: traceId,
        trace_location: {
          type: "MLFLOW_EXPERIMENT",
          mlflow_experiment: { experiment_id: experimentId },
        },
        request_time: result.startedAt,
        execution_duration: `${Math.max(0, completedAt - startedAt) / 1000}s`,
        state: result.error ? "ERROR" : "OK",
        trace_metadata: metadata,
        tags: { "mlflow.traceName": result.id },
      };
      if (recording.recordInputs) traceInfo.request_preview = tracePreview(input);
      if (recording.recordOutputs) traceInfo.response_preview = tracePreview(output);
      const info = await client
        .createTrace({
          toJson: () => traceInfo,
        })
        .catch(() => {
          throw new Error(
            "MLflow trace creation failed. Check the tracking server and experiment id.",
          );
        });
      const attributes: Record<string, unknown> = {
        "mlflow.traceRequestId": info.traceId,
        "mlflow.spanType": "CHAIN",
        "mlflow.experimentId": experimentId,
        eveEvalId: result.id,
        eveVerdict: result.verdict,
        eveTraceContexts: result.result.traceContexts,
      };
      if (recording.recordInputs) attributes["mlflow.spanInputs"] = input;
      if (recording.recordOutputs) attributes["mlflow.spanOutputs"] = output;
      if (recording.recordErrors && result.error) attributes.eveError = result.error;
      if (recording.recordAssertionDetails) {
        // Trace metadata truncates long values; span artifacts retain the full details.
        attributes.eveAssertionScores = composeAssertionScoreMetadata(result.assertions);
        attributes.eveFailedAssertions = result.assertions.filter(
          (assertion) => assertion.passed === false,
        );
      }
      const status: { code: string; message?: string } = {
        code: result.error ? "STATUS_CODE_ERROR" : "STATUS_CODE_OK",
      };
      if (recording.recordErrors && result.error) status.message = result.error;
      await client
        .uploadTraceData(info, {
          toJson: () => ({
            spans: [
              {
                trace_id: Buffer.from(traceHex, "hex").toString("base64"),
                span_id: Buffer.from(spanHex, "hex").toString("base64"),
                parent_span_id: "",
                name: result.id,
                start_time_unix_nano: BigInt(startedAt) * 1_000_000n,
                end_time_unix_nano: BigInt(completedAt) * 1_000_000n,
                status,
                attributes,
                events: [],
              },
            ],
          }),
        })
        .catch(() => {
          throw new Error(
            "MLflow trace data upload failed. Check the experiment's artifact storage.",
          );
        });
      for (const [name, score] of assertionScores(result)) {
        const assessmentMetadata: Record<string, string> = {
          "mlflow.assessment.sourceRunId": runId,
        };
        if (recording.recordAssertionDetails) assessmentMetadata.eveAssertionName = name;
        await request(`/api/3.0/mlflow/traces/${encodeURIComponent(info.traceId)}/assessments`, {
          assessment: {
            assessment_name: assessmentName(name),
            trace_id: info.traceId,
            span_id: spanHex,
            source: { source_type: "CODE", source_id: "eve" },
            feedback: { value: score },
            metadata: assessmentMetadata,
          },
        });
      }
    },

    experimentUrl(experimentId) {
      const url = new URL(host);
      url.username = "";
      url.password = "";
      url.search = "";
      url.hash = databricks
        ? `/mlflow/experiments/${encodeURIComponent(experimentId)}`
        : `/experiments/${encodeURIComponent(experimentId)}`;
      return url.toString();
    },
  };
}

function assertionScores(result: EveEvalResult): Map<string, number> {
  const groups = groupAssertionScores(
    result.assertions.filter(
      (assertion) => assertion.errored !== true && Number.isFinite(assertion.score),
    ),
    exportedAssertionName,
  );
  const scores = new Map<string, number>();
  for (const [name, group] of groups) {
    if (group.score !== undefined) scores.set(name, group.score);
  }
  return scores;
}

function assessmentName(name: string): string {
  const normalized = name.replace(/[^a-zA-Z0-9_\-: ]/g, "_");
  // MLflow metric keys allow 250 characters, including the /mean suffix.
  if (normalized === name && name.length <= 245) return name;
  return `${normalized.slice(0, 236)}_${createHash("sha256").update(name).digest("hex").slice(0, 8)}`;
}

function tracePreview(value: unknown): string {
  const serialized = JSON.stringify(value);
  // OSS tracking stores cap preview columns at 1000; full values live in span data.
  return serialized.length > 1000 ? `${serialized.slice(0, 997)}...` : serialized;
}

function getRunId(response: unknown): string | undefined {
  if (!response || typeof response !== "object" || !("run" in response)) return undefined;
  const run = response.run;
  if (!run || typeof run !== "object" || !("info" in run)) return undefined;
  const info = run.info;
  return info && typeof info === "object" && "run_id" in info && typeof info.run_id === "string"
    ? info.run_id
    : undefined;
}
