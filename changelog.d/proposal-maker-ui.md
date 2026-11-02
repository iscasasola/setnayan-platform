## 2026-07-11 · feat(proposals): in-thread proposal-maker editor (pricing bases + freebies + crew/transport)

The vendor's rich quote-composition UI, launched from the accepted thread. Translates the interactive prototype into React: line items priced flat / per-pax / per-hour (resolving against the event pax — seeded from `thread.pax_at_inquiry` — + coverage hours), freebies (₱0 → complimentary), optional bundle seed from the vendor's `vendor_package_items`, 6-dot drag-reorder, crew meal (included / charge / offset-credit-to-final), transportation (included / flat / by-distance), discount, and a live total. ALL money math flows through the pure `lib/package-line-pricing.ts` resolver (#3034).

- `app/_components/proposal-maker.tsx` — the client editor.
- `lib/proposal-send.ts` — extracted the shared ownership + accepted-thread + FREE-tier gate (`gateVendorProposalThread`) + card-post from the original `sendProposalCore` (behavior unchanged) so the new `sendCustomProposalCore` (vendor-authored `line_items`) shares the SAME gate; supersede-prior-proposal preserved.
- `messages/[threadId]/proposal-actions.ts` — `sendCustomProposalFromChat` (FormData wrapper) + `loadPackageLinesForQuote` seed; existing `sendProposalFromChat` untouched.
- Additive "Build quote" entry on the vendor thread accepted branch (+13 lines).

Deferred (follow-ups): the self-balancing payment-SCHEDULE editor + payment-methods editor persistence — the lock flow already reads `vendor_service_payment_schedules` at lock, so proposal-level schedule persistence is a follow-up; downpayment shown as a % preview for now.

SPEC IMPACT: Vendor_Proposal_Maker_2026-07-10.md (PR 3 — the editor UI; schema PR 2 already shipped as #3034).
