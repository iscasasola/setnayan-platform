## 2026-07-09 · feat(vendors): date-availability fit-badge on the Shortlist bench

The fast-follow the shipped bench fit-badges left open (the "Date-availability is
a fast-follow (needs per-vendor calendar batch)" note in `shortlist-categories.tsx`).
Adds a THIRD live fit-badge alongside reach + budget: green "Free on your date"
when the vendor's calendar has no block on the event's COMMITTED (day-precision)
date, amber "Booked that day" when it does.

- `ShortlistVendor.dateFit?: 'free' | 'booked' | null` (`lib/shortlist-taxonomy.ts`),
  populated in `buildShortlistFolders` from a new optional `dateFitByVendorId` map.
  Locked picks are skipped (same "locked skips" discipline as the budget badge —
  a "Booked" read on your own chosen vendor would be misleading).
- `page.tsx` computes the map ONCE, batched, via the existing
  `getBatchVendorAvailableDays` primitive in `lib/vendor-availability.ts` (the same
  calendar path that backs the Compare tab) over a single-day window — one extra
  query for the whole bench, no N+1. ADMIN client because 'considering' bench
  vendors are pre-booking (0022 § 2.3 calendar RLS only opens after a booking),
  the same client choice `compareAvailability` makes.
- Gated behind `BUDGET_BUILD_ENABLED` (the only path that renders the bench) AND a
  committed day-precision date. Fail-open: a calendar read error reads 'free',
  never a false 'booked' (mirrors reach's no-false-out-of-range rule); any thrown
  error → empty map → no date badges.
- `bench-sort.ts` `fitScore` folds the date check into the "Best fit" count
  (max now 3) so date-free vendors rank up; the "Strong fit" threshold widened to
  `s >= 2`. Unit tests added for the date fit + ranking.

SPEC IMPACT: None. Presentation + one batched read behind an existing off-by-
default flag; no schema change, no pricing/SKU change.
