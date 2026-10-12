import { defineChannel, GET } from "eve/channels";
import { getWorld } from "workflow/api";

/** Fixture-only, metadata-only endpoint queried by the harness after a failure. */
export default defineChannel({
  routes: [
    GET("/fixture-workflow-diagnostics/:runId", async (_request, { params }) => {
      const { runId } = params;
      if (process.env.EVE_E2E_WORKFLOW_DIAGNOSTICS !== "true" || !/^wrun_[A-Za-z0-9]+$/.test(runId))
        return new Response(null, { status: 404 });
      const world = await getWorld();
      const run = await world.runs.get(runId, { resolveData: "none" });
      const events = [];
      let cursor: string | undefined;
      do {
        const page = await world.events.list({
          runId,
          resolveData: "none",
          pagination: { limit: 1000, cursor },
        });
        events.push(
          ...page.data.map((event) => ({
            eventId: event.eventId,
            eventType: event.eventType,
            createdAt: event.createdAt,
            correlationId: event.correlationId,
            stepName:
              "stepName" in (event.eventData ?? {})
                ? (event.eventData as { stepName?: string }).stepName
                : undefined,
          })),
        );
        cursor = page.hasMore && page.cursor !== null ? page.cursor : undefined;
      } while (cursor !== undefined && events.length < 2000);
      const deliveries = await world.streams.getChunks(runId, "e2e-queue-attempts", {
        limit: 1000,
      });
      return Response.json({
        runId,
        status: run.status,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        capturedAt: new Date().toISOString(),
        events,
        truncated: cursor !== undefined || deliveries.hasMore,
        deliveriesUnavailable: "unavailable" in deliveries,
        deliveries: deliveries.data.map((chunk) =>
          JSON.parse(new TextDecoder().decode(chunk.data)),
        ),
      });
    }),
  ],
});
