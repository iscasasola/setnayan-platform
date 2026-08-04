## 2026-07-12 · feat(design): Atelier reskin Phase 2 — the color core flips to kit gold (wine + champagne + obsidian retired)

The value-only token swap that converts the whole site's color language to the
Atelier + macOS glass kit (owner-locked 2026-07-12), touching every surface
through variables with near-zero component churn:

- **CTA family (`--color-mulberry`, name kept):** wine #5C2542/#7A3157/#3F1A2E →
  kit gold #A9834B/#95713D/#8A6B39; dark-mode wine-bright → gold-300 #CBA766.
- **App-chrome family (`--color-cream/-ink/-terracotta`):** alabaster→Atelier
  paper #FBFAF7 · cool obsidian #1E2229 → warm ink #1B1A17 · champagne
  #C5A059 → kit gold #A9834B (dark: ink-black #17160F · gold-300).
- **Marketing family (`--m-*`):** paper/line aligned to kit; ink+slate ladder
  re-tuned cool→warm; champagne gold quartet → kit gold-100/300/500/700;
  `--m-nav-active` wine → gold-700 (the 2026-07-09 "wine rail seam" note is
  retired — chrome and content now share one gold family); sidebar accent
  wine-bright → gold-300; all three `--m-shadow-*` warm-tuned
  rgba(30,34,41,·)→rgba(30,26,18,·) per kit rule 4 ("shadows warm, never
  grey/blue").
- **Tailwind ladders:** the two champagne-derived scales (terracotta + warn)
  and the wine mulberry tints re-anchored on kit gold.
- **5 chrome files** with hardcoded legacy hexes fixed (home-reskin.css ·
  login · nav-progress · launcher · global-error).
- All stale comments describing the old values rewritten — no doc drift.

EXCLUDED by design: monogram engine/studio + /[slug] guest surfaces + social
cards + PDF/email deliverables keep their existing palettes (guest content is
owner-excluded from the reskin; the champagne in a couple's monogram is their
asset). Remaining hardcoded hexes in tour/explore/dashboard/vendor/admin files
land in Phases 3–5.

Verified: tsc + lint clean; dev-server DOM checks — `--m-orange` #A9834B ·
`--color-mulberry` 169 131 75 · nav-active #8A6B39 · site-wide cookie-banner
CTA computes rgb(169,131,75) kit gold; /pricing renders warm paper + gold.

SPEC IMPACT: corpus DECISION_LOG.md 2026-07-12 design-finalization row (this
is the "gold supersedes wine" application step).
