## 2026-08-28 · feat(onboarding): everything added during set-up is at least 10% off, and the screen says so

Owner: *"we give them a 10% discount if they purchase now. They can order later,
but they will lose the 10% discount."* · *"10% for all purchase on onboarding"* ·
*"Onboarding discount should be visible and easy to understand that this discount
only applies on onboarding."*

**RULE 0: the mechanic already existed.** `onboarding_price_php` has meant "what
this costs during the create flow" since it was built, and has been charged for
Setnayan AI all along. The sixteen Papic shot rungs never had one, and the create
flow read `retail_price_php` — quoting the *later* price at the one moment the
earlier one applies.

**"10% for all" taken literally would have raised three prices.** Every Setnayan
AI tier already discounts 40–50% at sign-up; assigning 90% of retail would have
moved the flagship from ₱1,499 to ₱2,249. Written as a floor instead: at least a
tenth off, and a deeper sign-up price already on the row wins. The migration
refuses to commit if any tier ends up higher.

The saving is stated in the three places a person looks — a banner before they
choose, a line on each item, and the total where they agree to it — and every one
of those lines disappears when there is nothing to save.

SPEC IMPACT: `Pricing.md` — the sign-up discount rule now covers Papic shot
bundles, not only Setnayan AI. Prices themselves are unchanged and are read from
the catalog, never re-typed.
