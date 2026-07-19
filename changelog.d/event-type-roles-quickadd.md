## 2026-06-24 · feat(event-type): role-set the quick-add + CSV-import guest surfaces — iteration 0053 Phase 2 (PR-3)

Extends PR-2's per-event-type role wiring to the remaining flat-list guest-add surfaces, so a non-wedding event is now consistent across the full guest-add flow (add / edit / join / quick-add / import). Weddings byte-identical. First time a CLIENT component consumes the role set.

- **`guests/_components/quick-add-sheet.tsx`** (CLIENT) — new `roleSetKey?: string | null` prop (default `'wedding'`); the role `<select>` maps `resolveRoleSet(roleSetKey).offeredRoles` instead of a local 24-role `ROLE_OPTS`. `resolveRoleSet` is a pure, client-safe lookup (`lib/role-sets.ts` imports only `type GuestRole` → no server code in the client bundle), so the client resolves the role set from the key string — no `Set`/object crosses the server→client boundary.
- **`guests/page.tsx`** (SERVER) — resolves `resolveProfileByEvent(eventId)` and passes `roleSetKey={profile.roleSetKey}` to `<QuickAddSheet>` (its single render site).
- **`guests/quick-add-actions.ts`** — all three role validators (`quickAddGuest`, `addRoleToGuest`, `setGuestPrimaryRole`) now `resolveRoleSetForEvent(eventId)` + check `roleSet.offeredRoles.includes(role)`.
- **`guests/import/actions.ts`** — `importGuestsCsv` resolves the role set once before the row loop and validates each row against `roleSet.offeredRoles`.

Net −57 lines (three more duplicated 24-role arrays removed). Wedding: every surface resolves `WEDDING_ROLE_SET` → `offeredRoles` === the old 24-role lists (incl. bride/groom for quick-add, which never filtered them) → identical. Generic: offers/accepts host/guest/family/vip/helper (enum values live in prod since PR-2).

**Still deferred** (the last 0053 Phase-2 pieces): the group-sectioned bulk picker (`guest-list-multiselect.tsx` + `groups-actions.ts` — needs a `roleSections` model on `RoleSet`) and the seating-tier threading (`computeAutoSeat`/`solveSeatPlan`/`seating-editor`). Both stay wedding-only and self-consistent in the interim.

**Verify:** `pnpm typecheck` clean · `pnpm lint` clean · unit suite **396/396**. Same `resolveRoleSetForEvent` pattern as PR-2 (which passed a 2-lens adversarial byte-identity review); the new client-import boundary is gated by CI's production build.

SPEC IMPACT: Iteration 0053 Phase 2 PR-3. Logged in `DECISION_LOG.md`. [[project_setnayan_event_type_engine]]
