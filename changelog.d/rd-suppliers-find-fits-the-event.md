## 2026-10-10 · feat(suppliers): Find shows only what can be booked for this event, and one inquiry covers every category ticked

Owner, 2026-10-10: *"so when they search for a supplier's service card. it will
be compared to the available schedule of that service on the event's date and
if there is a location already, if we can cater that service to that location.
service card will not show if they are not available to that date/s or that
location. when they inquire, we also show what other categories they offer. so
when they inquire, they will inquire for all the categories they want to know.
it will be counted as 1 inquiry."*

Nothing here is a new mechanism. Every part was shipped and is extended.

### 1 · Find hides what cannot be booked on the date

`searchCategoryVendors` has taken `hideUnbookable` since 2026-09-11 (H6: a
supplier the couple has never met leaves the search when EVERY card they sell in
the category is refused on EVERY day in scope). The bench's overlay and the
"More to compare" row passed it; Find a supplier
(`vendors/categories/page.tsx`) did not, so it only moved such a supplier down.
Find now passes it.

Unchanged, on purpose: it is per service card; a supplier the couple already
knows never leaves; a supplier with no calendar set is not refused and stays;
any error in the read hides nobody.

- `lib/h6-mirrors-the-booking-path.test.ts` — the "who asks to hide" pin is
  re-aimed, not weakened: it now names Find as the second deliberate caller,
  with the owner's sentence as the reason.
- `lib/find-shows-only-what-can-be-booked.test.ts` — new. Anchored on Find's own
  call (every call the page makes, counted), so it cannot be satisfied by some
  other call in the file.

Callers left alone: the Build fallback (`build-3state-fallback-actions.ts`), the
unlock (`unlock-category.ts`) and the free-venue shortlist. They are not Find.

SPEC IMPACT: None beyond the row already filed — `DECISION_LOG.md` 2026-10-10
"SEARCH SHOWS ONLY WHAT CAN BE BOOKED FOR THIS EVENT; ONE INQUIRY COVERS EVERY
CATEGORY THE COUPLE TICKS" (the controller filed it; this change implements it).
