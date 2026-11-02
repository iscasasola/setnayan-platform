## 2026-06-28 · chore(vendors): sweep second-order dead server actions orphaned by the PlanningGroups retirement

Follow-up gap-check after #2327 deleted the PlanningGroups grid cluster. Two
server actions in `app/dashboard/[eventId]/vendors/actions.ts` were consumed
ONLY by the deleted cluster and are now dead (verified zero live callers
repo-wide — every reference was a comment):

- `addCustomVendor` + its `AddCustomVendorResult` type — the inline custom-vendor
  add used by the removed home-page planner cards. The live manual-add path is
  `new-manual-vendor-modal` → `attachManualVendorToCategory` / `createVendor`,
  untouched.
- `addRecommendedVendorToCategory` + its `AddRecommendedVendorResult` type — the
  "accept a cross-category recommendation" action behind the removed
  `RecommendedVendorRow`.

−302 LOC. Also neutralized the ~9 comments across `actions.ts`,
`onboarding/wedding/actions.ts`, and `lib/wedding-plan-groups.ts` that named
these removed functions (some as already-stale "at line 763/702" pointers), so a
grep no longer surfaces phantom functions. Re-confirmed the other candidates are
NOT dead and left them: `VendorPickStatus` / `GroupedPicks` (used internally by
live `statusOfVendor` / bucketing), and the live actions `deleteVendor` /
`finalizeVendor` / `attachManualVendorToCategory` / `revertVendorToConsidering` /
`listLockTimeSlots`.

typecheck + lint + production build all green; codebase grep-clean of the removed
symbols.

SPEC IMPACT: None. Pure dead-code sweep continuing the 2026-06-02 lean-home
retirement cleanup; no SKU/schema/product-surface change.
