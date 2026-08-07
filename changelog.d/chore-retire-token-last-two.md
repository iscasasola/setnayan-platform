## 2026-08-07 · chore(tokens): the last two — and a deactivation that would have done nothing

Owner, 2026-08-07: *"tokens are already retired."* That closes the two items #4220
left open. Both turned out to be real, and the obvious fix for one was a no-op.

### 🪤 Deactivating the Custom plan's token SKU changes NOTHING

`vendor_custom_included_token` (₱100/cycle) was the last active token row. The one
query that reads it **does** filter on `is_active` — and `CUSTOM_UNIT_PRICE_FALLBACK`
carries a hardcoded `includedToken: 100`, byte-identical to the row. Deactivate it
and the missing row falls through to the literal: the slider keeps running 0–500
and keeps charging ₱100 each, while the catalog says the SKU is off.

🔑 **This is the `SETNAYAN_AI_RENEW` trap in a second costume, and worse — here the
`is_active` filter IS present and is neutralised by a fallback that happens to equal
the row.** Retired at the source instead: the axis is gone from the SKU map, the
fallback, `CustomUnitPrices`, the quote math and both configurators. A note now sits
on the fallback saying so, because the next axis to be retired will hit this exactly.

### Creator outreach is now FREE — it was about to break

Sending a storyteller a discount offer debited a reach token. With packs retired
there is no way to get one, so the first Pro vendor to press Send would have read
*"Top up your tokens and try again"* — pointing at a page #4220 deleted. Migration
`20271121043599` removes the debit and **keeps every gate** (member · terms · Pro-and-up
· self-offer · eligibility · opt-out · one-outstanding).

🔑 **The two sibling functions needed no change — verified, not assumed.** The expiry
sweep refunds only on `escrowed_at IS NOT NULL AND reach_tokens_held > 0`; the respond
path settles only on `escrowed_at IS NULL AND reach_tokens_held > 0`. Writing
`reach_tokens_held = 0` and leaving `escrowed_at` NULL makes both skip. Had either
been guarded on `escrowed_at` alone, this would have silently started charging on accept.

### Five more found by an adversarial sweep — one was leaving the building

- **A false email.** Every vendor whose plan was approved was told *"with the bundled
  tokens added to your wallet"* — untrue the moment `20271120530202` removed the grant.
- **A false admin banner** on the very screen that sends it.
- **A live vendor KPI tile** — *"Tokens / booking"* — that could only ever read 0 while
  teaching a vendor that bookings cost tokens. Now reports bookings won.
- **A dead route helper** pointing at the webhook #4220 deleted.
- 🚨 **A mint that would have come back.** `/api/v1/manpower/verify-telemetry` credits
  `vendor_wallets.earned_tokens` on a 14-token ladder. It 404s only because
  `PUBLIC_API_ENABLED` is unset — **switch the public API on and token minting returns.**
  Zero callers; deleted.

Also: creator-side copy, the admin "Influencer tokens spent" stat, and the Custom
plan's "Plans & tokens" back link.

**Verification:** 4 independent adversarial verifiers, each on a distinct lens, tried
to refute the two load-bearing conclusions — **all four came back "not refuted."**
7031 unit tests green under UTC and Asia/Manila; all 20 lint scripts pass.

⚠ **The catalog row itself is deliberately NOT deactivated.** With the code gone it
prices nothing; flipping a live SKU is owner territory and would be theatre here.

SPEC IMPACT: `Pricing.md` § 0.C and corpus `CLAUDE.md` both listed these two as open
owner decisions — closed by the owner's ruling, updated in this commit.
