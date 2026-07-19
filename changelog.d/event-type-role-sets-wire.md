## 2026-06-23 · feat(event-type): wire per-profile role sets into guest pickers — iteration 0053 Phase 2 (PR-2)

Threads the per-event-type `RoleSet` (PR-1's `lib/role-sets.ts`) through the primary guest role-selection surfaces, so a **non-wedding event now offers generic roles** (host/guest/family/vip/helper) instead of the 24 wedding roles. **Weddings are byte-identical** (verified). This is the first iteration-0053 change that alters non-wedding behaviour.

- **`apps/web/lib/event-type-profile.ts`** — new server helpers `resolveProfileByEvent(eventId)` + `resolveRoleSetForEvent(eventId)` (React-cached): fetch `events.event_type` → `resolveProfile` → `resolveRoleSet`. Missing event / read error degrades to `WEDDING_PROFILE` (the safe direction for wedding-only V1).
- **`guests/new/page.tsx` + `guests/[guestId]/page.tsx`** — the role picker's `availableRoles` now comes from `roleSet.offeredRoles.filter(r => !roleSet.coupleRoles.has(r) && !(r in singletonHolders))`. For weddings `offeredRoles` === the old 24-role `ROLE_OPTIONS` (same values + order) and `coupleRoles` === `{bride,groom}`, so it's identical; the edit page's couple read-only path + current-guest-role visibility are untouched.
- **`guests/new/actions.ts` + `guests/[guestId]/actions.ts`** — role validation is now `!roleSet.offeredRoles.includes(role)`.
- **`join/[eventId]/page.tsx` + `join/[eventId]/actions.ts`** — the self-claim picker + both validators (`joinEventAction`/`selfJoinAction`) use `roleSet.selfClaimableRoles` (=== the old 18-role `SELECTABLE_ROLES`/`VALID_ROLES` for weddings — a no-op).

Net −158/+63: four duplicated 24-role arrays + two 18-role arrays collapsed into the single role set.

**Migration applied to prod this session:** `20270220984328` (the generic `guest_role` enum values) + `20270220834284` (the `event_type_profiles` table + wedding row) are live on `setnayan-prod`, so non-wedding generic-role writes succeed. (Verified: no other role-keyed CHECK/trigger/RLS rejects host/vip/family/helper — only the bride/groom singleton indexes, which key on those literals; guests RLS is event-scoped, not role-keyed.)

**Deferred to a follow-up** (still wedding-only, self-consistent per surface): the client quick-add sheet (`quick-add-sheet.tsx`/`quick-add-actions.ts`), CSV import (`import/actions.ts`), the group-sectioned bulk picker (`guest-list-multiselect.tsx` — needs a `roleSections` model), and the seating-tier threading (`computeAutoSeat`/`solveSeatPlan`/`seating-editor`).

**Verify:** `pnpm typecheck` clean · `pnpm lint` clean (no warnings in touched files) · unit suite **396/396** · 2-lens adversarial review (wedding byte-identity · generic correctness + safety) → **ship, zero divergences**.

SPEC IMPACT: Iteration 0053 Phase 2 PR-2. Logged in `DECISION_LOG.md`. [[project_setnayan_event_type_engine]]
