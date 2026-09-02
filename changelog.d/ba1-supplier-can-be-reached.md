## 2026-09-02 · fix(budget): a supplier on the budget page can be reached

Every supplier card on `/budget` (and its embed on the vendor workspace page)
now carries an unconditional Message + Open workspace link, rendered outside
the collapsible ledger row so it's reachable whether the card is open or
closed. Before this, the file's only outbound link lived inside a branch that
rendered exclusively while `priceSource === 'pending' && !hasVendorControlled`
— once a vendor published pricing, "message the vendor in chat" was plain
text with no link at all.

That one link was also building `?vendor=${marketplace_vendor_id ?? ''}` —
for an off-platform supplier (`marketplace_vendor_id` is NULL) that resolves
to a bare `?vendor=`, a param the messages page never reads (it reads
`prefill_vendor_email`). All message links now key off the supplier's
`contact_email`, which every supplier row carries regardless of marketplace
status. The workspace link addresses the real route
(`/dashboard/[eventId]/vendors/[vendorId]/workspace`).

Guarded by
`apps/web/app/dashboard/[eventId]/_components/a-supplier-on-the-budget-page-can-be-reached.test.ts`
(mutation-checked against the prior single-link shape).

SPEC IMPACT: None.
