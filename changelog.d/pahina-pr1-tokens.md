# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-25 · feat(guest-site): Pahina foundation — material tokens, Fraunces, .sn-editorial classes (wave A · PR-1, inert)

PR-1 of the Pahina premium guest-site program (design + build plan: `Design_Premium_Guest_Site_2026-07-25/`). **Zero visible change** — pure foundation for the wave-A restyle PRs:

- `lib/site-palette.ts`: `buildSitePaletteVars` now also emits the three Pahina material tokens per spec §4 — `--color-gild` (warmest mid-luminance swatch blended 35% toward metallic #B08D57, Atelier-gold fallback on cool palettes; decor-only, no WCAG remap), `--color-paper-deep` (paper darkened ~4%), `--color-veil` (`veilColorFromPalette` exposed as channels). Root fallbacks in `globals.css` cover palette-less events. 4 new unit tests (11/11 green).
- `tailwind.config.ts`: `gild` / `paper-deep` / `veil` tokens — nothing consumes them yet.
- `app/layout.tsx`: Fraunces loaded via next/font under its own `--font-pahina-display` variable (Cormorant untouched until PR-5 confirms no other consumer).
- `globals.css` `.sn-editorial`: `.pahina-eyebrow` / `.pahina-plate` / `.pahina-rule` / `.pahina-grain` component classes + the ~500B inline-SVG paper-grain tile — all unused until later PRs swap classNames.
- `apps/web/vercel.json` `ignoreCommand`: skip Vercel previews for `claude/*` work branches (build-instructions §12.2 — CI's production-build check is the gate; wave/* + main still build). Docs-only skips were already covered by the existing path filter.

Targets the `wave/a-pahina-reskin` integration branch (§12.1 — one prod build per wave). SPEC IMPACT: None (implements the committed design; foundation only).
