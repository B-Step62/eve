export interface SessionRequestDiagnostic {
  readonly startedAt: string;
  readonly path: string;
  finishedAt?: string;
  status?: number;
  sessionId?: string;
  deliveryId?: string;
  errorCode?: string;
}

/** Internal per-client eval instrumentation, not part of the public SDK. */
export const sessionDiagnostics = Symbol("sessionDiagnostics");

export async function sessionFetch(
  url: string,
  init: RequestInit,
  records?: SessionRequestDiagnostic[],
): Promise<Response> {
  if (records === undefined || records.length >= 100) return await fetch(url, init);
  const record: SessionRequestDiagnostic = {
    startedAt: new Date().toISOString(),
    path: new URL(url).pathname,
  };
  records.push(record);
  try {
    const response = await fetch(url, init);
    record.status = response.status;
    const raw: unknown = await response
      .clone()
      .json()
      .catch(() => null);
    if (raw !== null && typeof raw === "object") {
      const body = raw as Record<string, unknown>;
      for (const key of ["sessionId", "deliveryId"] as const) {
        if (typeof body[key] === "string") record[key] = body[key];
      }
      if (typeof body.code === "string") record.errorCode = body.code;
    }
    return response;
  } catch (error) {
    record.errorCode = error instanceof Error ? error.name : "UnknownError";
    throw error;
  } finally {
    record.finishedAt = new Date().toISOString();
  }
}
