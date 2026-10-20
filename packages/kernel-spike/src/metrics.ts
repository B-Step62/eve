// Measures one Workflow run through the World API, the same way for eve and
// for host B: steps, events, and the bytes the run wrote as event data.

interface ListPage<T> {
  data: T[];
  cursor?: string | null;
  hasMore?: boolean;
}

interface WorldLike {
  steps: { list(q: unknown): Promise<ListPage<{ stepName: string }>> };
  events: { list(q: unknown): Promise<ListPage<unknown>> };
}

export interface RunMetrics {
  steps: number;
  events: number;
  /** JSON size of every event with its data resolved. */
  bytes: number;
  stepNames: Record<string, number>;
}

async function all<T>(list: (cursor?: string) => Promise<ListPage<T>>): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await list(cursor);
    out.push(...page.data);
    if (!page.hasMore || !page.cursor) return out;
    cursor = page.cursor;
  }
}

export async function measureRun(world: WorldLike, runId: string): Promise<RunMetrics> {
  const page = (cursor?: string) => {
    const pagination: { limit: number; cursor?: string } = { limit: 1000 };
    if (cursor) pagination.cursor = cursor;
    return pagination;
  };
  const steps = await all((c) =>
    world.steps.list({ runId, resolveData: "none", pagination: page(c) }),
  );
  const events = await all((c) =>
    world.events.list({ runId, resolveData: "all", pagination: page(c) }),
  );
  const stepNames: Record<string, number> = {};
  for (const s of steps) {
    const name = s.stepName.split("//").pop() ?? s.stepName;
    stepNames[name] = (stepNames[name] ?? 0) + 1;
  }
  return {
    steps: steps.length,
    events: events.length,
    bytes: events.reduce<number>((n, e) => n + JSON.stringify(e).length, 0),
    stepNames,
  };
}
