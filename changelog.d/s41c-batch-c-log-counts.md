## 2026-09-19 · test(s41c): batch-c log-site counts match the real, distinct sites — main was red

`apps/web/lib/s41c-supplier-batch-c-reads-are-honest.test.ts` (from #5693) asserted an exact
`[supabase-error]` count per file. Later merges gave four files a second legitimate log site for a
DIFFERENT query, so the test failed 4/26 on a clean `origin/main`. Every PR's unit tests were red.

These are not duplicate logs at one site. Each file has two distinct call sites:
- `lib/supplier-night-before-email.ts`: `event_vendors.select` + `supplier_night_before_email_log.insert`
- `lib/vendor-branches.ts`: the pre-existing "branch fee (using fallback)" + `vendor_branches.select`
- `lib/vendor-deep-search-addon.ts`: the pre-existing "price (using fallback)" + `vendor_deep_search_uses.select`
- `lib/vendor-first-steps.server.ts`: `vendor_services.select` + `event_vendors.select`

The four `expected` values move 1 → 2, the same shape the table already carries for `vendor-counts.ts`,
`vendor-dayof-config.ts` and `vendor-microsite.ts`. Nothing else in the test changes, so no assertion is
weakened. 26/26 pass.

SPEC IMPACT: None
