## 2026-09-15 · fix(shop): My Shop stops telling a supplier couples read its website

SUP-30 (SHOP-3). A claim-versus-truth row: measured what a couple actually sees
before touching any copy.

**The claim.** The public-line card's blurb read:

> "The one line couples read under your name on your page and in search results
> — and your own website, if you have one."

**The truth.** Couples never see it, and that is a RULING rather than an
oversight — owner 2026-09-11, DECISION_LOG "SEVEN SUPPLIER-SIDE QUESTIONS" Q3:
"Never show links" — no tappable website or social link on the shop page, before
or after booking. `/v/[slug]` selects `website` and deliberately never renders
it; `lib/no-door-out-of-the-app.test.ts` already fails if a website href reaches
any couple-facing surface. Verified across the public shop page, explore and the
service-card view model: zero renders, under any spelling.

So a shop was told its website is part of its public line, four days after the
owner ruled the product would never show it.

- The blurb now describes the tagline only — the half that was always true.
- The website field gains one line saying where the value does and does not go,
  in the voice `/v/[slug]` already uses when it tells a shop previewing itself
  why its email and phone are absent. The value is still saved, still editable,
  and still read once (with consent) to suggest coverage — that paragraph was
  already true and is untouched.

**A new guard, because the existing one cannot see this failure.**
`no-door-out-of-the-app.test.ts` stops a website HREF reaching a couple. It
cannot stop My Shop from CLAIMING couples see the website. A promise and a link
are different failures: one ships a door, the other ships a lie about one.
Asserted against visible copy with comments stripped, so the docblock quoting the
old wording can neither satisfy nor trip it.

SPEC IMPACT: None — this makes the copy agree with the 2026-09-11 Q3 ruling.
