## 2026-06-26 · fix(money): supersede stale vendor proposals on send (#8)

Money bug-hunt #8 (HIGH, wrong-amount, 3/3 verified). A vendor could have several
concurrent 'sent' proposals for the same (event, vendor), so a couple could
accept a STALE quote — writing the wrong price to `event_vendors.total_cost_php`
via `respond_vendor_proposal`.

- New `superseded` proposal status (status CHECK extended) + a `superseded` label/
  tone in `lib/vendor-proposals.ts`.
- New SECURITY DEFINER RPC `supersede_prior_vendor_proposals(event, vendor, keep)`
  — RLS blocks a vendor from updating their own non-draft rows, so the supersede
  must run as definer; it verifies the caller owns the vendor profile, then flips
  prior sent/viewed proposals for that pair to `superseded`.
- Both send paths call it after the draft→sent flip: `sendProposalFromChat`
  (in-chat) and `sendProposal` (standalone). `respond_vendor_proposal`'s existing
  sent/viewed-only precondition already refuses to accept a superseded proposal,
  so only the newest live quote is acceptable. The couple sees "Superseded" and
  no accept action on the older ones.

SPEC IMPACT: None — correctness fix on the proposal flow shipped in #2224; no
SKU/price change.
