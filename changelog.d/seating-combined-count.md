## 2026-06-22 · feat(seating): combined linked-table seat count in the editor lists (smart seat-plan · Phase 1)

Owner "what's next" smart seat-plan, **Phase 1**: a linked unit also gets a **combined seat count** (not just a combined name); the caterer counts the unit once; the seater treats the unit as one pool *for display*. Builds on the linked-table grouping PRs #1963/#1984.

**The gap.** Linking already shared a `link_group_id` + combined name and the canvas already moves a unit as one — but the editor's two **list** surfaces (the "Tables" panel + the "Tables & Meals" caterer cards) still iterated raw tables, so a joined unit showed as **two rows with the same name and split per-table counts** ("Table 3 & 4 · 5/10" *and* "· 3/10") and never the unit's real pooled seats. (The printable caterer artifacts — the `…/seating/print` pack and the `…/seating/caterer` meal report — already grouped linked tables into one unit, so those were correct; only the in-editor lists drifted.)

- **New shared helper** `groupTablesIntoUnits()` + `TableDisplayUnit` type in `apps/web/lib/seating.ts`. Collapses tables sharing a `link_group_id` into one display unit whose `capacity` is the **sum of each member's `effectiveCapacity`** (removed chairs excluded). Unlinked tables are one-member units. Mirrors the print route's per-unit grouping, centralized for reuse by smart-seat Phases 2/3. Unit-tested in `apps/web/lib/seating.test.ts` (5 cases incl. empty input + a degenerate 1-member linked unit) — `tsx --test` green.
- **Both editor lists map over `displayUnits`** (`…/seating/_components/seating-editor.tsx`): one row/card per unit, combined name + combined `filled/capacity` ("Table 3 & 4 · 8/20 seats" · "2 tables joined"), seated guests across all members listed together (sorted by name). The canvas still draws each physical table separately — only the lists collapse.
- **Unit-aware interactions:** tapping a unit row highlights **every member** on the canvas (`highlightGroupId`, mirrors `dragGroupId`); "Seat here" overflows into the next member with a free chair (`firstFreeSeat`); the list-row delete acts on the **whole unit** (`confirmDelete` generalized to `{ label, members[] }`).

Display-only — no seating/placement algorithm change (Phase 2 = priority weighting, Phase 3 = keep-apart solver). Seat plan stays a free couple tool (≈₱0/event). No schema/SKU/migration.

SPEC IMPACT: iteration 0008 (linked-table behaviour) — extends the 2026-06-21 grouping with a combined seat count in the editor lists. Logged in corpus DECISION_LOG.
