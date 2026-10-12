import { afterEach, expect, it, vi } from "vitest";
import { sessionFetch, type SessionRequestDiagnostic } from "./session-diagnostics.js";

afterEach(() => vi.unstubAllGlobals());

it("records only safe metadata and preserves the response body", async () => {
  const response = Response.json({
    sessionId: "wrun_test",
    deliveryId: "req_test",
    secret: "never-retain",
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  const records: SessionRequestDiagnostic[] = [];
  const actual = await sessionFetch(
    "https://example.com/eve/v1/session?token=secret",
    {
      method: "POST",
      headers: { authorization: "secret" },
      body: "secret",
    },
    records,
  );
  expect(records).toEqual([
    {
      startedAt: expect.any(String),
      finishedAt: expect.any(String),
      path: "/eve/v1/session",
      status: 200,
      sessionId: "wrun_test",
      deliveryId: "req_test",
    },
  ]);
  expect(await actual.json()).toHaveProperty("secret", "never-retain");
  expect(JSON.stringify(records)).not.toContain("secret");
});

it("retains a pending request at the deadline, then its transport outcome without error text", async () => {
  let reject!: (error: Error) => void;
  vi.stubGlobal(
    "fetch",
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  const records: SessionRequestDiagnostic[] = [];
  const request = sessionFetch("https://example.com/eve/v1/session/wrun_test", {}, records);
  expect(records[0]).not.toHaveProperty("finishedAt");
  reject(new Error("secret transport details"));
  await expect(request).rejects.toThrow("secret transport details");
  expect(records[0]!.errorCode).toBe("Error");
  expect(JSON.stringify(records)).not.toContain("secret");
});

it("does not parse a response without an observer", async () => {
  const response = Response.json({ sessionId: "wrun_test" });
  const clone = vi.spyOn(response, "clone");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  expect(await sessionFetch("https://example.com", {})).toBe(response);
  expect(clone).not.toHaveBeenCalled();
});
