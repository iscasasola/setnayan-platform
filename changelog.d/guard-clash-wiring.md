## 2026-07-22 · feat(setnayan-ai): wire the GRD-06 schedule-clash guard (Phase 1 of making the marketing promise true)

The public `/setnayan-ai` marketing page promises Setnayan AI "flags a date about to clash", but the guard engine had no clash trigger and no snapshot field — the copy over-claimed (owner chose "build the missing guards" over softening the copy, 2026-07-21). This is Phase 1: the schedule-clash guard, the one of the three unwired claims that needs **no new schema** (run-of-show times already exist).

**What lands:**

- `setnayan-ai-triggers.ts` — new `SnapshotScheduleClash` type + `scheduleClash` field on `PlanningSnapshot`; new `scheduleClashTrigger` (priority 75, one GRD-06 per colliding pair); registered in `runTriggers`, added to the weekly-digest `checkedCount` + the "Next up" label.
- `setnayan-ai-snapshot.ts` — two pure, unit-tested helpers: `clashBlocksFromScheduleRows` (keeps TOP-LEVEL blocks with both ends; a part nested under a parent is legitimately inside it, never a clash) and `scheduleClashesFromBlocks` (strict-overlap detection — touching endpoints don't clash — sorted with an early-break, capped at 6). `buildPlanningSnapshot` now fetches `schedule_blocks` and populates the field.
- `event-dashboard.tsx` — the in-app "watch" rail builds its own snapshot; fed the same clash detection over the run-of-show blocks it already loads, so the guard surfaces on the Overview too, not just via email.
- `setnayan-ai-guard-plan.ts` — GRD-06 gets a proper notification title ("Schedule clash — {time}") and deep-links to `/dashboard/[eventId]/schedule`.

Fires live for active events with no flag flip (the guard pipeline — in-app rail + cron-free notify sweep — was already on). Honest by construction: only real overlapping blocks produce a clash; nothing fabricated.

Tests — `setnayan-ai-triggers.test.ts` (GRD-06 fires with both labels + slot; silent when none) + `setnayan-ai-snapshot.test.ts` (overlap vs touching vs invalid/zero-length, cap, row-mapper drops parts + open-ended). Full unit suite green (2506), typecheck + lint + production build clean.

Follow-up (owner-gated): Phases 2–3 wire the remaining two claims — availability-change (GRD-09, via the existing `vendors_blocked_on_date` RPC + an event-scoped last-seen baseline) and price-change (GRD-03, via an event-scoped baseline price). Both need a small migration; awaiting the owner's nod on event-scoped baselines vs a global vendor-side history before landing.

SPEC IMPACT: None — activates an existing (template-only) guard against existing schedule data; no new SKU, price, entitlement or schema change. The `Setnayan_AI_Realtime_Notifications_2026-07-02` spec's guard set now includes GRD-06 as live.
