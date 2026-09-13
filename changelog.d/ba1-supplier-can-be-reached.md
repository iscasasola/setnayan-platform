## 2026-09-02 · fix(budget): a supplier on the budget page can be reached

Every supplier card on `/budget` (and its embed on the vendor workspace page)
now carries an unconditional Message + Open workspace link, rendered outside
the collapsible ledger row so it's reachable whether the card is open or
closed. Before this, the file's only outbound link lived inside a branch that
rendered exclusively while `priceSource === 'pending' && !hasVendorControlled`
— once a vendor published pricing, "message the vendor in chat" was plain
text with no link at all.

That one link was also building `?vendor=${marketplace_vendor_id ?? ''}` — a
param the messages page never reads at all (it reads `prefill_vendor_email`),
so the link was inert for every supplier, not only off-platform ones. All
message links now key off the supplier's `contact_email` and prefill the
messages compose form when it's present, degrading to the bare messages
index when it isn't. The workspace link addresses the real route
(`/dashboard/[eventId]/vendors/[vendorId]/workspace`) and doesn't depend on
`contact_email` at all.

⚠ `event_vendors.contact_email` is nullable with no default
(`20260513100000_iteration_0006_vendors.sql`), and measured live on
2026-09-02, all 45 `event_vendors` rows in production have it NULL or blank —
so today the prefill reaches nobody; every "Message" link currently lands on
the bare messages index. That's the honest fallback working as designed, not
a bug this PR introduces. Suppliers being created with no `contact_email` is
a separate, upstream defect with its own owner — not fixed here.

Guarded by
`apps/web/app/dashboard/[eventId]/_components/a-supplier-on-the-budget-page-can-be-reached.test.ts`
(mutation-checked against the prior single-link shape, and against the
prefill-vs-fallback null case).

SPEC IMPACT: None. Flagging for the owner: suppliers ship with no
`event_vendors.contact_email` in 100% of live rows (45/45, measured
2026-09-02), so the new message-prefill link has no effect yet — this is a
separate defect (vendor-add flow / data backfill), not addressed here.
