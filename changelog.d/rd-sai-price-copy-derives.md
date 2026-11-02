## 2026-09-22 · fix(setnayan-ai): the free-venue upsell stops promising a price the product cannot charge

**A sentence shipping to couples on the Overview was false in both halves — the amount and the
billing model.** `lib/setnayan-ai-free-assist.ts` hand-typed *"Venue help starts free — the full Sai
is ₱499 first 28 days → ₱799 per 28 days."* Measured against `platform_retail_catalog_v2` in
production (2026-09-22), `SETNAYAN_AI` is `billing_period = 'one_time'`, `is_active = TRUE`, and the
`SETNAYAN_AI_RENEW` row those numbers named is **`is_active = FALSE`**. A wedding is Tier A whose
SKU *is* `SETNAYAN_AI`, so a couple clicking through was billed a one-time charge several times the
figure they had been shown, for a subscription that does not exist. Re-measure, never quote:
`select service_code, retail_price_php, billing_period, is_active from platform_retail_catalog_v2
where service_code like 'SETNAYAN_AI%';`

🔑 **This was not a live offer the catalog had not caught up with — it was a promise the product
could not keep.** Removing it does not invent an offer; leaving it was the decision carrying
commercial exposure. The charge path was always correct and catalog-authoritative: the copy was the
only liar. Traced to be sure — `resolveSetnayanAiDisplayPricePhp` / `resolveSetnayanAiTierPricesForEvent`
gate on `resolveSetnayanAiPerEventPricingEnabled`, and that flag chooses **which catalog row**
(per-tier vs flat), never a ₱499/₱799 subscription. Nothing anywhere charges those amounts.

⚠ **AND IT WAS LIVE, NOT INERT — CHECKED, NOT ASSUMED.** `FreeVenueShortlistOffer` is mounted
**twice** on the Overview (`variant="inline"` and `variant="card"`) and the upsell `<p>` renders
unconditionally. That check is now mandatory here after `digestSubWorthShowing` turned out to be
imported once and called zero times.

**THE FIX IS THAT THERE IS NO NUMBER IN THE SOURCE.** `FIRST_VENUE_SHORTLIST_UPSELL` (a const)
becomes `firstVenueShortlistUpsell(fullSaiPhp)`, and `firstVenueShortlistConfirmation(added)` gains
the same parameter. The amount is resolved server-side in `event-dashboard.tsx` through
`resolveSetnayanAiDisplayPricePhp(supabase, eventType, 'regular')` — the same path every other Sai
surface uses — and handed to both mounts. `'regular'` is not a choice: that resolver's own contract
says `'onboarding'` belongs on the sign-up card and `'regular'` everywhere else, and it must match
the context the charge path uses for the same button. The component is `'use client'` and therefore
*cannot* read the catalog, which is why this is a prop and not a fetch. Reprice in /admin/pricing and
the copy moves on its own. CLAUDE.md rule 9 says labelling a guessed number as a guess does not make
shipping it safe; the defence here is having no number to guess.

**No price is better than a wrong one.** `0` — which the resolver returns for Tier E (Sai is not
sold) *and* for an unreadable read — drops the price clause entirely rather than printing `₱0` or
falling back to a constant. The offer still sells; it just stops making a claim nobody measured.

**The four assertions that pinned ₱499/₱799 are re-pointed at the property, not at ₱2,499.** They
passed for months while the sentence they guarded was false — a guard pinned to a number cannot tell
"the copy is right" from "the copy and the guard are wrong together". The tests now assert the
RELATIONSHIP: the sentence carries whatever price it is handed (executed across 1 · 99 · 499 · 2499 ·
3000 · 12345, each appearing exactly once — a second rendering is its own defect); an unknown price
prints no `₱` and no digit while keeping the sentence intact; and no line offers a cycle, intro or
renewal while that SKU is off, with the detector proven able to fire. A source check asserts **zero**
`₱<digits>` literals survive in the module's CODE — comments are stripped first on purpose, so the
docblock may narrate the retired sentence without convicting itself, and the stripper is proven live
by asserting the raw file still contains what the stripped one does not.

**A new guard covers the half nothing else could: `fullSaiPhp` is OPTIONAL, so a mount that forgets
it renders the no-price sentence to every couple and looks fine.** The test counts
`<FreeVenueShortlistOffer>` mounts and requires each to be fed (`mounts: 2 · fed: 2`), and rejects a
hard-coded number in the prop. Same shape as "an import is not a call", applied to a prop.

Five watched sabotages, each red, each file restored to a verified hash: (1) reinstate the old
literal sentence → 4 tests fire; (2) **keep the parameter, ignore it, and hard-code today's CORRECT
₱2,499** → still fires, which is the proof the guard tracks the relationship and not the amount;
(3) fall back to a constant when the price is unknown → fires; (4) drop the prop from one of the two
mounts → fires, printing `fed a price: 1`; (5) pass a literal instead of the resolver → fires.

🪤 **The test caught an over-broad assertion of my own on its first run:** a blanket "no digit"
check fired on the confirmation line, whose *"3 venues"* is the shortlist count — a true number that
is not a price. Scoped to the property; the count is now asserted to survive.

**Also corrected, same disease, one module over:** `lib/integration-config.ts`'s docblock for
`resolveSetnayanAiPerEventPricingEnabled` claimed TRUE means "the ₱499-first-28-days then
₱799-per-28-day-cycle model is live (the intro/renewal charge + the per-event window are honored)".
The flag is TRUE in production and that model does not exist — it selects which catalog ROW is read.
A stale comment on a live money flag is how those two numbers reached rendered copy. It now states
what the flag SELECTS and quotes no amount, carrying the cure `setnayan-ai-type-pricing.ts` already
wrote down after its own header listed prices untrue for months: *a docblock that quotes prices
becomes a second price list.*

⚖ **KNOWN LIMIT, FLAGGED NOT HIDDEN.** The copy says "one-time", which is true of
`SETNAYAN_AI.billing_period` today, but that word is not itself derived — no guard fails if the
owner moves the SKU to a recurring period. The catalog is migration-seeded, so a db-test could close
this; it is out of scope for this slice and recorded here with its re-measure command rather than
left as an assumption.

❓ **OPEN OWNER QUESTION, on his desk via the controller:** is a ₱499-intro / ₱799-per-28-day
subscription still intended for Setnayan AI? If YES this is a catalog job — activate
`SETNAYAN_AI_RENEW`, price the intro, and the derived copy starts saying so with no code change. If
NO, this change already closes it. Either way he needs to know the false sentence was rendering to
couples, mounted twice, unconditionally.

SPEC IMPACT: The Pricing.md § 00 free-venue-assist carve-out records the upsell as "₱499 first 28
days → ₱799/28d". That line describes a model the live catalog does not express. NOT edited here —
it is the owner's pricing decision, not a code detail, and is the subject of the open question above.
