## 2026-06-23 · fix(monogram): retire the separate Animate picker + stabilize the live reveal

Redirect after owner 2026-06-23 ("improve THIS animate the reveal … not a separate
feature"): #2092 had merged with a STANDALONE animate picker (the wrong placement)
plus two live defects this PR fixes. The reveal is chosen in the Vector Studio's
"Animate the reveal" panel; the unification (separate PRs) wires that panel's
choice to the live surfaces.

- **Retire the separate picker**: deleted `animate-picker.tsx` (MonogramAnimatePicker),
  removed its mount + the `currentMotion`/`ownsAnimated` plumbing from the monogram
  page, and removed the now-orphaned `saveMonogramMotion` action.
- **Migration ordering (live 500 fix)**: the gold/molten `monogram_motion_key`
  CHECK-widen migration had shipped with an out-of-order timestamp
  (`20270127142537`, before the latest applied migration) so `supabase db push --yes`
  silently SKIPPED it → every gold/molten save 500'd. Renamed to `20270219143725`
  (after the current latest `20270218887623`) so it actually applies.
- **Film WebGL co-mount (live perf fix)**: the STD film mounts all beats at once, so
  3 monogram beats spun up 3 live molten WebGL contexts. `FilmMonogram` gained an
  `active` prop (per-beat slide-index) → `allowWebgl={active}`; only the visible
  beat runs molten, hidden beats degrade to the CSS Gold Turn.
- **SKU preview**: the Animated-Monogram page previewed gold/molten via
  `AnimatedMonogramHero` (knows only the 6 CSS signatures → showed "draw"); both
  preview sites now route gold/molten through `HeroMonogram` (allowWebgl), matching
  the live render.

SPEC IMPACT: None (0037 monogram). The HeroMonogram gold/molten routing currently
reads `monogram_motion_key`; the reveal-unification reworks it to read the studio
panel's `monogram_studio_config.anim` (Phases 1–3, separate PRs).
