## 2026-10-20 · perf(reads): reference reads are remembered, every writer clears them, periodic checks follow the gap

Measured on prod's API gateway (read-only log study, 24 h to 2026-10-20 ~01:00Z,
~113k rows; the database was moved off its Free Nano instance that morning
because it stalled). Cut the reads that ask the same platform-wide rows on
every render:

- `lib/global-settings-cache.ts` — `GLOBAL_SETTINGS_SECONDS` 60 → 300. Two new
  tags (`platformSettings`, `eventTypeVocab`). Now remembered through it:
  `fetchPlatformSettings` (all three probes; a degraded read — core, soft probe
  or accounts list refused — is handed to that page only and never kept),
  `getBookingFeeSchedule`, both Setnayan AI switches (`lib/integration-config.ts`),
  `getEventTypeVocab` + the marketplace flags (`lib/event-types-db.ts`, now read
  with the service client — public-read tables), and every
  `isDataPrivacyControlActive` gate (one remembered list instead of one row per
  key, for pages, actions and route handlers alike). `fetchPlatformSettingsMeasured`
  (the admin forms) stays live.
- Every function that writes `platform_settings` / `event_type_vocab` clears its
  tag in the same action (8 admin action files + `lib/event-types-mutations.ts`
  via the new `lib/global-settings-clear.ts`). Job bookkeeping stamps
  (`*_last_run_at`, `booking_fee_minting_live`) are exempt by COLUMN, and no
  remembered read selects them.
- Home shelf soft age 60 → 240 s (`HOME_SHELF_SOFT_SECONDS`); the hard age (300 s)
  and every `clears` write are unchanged, so no staleness bound moved.
  `loadPublishedShowcases` (`lib/showcase-db.ts`) is remembered the home page's
  way under the events/people/shops tags; any refused step throws `ReadRefused`
  and is not kept. `users.public_summary_consent_at` is now a `clears` column —
  both consent-withdrawal actions clear the shelf.
- `claimPeriodicJob` (`lib/periodic-jobs.ts`) — the per-instance per-key check
  interval follows the job's gap (`periodicCheckIntervalMs` in
  `lib/periodic-job-registry.ts`): gap < 30 min keeps 5 min; otherwise gap/6
  between 5 and 60 min (daily/weekly → 60 min). No gap and no job body changed.
- `app/blog/[slug]/page.tsx` revalidate 3600 → 86400. The two-admin approval of
  a sponsored spotlight now revalidates its article (the console actions already
  did); `clearHomeShelf('stories'|'people'|'shops')` revalidates every article,
  so an unpublished chapter or hidden shop leaves the Journal at once; a render
  built around a refused read is kept an hour at most
  (`lib/keep-a-degraded-render-briefly.ts`).

Guards (each sabotaged red → restored green): `lib/global-settings-cache.test.ts`
(§4 now FUNCTION-level over every writer, §5 every remembered read is filed
under its table's tag, §6 bookkeeping columns, §7 a degraded settings read is
never remembered), `lib/periodic-check-interval.test.ts` (the rule over every
key in `PERIODIC_JOBS`), `lib/the-journal-is-revalidated-by-its-writers.test.ts`,
`lib/home-shelf-writes-clear.test.ts` (baseline regenerated: 2 new `waits`
rows), `lib/home-reads-remember-nobody.test.ts` (now walks `lib/showcase-db.ts`).

Not touched: the cale-ice dashboard fan-out (a separate job).

SPEC IMPACT: None.
