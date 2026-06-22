## 2026-06-22 · feat(seating): draggable seating-priority tiers (smart seat-plan · Phase 2)

Owner "what's next" smart seat-plan, **Phase 2**: the couple can set **who sits nearest the stage** by reordering the role tiers, and Auto Arrange honors that order. Builds on Phase 1 (combined linked-table seat count, #1997).

**What it does.** A new **Seating Priority** panel in the seating editor lists the four role tiers — *Family & principal sponsors · Entourage · Extended family · Friends & others* — in priority order (top = nearest the stage). The couple reorders them; Auto Arrange then fills tiers in that order into the stage-ranked table pool (so the tier order *is* the VIP-near-stage weighting). Default order reproduces the historical fill, so nothing changes until a couple reorders.

- **Migration** `20270210000000_seating_priority_order.sql` — additive, idempotent `event_floor_plan.priority_order JSONB` (nullable; inherits the table's existing couple-owned RLS, no new policy). Auto-applies on merge via `supabase-migrations.yml`.
- **`lib/seating.ts`** — new `PriorityTier`/`PriorityOrder` types + `defaultPriorityOrder()` (the locked 1→2→3→4 default), `parsePriorityOrder()` (validates DB/client JSON, de-dupes, re-derives canonical labels), `resolvePriorityRank()`. `computeAutoSeat()` gains an **optional** `priorityOrder` param (back-compatible — all existing callers omit it) and fills tiers in the resolved order instead of a hardcoded `[1,2,3,4]`. With `null` the result is **byte-identical** to before (adversarially verified). `computeAutoLayout` is unchanged (table positions are type-driven, not guest-driven). Deterministic — no `Math.random`. 4 new unit tests in `lib/seating.test.ts` (9 total, `tsx --test` green).
- **`actions.ts`** — new lock-gated `savePriorityOrder` (re-validates the client value server-side via `parsePriorityOrder`; partial upsert of just `priority_order`, safe because every other `event_floor_plan` column has a DB default). `autoSeatGuests` now threads `floorPlan.priority_order` into the seater.
- **`seating-editor.tsx`** — the Seating Priority `<Section>` reorders two ways so it works on every device: **HTML5 drag** for desktop pointers (the requested drag-to-reorder) **and** up/down buttons for touch / keyboard / a11y (HTML5 drag doesn't fire on touch, and the seat plan is mobile-used). Lock-gated + optimistic.

Display/ordering only — no keep-apart solver yet (Phase 3). Seat plan stays a free couple tool (≈₱0/event). Adversarially reviewed (2 lenses · correctness + integration/security) → SHIP, no HIGH/MED findings.

SPEC IMPACT: iteration 0008 — adds `event_floor_plan.priority_order` + the draggable priority model. Logged in corpus DECISION_LOG.
