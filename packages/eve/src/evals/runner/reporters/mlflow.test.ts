import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MLflow } from "#evals/reporters/index.js";
import type { EveEval, EveEvalResult, EveEvalRunSummary, EveEvalTarget } from "#evals/types.js";

const sdk = vi.hoisted(() => ({
  createTrace: vi.fn(),
  uploadTraceData: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@mlflow/core", () => ({
  createAuthProvider: () => ({
    getHost: () => "https://mlflow.example.test",
    getHeadersProvider: () => sdk.headers,
  }),
  MlflowClient: class {
    createTrace = sdk.createTrace;
    uploadTraceData = sdk.uploadTraceData;
  },
}));

const target: EveEvalTarget = {
  kind: "local",
  url: "http://user:password@localhost:3000/private?token=secret",
  capabilities: { devRoutes: true },
};
const evaluation: EveEval = {
  _tag: "EveEval",
  id: "weather",
  description: "Weather in Brooklyn",
  test: async () => {},
};

function result(overrides: Partial<EveEvalResult> = {}): EveEvalResult {
  return {
    id: "weather",
    verdict: "passed",
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:01.000Z",
    assertions: [
      { name: "succeeded", score: 1, severity: "gate", passed: true, errored: false },
      { name: "judge.boolean", key: "quality", score: 0.8, severity: "soft", errored: false },
      { name: "judge.boolean", key: "quality", score: 0.6, severity: "soft", errored: false },
      { name: "errored", severity: "soft", errored: true, message: "judge unavailable" },
    ],
    result: {
      output: "Sunny",
      finalMessage: "Sunny",
      status: "completed",
      events: [],
      traceContexts: [],
      derived: {
        toolCalls: [],
        toolCallCount: 0,
        skillLoads: [],
        subagentCalls: [],
        subagentCallCount: 0,
        inputRequests: [],
        parked: false,
        messageCount: 1,
        reasoningBlockCount: 0,
        models: [],
      },
    },
    ...overrides,
  };
}

function summary(results: EveEvalResult[]): EveEvalRunSummary {
  return {
    target,
    results,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:02.000Z",
    passed: results.filter((entry) => entry.verdict === "passed").length,
    failed: results.filter((entry) => entry.verdict === "failed").length,
    scored: 0,
    skipped: 0,
    errored: results.filter((entry) => entry.error !== undefined).length,
  };
}

function uploadedSpanAttributes(index = 0): Record<string, unknown> {
  const artifact = JSON.parse(
    JSON.stringify(sdk.uploadTraceData.mock.calls[index]?.[1].toJson(), (_, value) =>
      typeof value === "bigint" ? String(value) : value,
    ),
  ) as { spans: { attributes: Record<string, string> }[] };
  // MLflow decodes each JSON attribute once after reading the artifact JSON.
  return Object.fromEntries(
    Object.entries(artifact.spans[0]!.attributes).map(([key, value]) => {
      try {
        return [key, JSON.parse(value)];
      } catch {
        return [key, value];
      }
    }),
  );
}

