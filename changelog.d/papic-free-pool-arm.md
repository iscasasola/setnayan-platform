## 2026-07-27 · fix(papic): arm the free 50-point pool — free capture has been UNMETERED, not free-with-a-limit

The owner locked **"Free = a 50-point shared event pool"** on 2026-07-22 and confirmed the figure on 2026-07-27 (*"free is 50 points"*). The database was built for it. Nothing ever wrote the grant.

**The bug, traced end to end — not inferred.**

- `papic_event_pool_status(event_id)` decides whether the fence exists at all, and its own comment names the intended sources: *"Applies when a flat pass exists (legacy) OR the event holds ANY grant (Free / One / Pool). **No grant + no pass → fence absent.**"*
- `papic_reserve_event_points(...)` then takes the branch that follows from that: *"Fence absent (non-pass event) → **RETURN TRUE**, ledger untouched."*
- `provisionFreeCamerasAdmin()` (`lib/papic-cameras.ts`) materializes the 3 `tier='free'` seats at indexes 100–102 — real rows, real claim tokens — and **stops there**. It never inserts into `papic_event_point_grants`.
- Prod confirmed the consequence: `papic_event_point_grants` held **0 rows across every source**, while 3 free seats existed.

So a free event had **no fence at all**. This is the inverse of the usual fake-door bug: the free tier wasn't broken, it was **unlimited**. Every photo and every 10-second clip on a free event was accepted, and `papic_event_pool_usage` was never even written to.

**Why this had to be fixed before anything else.** Papic is being switched ON for every new event across all 16 event types (`Onboarding_Papic_AI_Cards_BUILD_SPEC_2026-07-27.md`). Doing that on top of an unmetered free tier hands **every signup unlimited free photo + video storage** — on the product whose storage sustainability is already an open concern, with 10s clips at ~2× the bytes and neither compression nor purge built. It also makes the onboarding card unwritable: "50 free shots" is a number the meter won't honour, and "unlimited" is an accident rather than an offer.

**What landed.**

- **Migration `20271017100000`** — a **partial** unique index, `papic_event_point_grants (event_id) WHERE source = 'free_grant'`, plus a backfill granting 50 points to every existing event. The index must stay partial: a plain unique on `(event_id, source)` would also cap `topup_order` and `camera_grant` at one row per event, but Pool top-ups are explicitly repeatable and Papic One is sold **per camera**, so those sources legitimately stack. Only the free grant is once-per-event.
- **`lib/papic-free-grant.ts`** (new) — `PAPIC_FREE_POOL_POINTS = 50` as the single constant, plus an idempotent, non-fatal `ensureFreePapicPoolGrantAdmin()`.
- **Wired at all five events-insert sites** — the generic onboarding commit, the wedding commit, the Simple Event commit, the create-event picker, and the plan-next-year clone. The clone matters on its own: `buildNextYearClonePayload` never copies grants, so without this the clone would have been the one unmetered event in an account.
- **Self-heal retained** on the Papic studio render, next to the existing free-seat provisioning, so any event the backfill or a best-effort creation write missed arms on first visit.

**Two implementation notes worth keeping.**

*No `upsert`.* PostgREST's `onConflict` cannot infer a **partial** index — Postgres needs the index predicate in the conflict target, which PostgREST can't express, so an upsert would have failed outright with *"no unique or exclusion constraint matching the ON CONFLICT specification."* This inserts plainly and reads a `23505` back as **"already armed"**, which is the steady state for every call after the first. That is also what makes it race-safe: concurrent creation and self-heal calls collapse to one row and the loser succeeds.

*Non-fatal on purpose.* A failure here must never cost a couple their event. The price of a miss is one event that stays unmetered until someone opens its Papic studio — which is exactly why the lazy call site is kept even though creation now covers it. The two together are what make "every event is fenced" true in practice rather than on paper.

**Drift guards.** The 50 necessarily lives in two places (SQL backfills before any app code runs; the app arms new events). `lib/papic-free-grant.test.ts` reads the migration file and asserts both that it grants the same `PAPIC_FREE_POOL_POINTS` and that the index is still partial — so the number can't drift and the predicate can't be quietly widened.

**Blast radius, measured.** Prod holds 2 events, 0 grants, 0 usage rows. The backfill creates 2 rows. Prior captures are **not** charged retroactively: the fence-absent branch never wrote to `papic_event_pool_usage`, so backfilled events start at 0 used and get a full 50 — the generous reading.

Verified: typecheck 0 · `next lint` 0 errors · unit **4873/4873**.

SPEC IMPACT: None on price. This ENFORCES an existing owner-locked allowance (50 pts, 2026-07-22, reconfirmed 2026-07-27) that had never been enforced. `Papic_One_Pool_Model_Spec_2026-07-22.md` §0 is now true in code as well as on paper.
