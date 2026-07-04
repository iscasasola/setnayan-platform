# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-05 · feat(db): Phase 2 foundation — the connections graph (STAGED / counsel-gated)

Owner "complete phase 2 now" (2026-07-05) → building Phase 2 **staged / flag-off**. This is the **schema only**: an empty, deny-by-default, additive table. ⚠ **Phase 2 is counsel-gated** — the suggest→confirm FLOW that populates it is built behind an OFF flag and **must not go live (store real relationship data) until PH counsel signs off.** An empty inert table carries no relationship data and no legal exposure (same posture as the Phase-1 `people` table). Plan: `03_Strategy/People_Graph_and_Lifelong_Identity_2026-07-04.md` §11.

- **`supabase/migrations/20270514787557_phase2_person_connections_schema.sql`** — `public.person_connections`:
  - directed edge `from_person_id → to_person_id`, `relation` (spouse·parent·child·sibling·godparent·godchild·friend — *what to_person is to from_person*; inverses **derived**, not stored twice), `layer` (family·ritual·friend), `status` (pending→confirmed→declined, **mutual confirmation**), `created_by_event_id` (the ceremony that made it — kasal/binyag/kumpil), timestamps, `connection_id` UUID (no S89 public_id — edges aren't shared entities).
  - Constraints: no-self, one edge per (from,to,relation), relation/layer/status CHECKs.
  - **RLS deny-by-default, participant-only** — visible/writable only to the account claiming `from_person` or `to_person` (or `is_admin()`). The graph is **never browsable**.

**Verified in a rolled-back prod txn:** table + FKs + all constraints (no-self / dup-edge / relation-check assertions passed) + RLS policy + trigger; a valid edge inserted; `ROLLBACK` clean (table gone). Idempotent; timestamp guard green.

SPEC IMPACT: None new — Phase 2 foundation of the locked person-spine plan. **Adults-first; minors = Phase 3. Not live until PH counsel.**
