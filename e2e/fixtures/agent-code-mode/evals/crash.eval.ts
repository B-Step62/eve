import { defineEval } from "eve/evals";
export default defineEval({
  description:
    "A worker crash after a side effect produces an unknown outcome without repeating any completed call.",
  timeoutMs: 120000,
  async test(t) {
    if (t.target.kind !== "local") t.skip("Requires the local dev worker crash/restart harness.");
    const done = await t.send(
      "CRASH: Use eve__execute to call count({}), then crash({}). Catch the crash error and return { before, unknown, counts: await tools.counters({}) }.",
    );
    done.expectOk();
    done.messageIncludes('"interpreter":{"startupMs":');
    done.messageIncludes('"runMs":');
    done.messageIncludes('"before":1');
    done.messageIncludes("side effect may or may not have happened");
    done.messageIncludes('"counts":{"count":1,"crash":1,"counters":1}');
    t.succeeded();
  },
});
