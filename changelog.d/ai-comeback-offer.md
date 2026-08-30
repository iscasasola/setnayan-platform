## 2026-08-31 · fix(setnayan-ai): the comeback offer derives its own rate and reaches every event a host owns

The rescued draft (`715ca8628`) took the owner's 20% as a **constant**
(`COMEBACK_OFFER_DISCOUNT_PCT = 20`), computed the price by calling the
percentage helper `signupPriceFor`, and anchored eligibility on **one event's**
`created_at`. All three are now gone.

**1. The rate is derived, not typed.** The comeback price is the MIDPOINT of a
catalog row's own regular and sign-up prices — half the sign-up saving, taken in
pesos:

    comebackPricePhp(row) = (retail_price_php + onboarding_price_php) / 2

⚠ **Measured honestly:** at today's live prices a hard-coded `20` produces the
SAME four numbers (A ₱1,999 · B ₱1,199 · C ₱719 · D ₱159). The literal was a
LATENT defect, not a live mispricing, and this change does not move any price
today. It matters because the catalogue carries charm endings, so the implied
sign-up discounts are **40.02 · 40.03 · 40.04 · 40.20** — half of those is
20.01–20.10, so `20` is already the wrong *rule* and stops rounding to the right
peso the first time anybody nudges a price. Same defect class as the booking-fee
`(5%)` literal in `lib/booking-fee-lock.server.ts`.

`COMEBACK_OFFER_DISCOUNT_PCT` is deleted. `signupPriceFor` is no longer called —
it takes a percentage, and the production dial it neighbours
(`platform_settings.onboarding_discount_pct`) is **10**, not 40, so half of it
would have been 5%.

**2. Fails closed on a NULL.** `SETNAYAN_AI_RENEW` has `onboarding_price_php =
NULL` ⇒ no implied discount ⇒ **no offer**. Never 0% off dressed as an offer,
never a midpoint against zero. Tier E (₱0) and an inverted pair are refused the
same way.

**3. The offer is scoped to the USER; the price and the entitlement stay per
event.** Per-event anchoring made this a launch-day upsell, not a comeback: an
event created a month ago could never be offered anything again. Now there is
ONE window per host, anchored on their earliest event, and inside it every event
they own that has not bought AI is offered **at its own tier's midpoint**.

🔒 **The ENTITLEMENT does not widen.** Buying on one event unlocks that event
alone (owner 2026-08-01, "it is per event"); the deleted per-user fan-out
`getEventHostAiSubscription()` is not coming back. An event that already owns AI
is dropped from the offer set, so nobody is re-charged for it.

**RULE 0 finding — nothing needed activating.** The C11 brief framed per-tier
pricing as "a flag flip plus a mapping". Measured against prod instead:
`setnayan_ai_per_event_pricing_enabled` is already **TRUE**, the tier→type map
already ships and is already owner-editable (`event_type_vocab.ai_price_tier`),
and `resolveSetnayanAiTypePriceResolution` **deliberately does not filter
`is_active`** — `app/llms.txt/route.ts:57` says so out loud ("ALL rows, not just
active — the Setnayan AI tier ladder resolves"). So B/C/D being `is_active=FALSE`
does not gate anything, and **no catalog row was activated**. No money change.

Files: `lib/setnayan-ai-comeback-offer.ts` (rewritten, pure) ·
`lib/setnayan-ai-comeback-scope.server.ts` (new — the host→events read) ·
`lib/setnayan-ai-event-pricing.ts` (`resolveSetnayanAiTierPricesResolution`, the
price PAIR from one row) · `lib/setnayan-ai-server.ts` ·
`lib/order-charge-authority.ts` · `lib/onboarding-family-discount.ts`
(`roundPesoTiesDown` extracted so both discount mechanics round identically).

SPEC IMPACT: None — this implements the 2026-08-30 owner decisions as already
recorded; it invents no price and changes no shipped amount.
