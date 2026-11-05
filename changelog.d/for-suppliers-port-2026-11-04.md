## 2026-11-04 · feat(for-suppliers): port the 4 Nov For Suppliers prototype — hero, Verified only, twelve problems, plans in one line, close

Owner, 4 Nov: the three marketing pages go to cloud build; the binding prototype for this one is
`prototypes/for_suppliers_2026-11-04.html` (Setnayan-specs), photos his own Soul 2.0 renders. Stacked on the
"for-suppliers in the shell" PR — merge after it.

- **Hero** (`vendor-grow-hero.tsx`, rewritten): "Start or grow your event business here." for three kinds of
  supplier (no business yet · new · experienced), six trade photos cross-fading every 5 s (`HeroSlides`), the
  truths line with the booking fee behind an ⓘ. Hero rule ("images are too cut"): phone `cover`; ≥1024 px the
  hero is `min(100svh − bar, max(600px, 58vw))` tall and the photo shows its full height, anchored right,
  shifted by the prototype's `--dr` (team 19% · florist 4% · caterer 19% · makeup 22% · videographer 19% ·
  photographer 0%); zoom 2.5%. The 2026-07-10 scroll-lock gate (`vendor-hero-gate.tsx`) is removed: the
  prototype has no lock and no "How the model works ↓" release (owner, 5 Nov: *"Yes, remove it"*).
- **Verified only** (new, dark band), **Twelve problems** (new; first three, then "See all 12 ›"),
  **Plans in one line each** (new; Free · Verified · Solo · Pro · Ultra, paid prices from `getVendorPrices()`),
  **Close** ("Set na ’yan. Your shop, open today." — the old closing CTA, rewritten). The thesis strip is
  retired (the hero's truths line and the plan lines say it). The shipped deeper sections, tier deltas, matrix
  and couple-pricing pointer stay, below the plans.
- **Nothing typed.** Reach, team seats, waitlists and the own web address are put into words from
  `TIER_CAPS` (`supplier-page-words.ts`), so the 4 Nov allowances read correctly the day they land there.
  The fee is the live schedule (`bookingFeeBandsLine` / `<BookingFeeLine>`).
- **No demo / sample buttons** (owner, 4–5 Nov: *"do not add buttons now"* · *"just do not add buttons"*). The
  prototype's "See the demo shop" and the twelve "See it on the demo shop" links are not built — not hidden behind
  a switch, not added. `supplier-page-words.test.ts` fails if a `/sample` link or a "demo shop" line appears.
- **Plans list every tool and climb** (owner, 5 Nov: *"list all tools · complete all the features · same as the
  Plans"*). Free says what it covers (run the business with your own clients, your page built, gifts); Verified is
  "Everything in Free, plus" being seen within its reach; each paid plan builds on the one below. Each card lists
  its tools — first four, then "See all N tools" — from `VENDOR_TIER_SECTIONS`, the same list the full table
  draws (`planTools()`); tools marked `soon` are not sold.
- **The five shared marketing widgets** (controller's prototype, artifact WAh2zYfLCurgknopQBf9WV v3; owner 5 Nov:
  build now, here, shared with /for-coordinators; placeholders for pictures): `app/_components/marketing/trade/` —
  How it fits together · Plans (five cards: price, one line, page preview, three facts, limits from TIER_CAPS,
  every tool from VENDOR_TIER_SECTIONS; compare grid; the full matrix behind "Every tool, side by side") · Your part
  of the event · Free marketing tools (prints, QR + NFC + link, and the folded-in "Put Setnayan in your package") ·
  Badges and rewards (medals from badge-tiers). Photos are described stand-ins until the files land (TRADE_PHOTOS).
- **Free vs Verified, the clean split** (owner 5 Nov): `vendor-benefits.ts` has a Verified section; the matrix and
  the deltas read it. Owner rulings P (older sections dropped), Q (dark-ready), R (the new fee wording everywhere
  `supplierCommissionPromise` feeds).
- Photos: `apps/web/public/marketing/2026-11-04/` (18 files, same names as the corpus; the folder is shared
  with the front page and /for-coordinators).

SPEC IMPACT: None to the corpus — implements `prototypes/for_suppliers_2026-11-04.html` (DECISION_LOG
2026-11-04 "THE THREE MARKETING PAGES GO TO CLOUD BUILD"). Differences from the prototype are listed in the PR
for the owner's screenshot check.
