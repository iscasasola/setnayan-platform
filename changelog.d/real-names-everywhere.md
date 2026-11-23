## 2026-11-16 · fix(names): the couple's chat, the shortlist logo, the supplier sheet and shop partners show the real shop name and face

Owner ruling 2026-11-16 (15) — real shop name everywhere — leftovers split out of #7898 (which moved
`resolveVendorDisplayName` itself).

- **The couple's chat list and thread head.** `couple_thread_supplier_names` sent `business_name` and `logo_url` as
  NULL until the reveal predicate said yes, so an unverified shop still drew as its screen name in chat. Migration
  `20271350551812_couple_chat_shows_every_suppliers_real_name.sql` (CREATE OR REPLACE against the only prior definition,
  20271295352678; same signature, gate and grants) returns both for every shop. `threadSupplierName`
  (`lib/chat-supplier-names.ts`) labels with the real name whenever one is on file; the screen name draws only for a shop
  with no business name. `name_revealed` is still the predicate's answer and still gates the shop's STAFF names in read
  receipts (not part of the ruling).
- **The logos / portfolio gate (`isVendorNameRevealed`).** The shortlist card logo (`dashboard/[eventId]/vendors/page.tsx`),
  the supplier sheet's photos and Share link (`lib/supplier-sheet-read.ts`) and a shop page's partner logos + links
  (`lib/vendor-trusted-by.ts`) no longer wait for the reveal.
- Guards that asserted the old hiding were rewritten with the ruling as the reason, not deleted:
  `a-couples-chat-names-every-supplier.test.ts`, `the-shop-speaks-with-its-logo.test.ts`, `supplier-sheet.test.ts`,
  `the-shop-page-ends-with-partners-then-similar-shops.test.ts`, `tests/db/a-couple-sees-every-suppliers-chat-name.db.test.ts`
  (its PARITY and GATE tests are unchanged).

Still reading the hide rule after this PR (listed in the PR body): the bench marketplace search's logo
(`bench-marketplace-search.ts`, a #7898 file — waits on it) · a service card's auto-title "<Kind> by <Shop>"
(`vendor-dashboard/services/actions.ts` + trigger in 20271222415682) · staff names in chat receipts.

SPEC IMPACT: None beyond the owner's own DECISION_LOG ruling 15 (specs 61e7a2fb), which this implements.

## 2026-11-17 · fix(names): the bench search card wears every shop's logo (ruling 15, after #7898)

The one ruling-15 leftover that lived in a #7898 file: `bench-marketplace-search.ts` still returned
`logoUrl: revealed ? … : null`. Now `logoUrl: r.logo_url ?? null`; its `isVendorNameRevealed` read (now unused) is
gone. Badge bill reason updated. SPEC IMPACT: None.
