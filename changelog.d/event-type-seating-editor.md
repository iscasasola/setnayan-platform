## 2026-06-24 · feat(event-type): thread the role set through the seating consumers — iteration 0053 Phase 4 (Unit 6)

Threads the per-event-type `RoleSet` through the seating CONSUMERS (the lib was made role-set-capable in PR-4 #2114), so a non-wedding event's auto-seat tiers by its own roles (host/vip→1, family→3) and the editor shows its tier labels. **Weddings byte-identical** (2-lens adversarial verify: ship; 17/17 seating tests green).

- **`seating/page.tsx` + `seating/lab/page.tsx`** — resolve `resolveRoleSetForEvent(eventId)` in the `Promise.all`; the page passes `roleSetKey={roleSet.key}` (a **string**) to `<SeatingEditor>`; the lab tiers its 3D annotation with `guestTier(…, roleSet)`.
- **`seating-editor.tsx`** (client) — new `roleSetKey: string` prop; `const roleSet = useMemo(() => resolveRoleSet(roleSetKey), …)` (declared before the `priorityOrder` initializer). Body touchpoints use it (`defaultPriorityOrder(roleSet)`, `relaxLowestPriorityRule(…, roleSet)`, `roleSet.tierLabels[tier]`); the module `ROLE_TIER_LABELS` import was removed (all 3 uses → `roleSet.tierLabels`). Two module-level sub-components (`MemberRow`, `SeatPeoplePanel`) gained a `roleSet: RoleSet` prop (threaded at all 4 render sites) and use it for `guestTier`/`roleTier`/`tierLabels`.
- **`seating/actions.ts`** — 5 actions (`autoSeatGuests`, `savePriorityOrder`, `lockAndFill`, `seatRoleAtTable`, `autoArrange`) + `buildSeatingDraft` resolve `resolveRoleSetForEvent(eventId)` and pass `roleSet` to `computeAutoSeat`/`solveSeatPlan`/`parsePriorityOrder`/`roleTier`. `buildSeatingDraft` previously omitted `computeAutoSeat`'s 5th `priorityOrder` arg — now passes `null` (its prior effective default) before `roleSet`, so the draft fill order is unchanged.

**RSC-safe:** only the `roleSet.key` string crosses the server→client boundary; the `RoleSet` object (with `Set` fields) is re-resolved client-side via the pure, client-safe `resolveRoleSet` and only passed client→client. No migration.

**Verify:** `pnpm typecheck` clean · `pnpm lint` clean (no flagged files) · **seating suite 17/17** (the byte-identity gate — `computeAutoSeat`/`solveSeatPlan`/priority-order/tiers, all green, unchanged) · full unit suite green · 2-lens adversarial review (wedding byte-identity · RSC-safety + completeness) → **ship, zero divergences**.

SPEC IMPACT: Iteration 0053 Phase 4 Unit 6 (closes the seating subsystem). Logged in `DECISION_LOG.md`. [[project_setnayan_event_type_engine]]
