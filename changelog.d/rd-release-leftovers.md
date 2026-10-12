## 2026-10-12 · fix(guest,login,checkout,venue): the known faults left in release d2e38b7

- `/login` (and /signup, the top-nav overlays, the sign-in-here panel): the cookie notice is lifted over the sign-in backdrop while it is open, so Accept / Essential only / Manage can be pressed; the overlay pads its bottom by `--cookie-banner-top` so the card's last line stays clear.
- Guest pages: the small labels the guest walk (N22) and a 375×812 sweep of Bean's pages measured under 4.5:1 now read at ≥ 4.5:1 in the house look and every Event Hub theme (faint `text-ink/45–60` → `/70`; gold-500 words → `terracotta-700`). `lint:contrast` is extended with a "guest text on the page" scan over every `[data-hub-theme]` (light and dark), with a per-file ratchet record `scripts/guest-faint-ink.baseline.json` (282) that may only go down.
- Guest pages: the presses under 44px (N23 + sweep) reach 44px — Switch, Terms / Privacy Notice, /find-seat's round back (still round), /pabuya and /seat header links, /avatar's back + swatches (a 44×44 round press around the 28px swatch, no longer a 28×44 oval) + chips + "See me in the room", /recap's "Open their page", the rooms footer pills, "Made with Setnayan".
- Checkout: a retry of an order that already landed reads "This order already reached us — reference SN…" (only after reading that the order is the signed-in buyer's own) instead of the database's "duplicate key…" sentence; the double-order guard is unchanged. No raw database text reaches the couple from the submit any more (`lib/checkout-submit-refusal.ts`).
- `/venue`: "← Back to the wedding" → "← Back to the invitation", like its sibling guest pages.
- The reply card's byte record is re-recorded (its terms line changed for every guest).

SPEC IMPACT: None — fixes to shipped behaviour against existing rules (4.5:1 / 44px floors, house words); no decision changed.
