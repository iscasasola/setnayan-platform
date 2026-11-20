## 2026-11-18 · perf(speed): five pages start their independent reads together; the query cache's IndexedDB copy waits for the page; `/` drops a dead `revalidate`

Stacked on `claude/speed-code-only-1118`. Owner target: every page under 0.7 s at 390 px. Nothing looks or behaves differently. Every read is awaited on the line that always awaited it (`startAhead`), so a refused read still throws, or is still said, exactly where it was. No read is added, none of them writes, no server action, no migration.

- **Schedule (`/dashboard/<id>/schedule`).** Seven reads that need nothing from the seeds, the agenda or each other now start right after the day's first round: the event-type profile, the run-of-show and prep-release switches, the advance-permission pair, who may announce, the booked-host lookup and the supplier meetings. The seeds and the checklist top-up still run before the reads that depend on them.
- **Supplier Customers (`/vendor-dashboard/customers`).** The team trio and the shop's paged `event_vendors` roster start beside the first round. The month on top is started there and awaited only where it is drawn, so the list no longer waits for it.
- **Front door (`/`).** Discover's signed-in shelves and the signed-out front page's reads hang off the account read alone, not the slowest read of round 1. Each starts only when the page will draw it, and the signed-out redirect condition is checked before the landing reads start.
- **Guest Event Hub (`/<slug>/hub`).** The prep-release switch, the guest's door check-in (read beside their seat, not after it) and the venues (when open to this viewer) start with the hub's other reads.
- **Guest page (`/<slug>`).** The 7-day supplier notice and "Who made the day?" start beside Your schedule.
- **Query cache (`app/providers.tsx`).** `PersistQueryClientProvider` is gone. Nothing reads the cache through React (no `useQuery`, `useQueryClient` or `getQueryData`); three event-day components only write to it. The IndexedDB copy is kept byte for byte: same key, 7-day max age, buster, and restore-then-save. It now lives in `lib/query-persistence.ts`, started by `<QueryPersistence />` once the page has loaded and gone idle, so TanStack's persister and idb-keyval leave every page's first load. The restore now also waits for the IndexedDB read to answer (before, it could race the prime).
- **`/` `revalidate = 300` removed.** It was dead: the page awaits `searchParams`, so Next renders it per request (live response: `private, no-cache, no-store`). Caching the signed-out page is an owner call, not made here. The home-jobs guard now accepts a per-request render.

Not changed, with the reason:
- **`vendors/page.tsx`:** #7795 (speed-pass-w5) owns it.
- **`/vendor-dashboard` (Today):** it already reads in two parallel waves, and wave 2 truly needs wave 1's answer.
- **The duplicate auth, user and event reads:** another session owns them.

Guards: `lib/the-pages-start-their-reads-together.test.ts` · `lib/the-query-cache-waits-for-the-page.test.ts`. Updated to the new shape with the same checks: `supplier-page-notice` · `the-guest-page-starts-its-reads-together` · `home-carries-the-cron-free-jobs` · `presign-ttl-vs-resign` · `[slug]/a-failed-read-is-not-an-absence` (its walker now follows a started-ahead read to its `await`).

SPEC IMPACT: None.
