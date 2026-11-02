## 2026-09-05 · chore(pricing): the Animated Monogram is ₱500, not ₱1,000

Owner ruling. The SKU lost the LED Live Background on 2026-08-11 — *"that half of the ₱1,000 could
never be delivered"* — and kept its number for three weeks. What ₱1,000 still bought was the six
CSS animation signatures (draw · foil · bloom · editorial · halo · stardust), on a mark whose maker
is already free (`tier: 'free'`; lettered, cipher and uploaded marks are never gated). Halved to
match what it actually is, on the round 500-multiple of the 2026-08-27 sheet.

Measured before deciding, against production rather than the docs: `ANIMATED_MONOGRAM` was
₱1,000.00 active; the SKU has **never been ordered** (every order ever: 3 paid onboarding baskets,
1 paid Setnayan AI, 2 cancelled), so nothing realised is forfeited — though with 8 events total
that is not evidence the old price was wrong.

The figure lives in four places and all four move together, which is the point of this being one
commit: the catalogue row (admin-managed, owner-applied), the demo scene's literal, its
`public-price-literals.ts` declaration, and the hand-typed `llms-txt-guard-input.ts` mirror — whose
own docblock warns that a prod price changed without it lets CI pass green while llms.txt serves
the fallback stub.

**And the two baked copies were re-recorded**, which nothing would have caught: `animated-monogram.mp4`
(played on the in-app Studio card) and `stills/animated-monogram-1.jpg` both had ₱1,000 burnt into
their pixels. Verified by extracting the frame, not by trusting the file size. This is the gap
flagged when the spotlights landed — the drift checker reads source literals, and a JPEG is not
source.

⚠ SEQUENCING: the catalogue row must be repriced BEFORE this merges. In that window the card
advertises ₱1,000 and checkout charges ₱500 — the customer pays less than advertised, which is the
safe direction. Merging first inverts it into advertising ₱500 while charging ₱1,000.

SPEC IMPACT: DECISION_LOG row added (pricing, 2026-09-05).
