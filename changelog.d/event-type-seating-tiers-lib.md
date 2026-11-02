## 2026-06-24 · refactor(event-type): make the seating solver role-set-capable — iteration 0053 Phase 2 (PR-4, lib)

Threads the per-event-type `RoleSet` into the seating auto-fill ALGORITHM, so generic events can eventually tier by their own roles (host/vip→1, family→3) instead of collapsing everything to tier 4. **Byte-identical for weddings** (defaulted params + the 17-test seating suite, unchanged). **Inert** (no consumer passes a non-wedding `roleSet` yet) — this is the safe single-file lib foundation, mirroring PR-1's classifier refactor.

- **`lib/seating.ts`** (only file):
  - `computeAutoSeat(…, roleSet: RoleSet = WEDDING_ROLE_SET)` — the couple-exclusion is now `!roleSet.coupleRoles.has(g.role)` (wedding `coupleRoles` === `{bride,groom}` → identical) and tiering is `tierOf(g, roleSet)`.
  - `solveSeatPlan` — `SolveInput.roleSet?` (default wedding); passed to the warm-start `computeAutoSeat` and the repair-loop `moveCost` (`guestTier(…, roleSet)`).
  - `relaxLowestPriorityRule(…, roleSet = WEDDING_ROLE_SET)` — `guestTier(…, roleSet)`.

Every existing caller omits `roleSet` → wedding default → the algorithm emits byte-identical `(guest_id, table_id, seat_number)` rows (proven: `computeAutoSeat` determinism, priority-order fill, tier assignment, `solveSeatPlan` determinism, `relaxLowestPriorityRule` — all 17 seating tests green unchanged).

**Verify:** `pnpm typecheck` clean · `pnpm lint` clean · seating suite **17/17** · full unit suite **396/396**.

**Next (the seating CONSUMER threading — separate PR):** `seating/actions.ts` (6 `computeAutoSeat`/`solveSeatPlan` call sites resolve the event's role set) + the 5,508-line `seating-editor.tsx` client (pass `roleSetKey`, resolve client-side, thread its ~8 `guestTier`/`roleTier`/`ROLE_TIER_LABELS`/`defaultPriorityOrder`/`relaxLowestPriorityRule` touchpoints) + `seating/lab/page.tsx`. Editor + actions must move together for tier-label/auto-seat consistency. Until then generic seating uses the wedding-tier fallback (functional; manual `seating_priority` override + drag-reorder work).

SPEC IMPACT: Iteration 0053 Phase 2 (PR-4, lib). Logged in `DECISION_LOG.md`. [[project_setnayan_event_type_engine]]
