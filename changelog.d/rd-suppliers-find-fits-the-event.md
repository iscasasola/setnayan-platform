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

### 2 · "date/s" — an event still choosing between days

An event that has not settled its day keeps `events.event_date` NULL and holds
its shortlist in `events.date_candidates`. The hide read `event_date` alone, so
for those events it asked about no day and hid nobody. `unbookableDateScope`
now takes the candidates: a settled day wins, then the candidates, then a month
— the order `resolveProbeWindow` already uses for the bench's free days. A
supplier leaves only when every card is refused on EVERY candidate.

⚠ That rule for several dates is the controller's reading, not the owner's
words (the same shape as his "Hide only if full all month"); the code comment
says so. It applies to every caller that hides — Find and the bench search read
one scope. No migration and no RPC change: `service_cards_unbookable_on` already
takes any set of up to 31 days. A flexible window (`date_window_start/end`) is
NOT read — nobody has ruled on it.

SPEC IMPACT: None beyond the row already filed — `DECISION_LOG.md` 2026-10-10
"SEARCH SHOWS ONLY WHAT CAN BE BOOKED FOR THIS EVENT; ONE INQUIRY COVERS EVERY
CATEGORY THE COUPLE TICKS" (the controller filed it; this change implements it).
