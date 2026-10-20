---
issue: https://github.com/vercel/eve/pull/5061
status: implemented
last_updated: "2026-10-20"
---

# Session usage renewal across the delegation tree

With `limits.sessionUsage`, each session in a delegation tree checks its own
usage window. An Approve on one session's prompt started a new window only in
that session. A root that fanned out to two workers past the limit asked four
times for one overrun: once in the worker that crossed the limit, then in the
parent when that worker's reply landed, and again for each sibling still
spending in its old window.

## Renewal

One approved prompt now starts a new window in every session of the tree.

- Up: the approval travels to the root through the routing sessions that relay
  the prompt. Each one renews its own window when it delivers a non-cancel
  response.
- Down: each session that renews sends a `renew-window` payload to its started
  task runs and workflow tool runs. Each child applies it before its next
  budget check, or at once when it is parked, and sends it on to its own
  children.

Each renewal carries the id of the approved request. A session keeps the last
16 ids and ignores a repeat, so a renewal that reaches a session by two paths
starts one window, not two.

## Spend from before the window

A child's spend reaches its parent only when the child replies. After a
renewal, a reply that includes spend from the old window would count in the
parent's new window and ask again. The child now reports that part as
`beforeWindow` beside `usage`. The parent adds `usage` to its totals and moves
its window start by `beforeWindow`, so totals stay exact and only new spend
counts in the new window.

## Gaps

- A model call already in flight when the renewal arrives counts in the new
  window. That is at most one call per child.
- Remote agents keep their own windows. The renewal goes only to sessions in
  this deployment.
- Parallel children can still spend about N times the limit before the parent's
  next check. A tree-wide check is still a follow-up.

## Compatibility

`beforeWindow` is a new optional field on subagent results, so the extension
capabilities that see those results bump one epoch and keep the previous one.
A reply from an older deployment has no `beforeWindow`, so the parent counts
all of it in the current window, as before.
