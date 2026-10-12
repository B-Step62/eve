---
"eve": minor
---

A dynamic tool resolver no longer adds `eve__search` and `eve__tool` unless it sets `deferred: true` on `defineDynamic()`. Add `deferred: true` to any resolver that returns deferred entries; without it, eve rejects them and skips that resolver's result.
