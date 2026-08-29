## 2026-08-29 · fix(vendor): Papic Challenges AND the 3D Booth are for paid plans — and a price switch can no longer decide who may buy

**SPEC IMPACT:** `DECISION_LOG.md` row 2026-08-29 (owner ruling). No price moves.

**Owner 2026-08-29, in two messages:**
1. *"NEXT_PUBLIC_VENDOR_ADDON_TIERED_PRICING was 0 and now i made it true and redeployed. Solo and
   Pro can buy Papic Challenges. they can only but if they are solo,pro,enterprise,custom. but not
   when they are free"*
2. *"3D Plan and papic Challenge is only for paid vendors Solo, Pro, Enterprise, and Custom. not for
   free"*

One floor, two products. ⚠ **"3D Plan" here is the VENDOR add-on — the branded 3D Booth
(`vendor_3d_booth`, ₱2,500/28d), which is what that flag gates.** The COUPLE's own 3D Plan purchase
(`SEATING_3D`, ₱1,500 per wedding) is untouched and not on this axis at all: a couple has no vendor
tier.

### 🚨 That flip opened the door he is now closing

The 2026-07-25 tiered add-on model made **one switch answer two questions**: which PRICE BAND a shop
pays, and **whether it may buy at all**. Both the TypeScript gate and the SQL RPC read it as *"all
tiers allowed"*, so the moment it went on, a **FREE** shop could buy and author Papic Challenges.
Inert in fact — prod holds 0 vendor missions ever — but open.

🔑 **One switch answering two questions is how a price change silently becomes an access change.**
The flag keeps its price job. The floor is now its own unconditional rule on both sides of the wire,
and neither can be widened by moving a price.

⚖ **And the rule he stated is the one this gate already had.** Before the tiered model
(`20270906348207`) it read `('solo','pro','enterprise','custom')` — exactly his four. `20271001130000`
made it conditional. **The owner has re-ruled his way back to the pre-flag behaviour**, which is worth
recording: the flag's *access* half was never a decision he made, it was a side effect of a pricing
model.

⚠ **`verified` is refused and he named it neither way.** It is the LEGACY FREE tier — a real, checked
business on the ₱0 plan — so it falls under *"not when they are free"*. Stated in
`PHOTO_CHALLENGE_MIN_TIER`, in the migration header and here rather than buried: if a verified free
shop should be admitted, that constant is the one line to change.

### Changed

- `photoChallengePurchaseEligibility` **no longer takes an `allTiersAllowed` lever at all** — the
  parameter is gone, so the floor cannot be lifted by any caller. A unit test asserts its absence.
- The SQL floor is unconditional, and `v_all_tiers` plus its `platform_settings` read are **deleted
  with it** — a variable kept "just in case" is how the condition grows back.
- The activation hook's defence-in-depth check moves to the same floor, or a shop would pay and the
  approval would throw — taking their money without turning the add-on on.
- The subscription card and its copy: *"comes with a paid plan — Solo, Pro, Enterprise or Custom"*.
- The tier is checked **before** verification, so a free unverified shop is told the true reason —
  sending somebody to get verified when it cannot admit them is worse than saying no.

### The 3D Booth, ruled the same way

It was flagged to the owner as *"also open to free shops now, say the word"* rather than assumed —
and he said the word. The booth's floor moves identically, in the buy action, the card, the
activation hook and the RENDER gate.

🔴 **AND IT FIXED A LATENT DEFECT NOBODY HAD HIT: `boothCanBrand` tested `tier === 'pro' || tier ===
'enterprise'`, so `custom` — the most expensive plan there is, at ₱11,000 — COULD NOT BRAND ITS
BOOTH.** Listing two tier NAMES instead of reading the ladder is what did it; `isTierAtLeast` includes
the tier above Enterprise by construction, and the owner's ruling names Custom explicitly.

⚠ **Four tests were DELETED, not silently weakened.** They pinned the 2026-07-25 model's
`allTiersAllowed` parameter — including that a FREE shop holding the add-on brands — and that
parameter no longer exists, so they could not be inverted: **a test cannot assert about an argument
the function does not take.** What they were protecting is restated and kept: the ENTITLEMENT half
still gates every tier, so a paid plan without the add-on still renders a generic booth.
⚖ This supersedes the 2026-07-04 "branding is a Pro/Enterprise perk" lock — but it is the owner's own
third move on that gate (perk → any buyer → any PAID buyer), not a reversal by engineering.

📊 **Also surfaced, because the flip moved money he may not have intended:** against the catalogue,
the AI Chatbot rises ₱1,500 → ₱2,000 for Free/Solo, Deep Search doubles ₱500 → ₱1,000 for Free/Solo,
and **the 3D Booth drops ₱2,500 → ₱2,000 (Free/Solo) or ₱1,500 (Pro/Ent)** — a ₱1,000 cut for Pro.
Papic Challenges is ₱2,500 in both bands, so it is unaffected.

### Verification

`tsc --noEmit` exit **0**, 0 errors · `test:unit` · `test:db:ci` · all **30** CI guard scripts.
**Three mutations, occurrence-counted, all RED:** re-gate the SQL floor on the price switch (1 → 0)
turns *"A FREE PLAN CANNOT AUTHOR"* and *"the price switch cannot open the door in EITHER position"*
red; disable the TypeScript challenge floor (1 → 0) turns three unit tests red; the booth suite pins
`boothCanBrand.length === 1`, so **re-adding the all-tiers lever fails by arity alone** — there is no
way back in that compiles quietly.
Both new db tests grant the shop a **live subscription window first**, so the refusal can only be the
TIER floor — and a **control** proves Solo, the cheapest paid plan, still authors.

⚠ **One existing assertion was rewritten by the ruling** — it read *"below Pro is refused unless the
tiered model is on"*, a shape that could not express "Solo in, free out" at any setting.
