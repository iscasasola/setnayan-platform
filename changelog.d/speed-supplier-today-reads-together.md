## 2026-10-23 · perf(today): a supplier's Today reads in three rounds, not five — and asks who they are once

Owner priority (23 Oct): *"consistency and reliability that we run smoothly … And fast."* Measured with
`app/vendor-dashboard/today-page-reads.harness.ts` — the REAL Today page and supplier layout against a database
that counts how deep each request ran (the `guests-page-reads.harness.ts` method):

- **Depth 10 → 8** for the page, **11 → 8** with its layout; simulated at 150 ms a trip, **1,720 → 1,250 ms**.
- **Two auth-server requests → one** per view: the page asked `supabase.auth.getUser()` again although the layout had
  already asked through `getCurrentUser()` (remembered per request).
- `lib/vendor-overview.ts` `fetchVendorOverviewData`: the six admin desk reads (lock requests, asks, deletions,
  declined deposits, completions, date changes) need only the shop's id, so they start WITH the own-session reads;
  the reply owed and the couple's first message share one round; the event-meta read stays last and still covers
  every id (the 🔴 lock-card date fix is kept).
- `app/vendor-dashboard/page.tsx`: what the shop owes Setnayan (`fetchDueFeeBills`) and the fee gate
  (`resolveFeeEnforcement`) are started beside wave 1 and read in wave 2, where they always were.
- Every read, scope, refusal path and value is unchanged — only WHEN reads start moved. No markup changed.
- Guard: `lib/the-supplier-today-reads-together.test.ts` (depth ≤ 8 alone and beside the layout · one auth request ·
  the admin desk reads leave with the threads). `lib/the-fee-sentence-tells-the-lock.test.ts` follows the started
  fee-gate promise (the value still comes only from `resolveFeeEnforcement()`).

SPEC IMPACT: None.
