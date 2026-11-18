## 2026-11-16 · fix(discover): a category pick adds only that category; Clear all clears every filter

Walk EB-062 / EB-069 / EB-073 (owner, "Fix them too"):

- A couple whose newest event was a Get-together picked a category and got "<category> · Get-together", with
  "Filters · 1 applied" she never chose.
- "Clear all filters" left the Get-together on.
- Searching "flower" found no florists, although two were listed on the same page.

Cause: `resolveExploreScope` (lib/explore-event-type-scope.ts) auto-applied the couple's own non-wedding event
type whenever `?event_type=` was absent, and clearing the parameter is exactly the absent state.

Fix: the couple's event type no longer scopes Discover. An event-type filter applies only when the address names
it. `?event_type=all` is still honoured, and it now means the same as no filter.

Guard: `lib/a-category-pick-adds-only-that-category.test.ts`, built on the real `categoryPickHref`,
`discoverSupplierHref` and `resolveExploreScope`. It was broken twice to confirm it fails: the resolver defaulting
to a type, and the page passing the couple's type.

SPEC IMPACT: Retires the Iteration 0041 "couple-side event_type auto-apply" on the marketplace, per the owner's
16 Nov "Fix them too" on EB-062/069/073 (relayed by the controller). The catalogue landing's tile filter by the
couple's event type (`passesEventTypeFilter`) is unchanged.
