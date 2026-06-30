## 2026-07-01 · fix(vendor): token burn-on-answer is LIVE — correct stale "inert / not wired" surfaces

Investigating the owner's "flip the token burn live" directive surfaced that the
burn is **already live**: `unlock_vendor_event` (chat acceptInquiry) calls
`consume_vendor_assets_per_voucher` and burns 1–3 region-banded (minimum-wage)
tokens for every paid tier (FREE blocked · VERIFIED ≤10/wk AND burns · SOLO/PRO/
ENTERPRISE unlimited AND burns), blocking on insufficient balance. There is no
off-switch. Token spend reads ₱0 in prod only because no paid vendor has burned a
qualifying inquiry yet (the lone real vendor is the founder).

But several shipped surfaces still claimed the opposite — that "the consume call
isn't wired" / "burn is economically inert" / "₱0 until burn is activated." That
was **false copy on live admin + vendor surfaces**; the authors had conflated the
burn with the `region-token-burn.ts` *pricing-definition* module (which indeed
doesn't charge) and missed the real consume in the DB RPC. Corrected:

- `vendor-dashboard/subscription/.../peso-per-lead-card.tsx` — dropped the "Soon"
  badge + "Burn is inert in pilot" / "₱0 until burn-on-answer is activated" /
  "answering an inquiry doesn't burn tokens yet" copy. Now: the scorecard is live
  and explains ₱0 truthfully ("you haven't answered an inquiry that burned tokens
  this cycle").
- `admin/insights/.../peso-per-lead-admin-card.tsx` — "Soon" → "Live" badge; the
  "consume call isn't wired" note → the real reason for ₱0 (no paid vendor has
  burned a qualifying inquiry yet).
- `lib/vendor-peso.ts` — header + the `burnInert` JSDoc corrected (flag name kept
  for compat; it means "₱0 token spend this window," not "burn disabled").
- `lib/v2/region-token-burn.ts` — clarified it's the pricing DEFINITION only; the
  live consume is `unlock_vendor_event`. Flagged a real follow-up: the RPC reads
  `token_burn_bands` while this module reads `regions.burn_band` — two
  min-wage-seeded maps that should be reconciled to one source.
- `dashboard/[eventId]/vendors/_actions/unlock-category.ts` — clarified the
  couple-side unlock never burns; the vendor burns downstream on accept (live).
- `vendor-benefits.ts` — cleared the "Peso-per-lead scorecard" Soon tag (surface
  is live). The two "matched, intent-qualified" hero tags ("Only the leads that
  fit" / "Pay only for inquiries that fit") are LEFT Soon pending owner sign-off
  on that curation framing.

SPEC IMPACT: None (no schema/logic change — burn was already live; this is a
truth-in-surfaces fix). The min-wage region band map already exists in
`token_burn_bands`, seeded exactly per the owner's "bands track minimum wage."
Logged in DECISION_LOG.md (2026-07-01) + memory project_setnayan_vendor_token_model.
