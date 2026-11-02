## 2026-07-08 · feat(life-story): in_memoriam + normalized captured-by (Phase 1 schema)

First code for **Life Story** — the "living memorial of your celebrations." Reframe owner-locked 2026-07-08 (*"make it while they're alive, not for when they die"*). Two additive, idempotent columns for the Phase-1 (own-events, ship-live) plan:

- `people.in_memoriam` (bool, default false) — drives the **opt-in** ✦ held-beat; never a surprise / notification / "on this day" nudge.
- `papic_photos.captured_by_person_id` (fk → `people`, nullable) + partial index — normalized "whose camera shot this frame" for the within-event perspective-shift. Resolved from the seat claim (`paparazzi_seats.claimer_user_id → people.claimed_by_user_id`), **not** face-derived. Existing rows backfilled.

RLS unchanged on both tables (columns ride inside the existing people / papic_photos policies).

SPEC IMPACT: Logged. New strategy doc `03_Strategy/Life_Story_Strategy_2026-07-08.md` + `DECISION_LOG.md` row (2026-07-08, reframe owner-locked). No SKU / pricing / retirement change; schema change is the two additive columns only.
