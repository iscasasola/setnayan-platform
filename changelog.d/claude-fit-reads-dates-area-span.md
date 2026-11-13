## 2026-11-13 · feat(find): the "fits your event" check reads the candidate dates, the Region and the main span

Per the owner's 13 Nov rulings (DECISION_LOG "ONE MAIN DATE SPAN PER EVENT" · "FIND KEEPS A SUPPLIER FREE ON ANY ONE
CANDIDATE DATE"). Find's bench search (`category-search.ts`) and Discover (`marketplace-view.tsx`) used to judge only
`events.event_date`, so an event with candidate dates or a date window got no date filter at all.

- `fitDateScope` (`lib/bench-bookable-days.ts`) — one answer for the days judged: a day-precise date → the main span
  `event_date → COALESCE(event_end_date, event_date)`; else the candidates (parsed by `resolveProbeWindow`); else the
  ≤31-day window; else a month. A supplier free on ANY ONE candidate / any day of the window or span stays.
- Accommodation needs EVERY night of the span widened by a day each side (one full night hides it); before booking,
  some candidate/window day ±1 must be wholly free. The ±1 nights are read only when an accommodation card is in play.
- Block-ready: options are blocks of days; `supplierDayFits` / `DayFit { freeDays, totalDays }` is each supplier's best
  per-block fit (ALL ranks ahead of SOME), exposed through `readSuppliersWithNoBookingLeft({ fitsOut })`. No label UI.
- `vendors_blocked_on_date` (the calendar-block down-rank) is asked once per judged day, same rule.
- No venue pin → distance measures from the Region's curated centroid (`regionPin`, `lib/your-place.ts`, reading the
  onboarding's own `REGION_CENTROID` / `CITIES`). `search_areas` and `std_film_venue_city` are not fit inputs.
- Empty-list / could-not-check sentences name the shape: "on any of your dates", "from … to …", "between … and …".
- Failed reads keep their old behaviour (Find folds to hide nobody; Discover says it could not check).

Guard: `apps/web/lib/fit-reads-dates-area-span.test.ts`.

SPEC IMPACT: None — the rulings are already in the DECISION_LOG.
