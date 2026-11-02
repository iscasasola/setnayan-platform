## 2026-06-24 · feat(event-type): per-profile bulk-assign role picker — iteration 0053 Phase 4 (Unit 5)

Makes the guest **bulk-assign** role picker (desktop SelectionBar + mobile Assign sheet) and its validators per-event-type — closing the last guest-role surface (add/edit/join/quick-add/import were done in PR-2/PR-3). **Weddings byte-identical** (2-lens adversarial verify: ship).

- **`guest-list-multiselect.tsx`** — new exported `bulkRoleSectionsFor(roleSetKey)`: returns `BULK_ROLE_SECTIONS` **verbatim** (early return) when `roleSetKey === 'wedding'`, else a generic 2-section list (`[{Roles: offered minus guest},{Generic:[guest]}]`) from `resolveRoleSet(roleSetKey).offeredRoles`. `GuestListMultiselect` gains a `roleSetKey` prop, computes the sections, and threads them SelectionBar → BulkApplyForm.
- **`mobile-guest-carousel.tsx`** — imports the shared helper (replacing the `BULK_ROLE_SECTIONS` import), gains `roleSetKey`, threads the sections to `AssignSheet`.
- **`groups-actions.ts`** — the two bulk role validators (`bulkAssignGuestRole`, `bulkApplyRoleAndGroup`) accept `allowedRoles = roleSet.key === 'wedding' ? WEDDING_BULK_ROLE_VALUES : roleSet.offeredRoles`. **`WEDDING_BULK_ROLE_VALUES` is the EXACT pre-0053 20-value list** (preserving the pre-existing quirk that it includes bride/groom but NOT the 4 VIP-family roles — deliberately NOT widened to the 24-value `offeredRoles`, to stay byte-identical).
- **`guests/page.tsx`** — passes `roleSetKey={eventTypeProfile.roleSetKey}` (already resolved in PR-3) to both components.

`resolveRoleSet` is pure + client-safe (`lib/role-sets.ts` imports only `type GuestRole`), so the client components resolve from the `roleSetKey` string — no `Set`/object crosses the server→client boundary. No migration.

**Verify:** `pnpm typecheck` clean · `pnpm lint` clean · unit suite green · 2-lens adversarial review (wedding byte-identity · generic correctness + client-safety) → **ship**. Byte-identity confirmed by `git diff`: `WEDDING_BULK_ROLE_VALUES` === the removed `ROLE_VALUES` (20 values, same order), picker early-returns `BULK_ROLE_SECTIONS` verbatim.

SPEC IMPACT: Iteration 0053 Phase 4 Unit 5 (closes the guest-role subsystem). Logged in `DECISION_LOG.md`. [[project_setnayan_event_type_engine]]
