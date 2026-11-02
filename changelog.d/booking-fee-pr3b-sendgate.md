## 2026-07-23 · feat(vendor): Booking Fee PR-3b — the prepaid send-gate

Wires the fee gate into the proposal SEND — the money chokepoint (`Booking_Fee_Build_Plan §PR-3`). **TWO-KEY fail-safe**: enforces only when BOTH `NEXT_PUBLIC_BOOKING_FEE_ENABLED` AND `NEXT_PUBLIC_MAYA_STATUS=APPROVED` are set. Until then the gate is skipped entirely and every proposal sends exactly as today — so flipping the flag alone changes nothing (a hard gate with no rail would trap a sourced vendor's proposal unsendable).

- **`lib/booking-fee-gate.ts`** (new, no `server-only` → unit-testable) — the pure gate RULES: `bookingFeeAttribution` (sourced vs import from `inquiry_source`), `isBookingFeeEnforced` (the two-key check), `decideFeeGate` (fail-OPEN on a null charge; clear on paid/waived_import; block on pending). 6/6 tests.
- **`lib/booking-fee-charge.ts`** — refactored to compose the rules (re-exported, so importers are unchanged) + `bookingFeeSendGate` (enforced-check → open charge → decide).
- **`lib/proposal-send.ts`** — gate wired into both cores (`sendProposalCore`, `sendCustomProposalCore`) before the draft→sent flip; on an unpaid fee the draft is LEFT in place (not deleted) for checkout (PR-4) to complete.
- **`vendor-dashboard/proposals/actions.ts`** — same gate on the standalone `sendProposal` (resolves the (vendor, event) thread for attribution).
- New `SendProposalError` code `fee_unpaid` → 402 in the native route, `proposal_fee_unpaid` notice in the chat actions.

⚠ The `fee_unpaid` path is UNREACHABLE in prod until the owner does Maya KYC + sets both keys (and PR-4 ships the checkout that pays the pending charge). Fee amount stays SQL-authoritative (the gate never passes an amount). `tsc` clean.

SPEC IMPACT: None new (implements §PR-3 send-gate). DECISION_LOG 2026-07-23.
