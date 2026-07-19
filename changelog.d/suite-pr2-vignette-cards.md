# suite-pr2-vignette-cards

## 2026-07-20 · feat(suite): animated vignette service-cards (flag-dark)

Suite PR-2 (Whats_Next_Suite_AI_Pricing_2026-07-18 §2): the "Add to your day"
sellable features on `/dashboard/[eventId]/suite` now render as **animated
vignette cards** — each card carries a small CSS-only stage that SHOWS what the
feature does instead of a plain `StudioAppRow`:

- **9 bespoke scenes** keyed by catalog key (fallback scene for future keys):
  Setnayan AI (vendor matches sliding in) · Website PRO (a mini browser hero
  wearing the couple's names + date with a premium gold sheen) · Editorial PRO
  (the front page composing itself under their masthead) · Pakanta (their
  song's equalizer playing) · Custom QR (a guest code with their mark at the
  centre) · Papic (candids landing in the gallery) · Patiktok (a vertical
  reel mid-play) · LED Background (their initials glowing on the stage wall) ·
  Indoor Blueprint (the door-to-table path drawing itself).
- **Personalized where cheaply derivable**: one extra `events` select
  (`display_name, event_date, monogram_text`) in the page's existing
  `Promise.all` powers the names / lockup initials / formatted date the scenes
  wear. `deriveMonogram` reused from `lib/monogram` — no new derivation logic.
- **Atelier-glass, budget-safe**: the card shell is the `.sn-tile` recipe minus
  `backdrop-filter` (globals.css §1.6 blur budget — a grid of 8+ blurred cards
  would bust it), gold-var accents, Hanken via `var(--font-display)`. New
  colocated CSS module `suite-vignette.module.css` (flash.module.css
  precedent) — **globals.css untouched**, no new deps, no images, no client JS
  (server component; motion is pure CSS keyframes, transform/opacity + one
  stroke-dashoffset; the universal `prefers-reduced-motion` freeze block
  stills every scene).
- Hrefs (`cardHref`), live admin-catalog pills (`pillFor`), outcome grouping,
  and the Recommended / Yours / Free sections are unchanged; `/studio` is
  byte-untouched.
- **Ships dark**: the surface stays gated by `NEXT_PUBLIC_SUITE` (OFF in
  prod; visible on Vercel previews). Flag-off = today's behavior exactly.
- All 13 `suite-doorway-guardrails` tests pass unchanged (free-layer snapshot,
  routes-helper, href resolution untouched).

SPEC IMPACT: `Whats_Next_Suite_AI_Pricing_2026-07-18.md` §2 "PR-2 · Vignette
service-cards" shipped flag-dark (the vignette-card follow-up build item is
now code; the personalized secretary-brief half of PR-2 remains HOLD-DEP on
the counsel-gated taste profile).
