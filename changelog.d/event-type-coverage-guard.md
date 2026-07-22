## 2026-07-22 · test(events): self-enforcing coverage guard for new event types

Makes the "adding a new event type" net enforce itself, so the class of miss that shipped gala_night (mispriced default) and date/hangout ("Wedding checklist" mislabel) can't recur.

- **`lib/event-type-coverage.test.ts`** (runs in CI via `test:unit`) — asserts every `ANCHOR_BY_TYPE` type has a `CHECKLIST_EVENT_LABELS` entry (no Wedding-chrome fallthrough) AND an explicit `AI_TIER_BY_EVENT_TYPE` entry (no silent ₱499 default). Consolidates the label check with a new tier check, keyed off the canonical code roster.
- **`tests/db/event-type-coverage.db.test.ts`** — the **source-of-truth** guard: replays every migration into in-process PGlite and reads the ACTUAL `event_type_vocab` the migrations produce, then asserts every ENABLED type has a label + tier. This closes the real gap the map-keyed guards can't see — a vocab type added but never wired into the code maps (exactly how date/hangout slipped). No external DB.
- **CI wiring** — new `test:event-type-coverage` script + a targeted `ci.yml` step that runs ONLY this one db-test (~10s, in-process), not the whole `tests/db` suite. So the DB-vocab guard now fires on every PR.

Register a type via a vocab migration and forget a code map → CI fails. Companion: corpus `Adding_A_New_Event_Type_Checklist_2026-07-22.md` (the classified net) + memory.

Full unit suite green (2573) incl. the pure guard; the DB guard passes against the replayed vocab; typecheck clean. No runtime code touched.

SPEC IMPACT: None (test + CI only).
