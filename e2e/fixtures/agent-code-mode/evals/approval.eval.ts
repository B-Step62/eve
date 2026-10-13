import { defineEval } from "eve/evals";
export default defineEval({
  description:
    "Code execution parks for a nested approval and does not repeat earlier calls when resumed.",
  async test(t) {
    const parked = await t.send(
      "Use eve__execute to call count({}), gated({}), then count({}), sequentially. Return { before, approved, after }.",
    );
    parked.session.requireInputRequest({
      toolName: "gated",
      display: "confirmation",
      optionIds: ["approve", "cancel"],
    });
    const done = await parked.session.respondAll("approve");
    done.expectOk();
    done.messageIncludes('"interpreter":{"startupMs":');
    done.messageIncludes('"runMs":');
    done.messageIncludes('"before":1');
    done.messageIncludes('"after":2');
    done.messageIncludes('"approved":"approved"');
    done.messageIncludes('"counts":{"count":2,"gated":1,"counters":1}');
    t.succeeded();
  },
});
