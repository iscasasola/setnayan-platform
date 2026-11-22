## 2026-11-18 · fix(speed): the post-event Maker reads its events row once, and a thrown Files read leaves no unhandled rejection

Opus review of the wave 5 speed pass. `readPostEventForMaker` consumed its `events` row as a bare Supabase builder
twice (the back cover's chain and the `Promise.all`); a builder sends a new request on every `then`, so the row was
read twice. It is now started once with `Promise.resolve`. On supplier Files/Hub, the filed-ids promise derived from
the files read now carries its own rejection handler (a throw is still surfaced by `await filesRead`). Held by
`apps/web/lib/a-read-awaited-twice-is-sent-once.test.ts`.

SPEC IMPACT: None