describe("MLflow", () => {
  const requests: { url: string; body: Record<string, unknown>; headers: unknown }[] = [];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    requests.length = 0;
    sdk.createTrace.mockImplementation(async () => ({
      traceId: `tr-server-${sdk.createTrace.mock.calls.length}`,
    }));
    sdk.uploadTraceData.mockResolvedValue(undefined);
    sdk.headers.mockImplementation(async () => ({
      Authorization: `Bearer token-${requests.length}`,
    }));
    fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      requests.push({ url, body: JSON.parse(String(init.body)), headers: init.headers });
      return new Response(
        JSON.stringify(url.endsWith("/runs/create") ? { run: { info: { run_id: "run-1" } } } : {}),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uploads full eval traces and assessments linked to one run, then records aggregate results", async () => {
    const reporter = MLflow({ experimentId: "123", runName: "weather checks" });
    const first = result();
    const second = result({
      assertions: [{ name: "quality", score: 1, severity: "soft", errored: false }],
    });
    await reporter.onRunStart([evaluation], target);
    await reporter.onEvalComplete(first);
    await reporter.onEvalComplete(second);
    await reporter.onRunComplete(summary([first, second]));

    expect(requests[0]?.body).toMatchObject({ experiment_id: "123", run_name: "weather checks" });
    expect(sdk.createTrace).toHaveBeenCalledTimes(2);
    const info = sdk.createTrace.mock.calls[0]?.[0].toJson();
    expect(info).toMatchObject({
      trace_location: { type: "MLFLOW_EXPERIMENT", mlflow_experiment: { experiment_id: "123" } },
      request_time: first.startedAt,
      execution_duration: "1s",
      state: "OK",
      request_preview: JSON.stringify("Weather in Brooklyn"),
      response_preview: JSON.stringify("Sunny"),
      trace_metadata: {
        "mlflow.trace_schema.version": "3",
        "mlflow.sourceRun": "run-1",
        eveEvalId: "weather",
        eveVerdict: "passed",
      },
    });
    const data = sdk.uploadTraceData.mock.calls[0]?.[1].toJson();
    expect(data.spans).toHaveLength(1);
    expect(data.spans[0]).toMatchObject({
      parent_span_id: "",
      start_time_unix_nano: 1767225600000000000n,
      end_time_unix_nano: 1767225601000000000n,
    });
    expect(uploadedSpanAttributes()).toMatchObject({
      "mlflow.spanInputs": "Weather in Brooklyn",
      "mlflow.spanOutputs": "Sunny",
    });
    const assessments = requests.filter((entry) => entry.url.endsWith("/assessments"));
    expect(assessments.map((entry) => entry.body.assessment)).toEqual([
      expect.objectContaining({ assessment_name: "gate:succeeded", feedback: { value: 1 } }),
      expect.objectContaining({ assessment_name: "quality", feedback: { value: 0.6 } }),
      expect.objectContaining({ assessment_name: "quality", feedback: { value: 1 } }),
    ]);
    expect(assessments[0]?.body.assessment).toMatchObject({
      trace_id: "tr-server-1",
      span_id: Buffer.from(data.spans[0].span_id, "base64").toString("hex"),
      source: { source_type: "CODE", source_id: "eve" },
      metadata: { "mlflow.assessment.sourceRunId": "run-1" },
    });
    const metrics = requests.find((entry) => entry.url.endsWith("/log-batch"))?.body.metrics;
    expect(metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "eve/passed", value: 2 }),
        expect.objectContaining({ key: "quality/mean", value: 0.8 }),
      ]),
    );
    expect(requests.at(-1)?.body).toMatchObject({ run_id: "run-1", status: "FINISHED" });
    expect(requests.map((entry) => entry.headers)).toEqual(
      requests.map((_, index) =>
        expect.objectContaining({ Authorization: `Bearer token-${index}` }),
      ),
    );
    expect(JSON.stringify(requests)).not.toContain(target.url);
    expect(console.log).toHaveBeenCalledWith(
      "MLflow experiment: https://mlflow.example.test/#/experiments/123\n",
    );
  });

  it("preserves text and structured values through MLflow's artifact decoder", async () => {
    const outputs = [
      "5",
      '{"answer":"Jupiter"}',
      "true",
      "null",
      "",
      { answer: "Jupiter", count: 5, enabled: true, nothing: null, text: '{"planet":"Mars"}' },
    ];
    for (const output of outputs) {
      const input = typeof output === "string" ? output : "5";
      const reporter = MLflow({ experimentId: "123" });
      const completed = result({ result: { ...result().result, output }, assertions: [] });
      await reporter.onRunStart([{ ...evaluation, description: input }], target);
      await reporter.onEvalComplete(completed);
      await reporter.onRunComplete(summary([completed]));

      const attributes = uploadedSpanAttributes(sdk.uploadTraceData.mock.calls.length - 1);
      expect(attributes["mlflow.spanInputs"]).toStrictEqual(input);
      expect(attributes["mlflow.spanOutputs"]).toStrictEqual(output);
      expect(attributes["mlflow.experimentId"]).toBe("123");
    }
  });

  it("omits disabled content from metadata, span data, and assessments while retaining scores", async () => {
    const reporter = MLflow({
      experimentId: "123",
      recordInputs: false,
      recordOutputs: false,
      recordErrors: false,
      recordAssertionDetails: false,
    });
    const failed = result({
      verdict: "failed",
      error: "private execution error",
      assertions: [
        {
          name: "quality",
          score: 0,
          passed: false,
          severity: "soft",
          errored: false,
          message: "private failure detail",
        },
      ],
    });
    await reporter.onRunStart([evaluation], target);
    await reporter.onEvalComplete(failed);
    await reporter.onRunComplete(summary([failed]));

    const info = sdk.createTrace.mock.calls[0]?.[0].toJson();
    const data = sdk.uploadTraceData.mock.calls[0]?.[1].toJson();
    const serialized = JSON.stringify({ info, data, requests }, (_, value) =>
      typeof value === "bigint" ? String(value) : value,
    );
    for (const content of [
      "Weather in Brooklyn",
      "Sunny",
      "private execution error",
      "private failure detail",
    ]) {
      expect(serialized).not.toContain(content);
    }
    expect(info.state).toBe("ERROR");
    expect(
      requests.find((entry) => entry.url.endsWith("/assessments"))?.body.assessment,
    ).toMatchObject({ feedback: { value: 0 } });
    expect(requests.at(-1)?.body.status).toBe("FAILED");
  });

  it("keeps colliding normalized labels distinct and ignores nonfinite scores", async () => {
    const reporter = MLflow({ experimentId: "123" });
    await reporter.onRunStart([evaluation], target);
    await reporter.onEvalComplete(
      result({
        assertions: [
          { name: "judge.boolean", score: 0.4, severity: "soft", errored: false },
          { name: "judge_boolean", score: 0.8, severity: "soft", errored: false },
          { name: "invalid", score: NaN, severity: "soft", errored: false },
        ],
      }),
    );
    const names = requests
      .filter((entry) => entry.url.endsWith("/assessments"))
      .map((entry) => (entry.body.assessment as Record<string, unknown>).assessment_name);
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
    expect(names).toContain("judge_boolean");
    expect(names.every((name) => !String(name).includes("."))).toBe(true);
  });

  it("marks the run failed if uploading span data fails and reports a safe error", async () => {
    const reporter = MLflow({ experimentId: "123" });
    await reporter.onRunStart([evaluation], target);
    sdk.uploadTraceData.mockRejectedValueOnce(new Error("artifact upload failed"));
    await expect(reporter.onEvalComplete(result())).rejects.toThrow(
      "MLflow trace data upload failed.",
    );
    expect(requests.at(-1)?.body.status).toBe("FAILED");
    const count = requests.length;
    await reporter.onRunComplete(summary([result()]));
    expect(requests).toHaveLength(count);
  });

  it("bounds previews and metric names while retaining full span values and distinct long labels", async () => {
    const reporter = MLflow({ experimentId: "123" });
    const input = "a".repeat(2000);
    const output = "b".repeat(2000);
    const failureMessage = "details".repeat(2000);
    const completed = result({
      result: {
        ...result().result,
        output,
        traceContexts: [
          {
            primary: true,
            sessionId: "session-1",
            traceId: "a".repeat(32),
            spanId: "b".repeat(16),
            traceFlags: 1,
          },
          {
            primary: false,
            sessionId: "session-2",
            traceId: "c".repeat(32),
            spanId: "d".repeat(16),
            traceFlags: 1,
          },
        ],
      },
      assertions: ["a", "b"].map((suffix) => ({
        name: "x".repeat(300) + suffix,
        score: 0,
        passed: false,
        message: failureMessage,
        severity: "soft" as const,
        errored: false,
      })),
    });
    await reporter.onRunStart([{ ...evaluation, description: input }], target);
    await reporter.onEvalComplete(completed);
    await reporter.onRunComplete(summary([completed]));
    const info = sdk.createTrace.mock.calls[0]?.[0].toJson();
    expect(info.request_preview.length).toBeLessThanOrEqual(1000);
    expect(info.response_preview.length).toBeLessThanOrEqual(1000);
    const attributes = uploadedSpanAttributes();
    expect(attributes).toMatchObject({
      "mlflow.spanInputs": input,
      "mlflow.spanOutputs": output,
    });
    expect(attributes.eveTraceContexts).toEqual(completed.result.traceContexts);
    expect(attributes.eveFailedAssertions).toEqual(completed.assertions);
    expect(Object.values(info.trace_metadata).every((value) => String(value).length <= 250)).toBe(
      true,
    );
    const names = requests
      .filter((entry) => entry.url.endsWith("/assessments"))
      .map((entry) => (entry.body.assessment as Record<string, string>).assessment_name);
    expect(new Set(names).size).toBe(2);
    const metrics = requests.find((entry) => entry.url.endsWith("/log-batch"))?.body.metrics as {
      key: string;
    }[];
    expect(metrics.every((metric) => metric.key.length <= 250)).toBe(true);
  });

  it("reports HTTP failures without exposing response bodies and closes the run", async () => {
    const reporter = MLflow({ experimentId: "123" });
    await reporter.onRunStart([evaluation], target);
    fetchMock.mockResolvedValueOnce(new Response("sensitive server details", { status: 401 }));
    await expect(reporter.onEvalComplete(result())).rejects.toThrow(
      "MLflow reporting request failed (HTTP 401).",
    );
    expect(requests.at(-1)?.body.status).toBe("FAILED");
  });

  it("rejects missing experiments and file tracking before creating a remote run", async () => {
    await expect(MLflow({ experimentId: "" }).onRunStart([evaluation], target)).rejects.toThrow(
      "MLFLOW_EXPERIMENT_ID",
    );
    await expect(
      MLflow({ experimentId: "123", trackingUri: "file:///tmp/mlruns" }).onRunStart(
        [evaluation],
        target,
      ),
    ).rejects.toThrow("HTTP(S) tracking server");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sdk.createTrace).not.toHaveBeenCalled();
  });
});
