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
  prototype has no lock and no "How the model works ↓" release.
- **Verified only** (new, dark band), **Twelve problems** (new; first three, then "See all 12 ›"),
  **Plans in one line each** (new; Free · Verified · Solo · Pro · Ultra, paid prices from `getVendorPrices()`),
  **Close** ("Set na ’yan. Your shop, open today." — the old closing CTA, rewritten). The thesis strip is
  retired (the hero's truths line and the plan lines say it). The shipped deeper sections, tier deltas, matrix
  and couple-pricing pointer stay, below the plans.
- **Nothing typed.** Reach, team seats, waitlists and the own web address are put into words from
  `TIER_CAPS` (`supplier-page-words.ts`), so the 4 Nov allowances read correctly the day they land there.
  The fee is the live schedule (`bookingFeeBandsLine` / `<BookingFeeLine>`).
- **Demo shop links wait for the demo shop.** `/sample/supplier` is not built; every "See the demo shop" is
  drawn from `DEMO_SHOP` and hidden until `app/sample/supplier` has a page (`supplier-page-words.test.ts`).
- Photos: `apps/web/public/marketing/2026-11-04/` (18 files, same names as the corpus; the folder is shared
  with the front page and /for-coordinators).

SPEC IMPACT: None to the corpus — implements `prototypes/for_suppliers_2026-11-04.html` (DECISION_LOG
2026-11-04 "THE THREE MARKETING PAGES GO TO CLOUD BUILD"). Differences from the prototype are listed in the PR
for the owner's screenshot check.
