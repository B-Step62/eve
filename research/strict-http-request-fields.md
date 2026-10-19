---
issue: "None (maintainer proposal; related PR #4930)"
status: draft
last_updated: "2026-10-19"
---

# Reject unknown HTTP request fields

## Decision

Before 1.0, reject unrecognized top-level fields in framework-owned HTTP JSON
request bodies with **400 Bad Request**. Name the unknown field and list the
accepted fields for the matched route. This is a proposed breaking change, not
implemented behavior.

Today, session parsers read the fields they recognize and ignore remaining keys,
with a few explicit exceptions. A typo such as `outputschema`, an option from a
newer client, or a field sent to the wrong route can succeed without its intended
effect. The response gives people and agents no indication of how to correct the
request.

## Request contract

Each route has an explicit set of accepted top-level fields. Check every supplied
key against that set; field names are case-sensitive. Do not strip unknown keys,
correct their spelling, or accept the union of fields from unrelated routes.

An illustrative message-route response is:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json
```

```json
{
  "ok": false,
  "error": "Unknown field 'outputschema'. Accepted fields: message, answers, clientContext, outputSchema, turnPolicy, callback."
}
```

The accepted-field list must describe the actual route and supported protocol,
including any recognized protocol-specific fields. The example uses the planned
`answers` vocabulary from [the pre-1.0 API cleanup](https://github.com/vercel/eve/pull/4930);
main currently uses `inputResponses`.

For multiple unknown fields, identify them in a deterministic order and include
the accepted-field list. Report field names, not request values. A fieldless
control route rejects any supplied top-level field; an empty object or absent
body remains valid where already supported.

Preserve authentication and authorization checks. Reject invalid fields before
admitting work, calling authored message handlers, or dispatching a control. A
400 must not create a session, enqueue a delivery, or partially apply a command.
Do not replace an authentication failure with request-field diagnostics.

Known fields still require their existing type, value, and combination checks.
For example, recognizing `outputSchema` does not make every value valid or allow
it on a route where it has no defined effect.

## Scope and compatibility

Apply this rule to eve-owned JSON request envelopes, starting with session
creation, follow-up messages and answers, and session control routes. Keep each
route's accepted fields with its input contract rather than maintaining a second,
independent list for diagnostics.

This proposal does not recursively close arbitrary JSON values. Declared open
objects such as `clientContext` and application data retain their contracts.
It does not impose a universal schema on authored routes, third-party webhook
payloads, HTTP headers, query parameters, or non-JSON transports.

Supported protocol fields must be explicitly recognized. Existing intentional
ignores, such as the legacy `activityObserver` field, need an explicit,
protocol-scoped no-op contract if retained. They are not permission to accept
arbitrary unknown fields.

A newer client that sends a new field to an older strict server receives a 400
instead of silently losing the requested behavior. This is the intended lasting
compatibility rule. A future `operationId` on follow-up messages must not be
silently discarded: doing so could change retry or deduplication semantics.
Clients must not automatically remove behavior-changing fields and retry.

For purely advisory hints, define an explicit way to ignore unsupported hints
safely when that need exists. The envelope must already be recognized by the
older server, or its use must be negotiated. Adding another unknown top-level
field cannot bypass strict validation. No generic hints container or permissive
compatibility switch is proposed here.

## Implementation and validation boundary

The session parsers in
[`request.ts`](../packages/eve/src/eve-channel/request.ts) currently select fields
and contain route-specific rejections. The
[create-request tests](../packages/eve/src/eve-channel/request.test.ts) also
explicitly cover ignoring a legacy activity observer. Audit these intentional
exceptions when defining the route contracts; do not infer accepted fields only
from the object eventually passed to execution.

Implementation should prove that typos and wrong-route fields produce actionable
400s without admission or authored-handler side effects. Cover multiple unknown
fields, fieldless controls, legitimate protocol fields, and newer-client fields
reaching an older strict contract. Preserve valid requests, existing value
validation, and declared open JSON payloads. Add deterministic HTTP fixture evals
for the rejection and corrected-request paths; run them in CI.
