# Changelog fragment — collected into CHANGELOG.md at release

## 2026-07-25 · feat(guest-site): Pahina wave A PR-2 — typographic masthead + countdown/chrome restyle

- NEW `app/[slug]/_components/pahina-masthead.tsx`: ONE shared hero component
  (`PahinaMasthead` + `splitCoupleNames`) for all four hero call-sites in
  `site-body.tsx` (anonymous banner · anonymous text · guest media · guest text).
  STRUCTURAL: names no longer paint over the photo behind a cream scrim — the
  masthead is purely typographic (№ 01 eyebrow · stacked Fraunces names with
  italic gild joiner · pahina-rule · gild date) and the hero photo/video is
  demoted to a framed COVER PLATE below with a mono caption. Monogram mount
  (HeroMonogram, animated-SKU logic) passes through `monogramSlot`, untouched.
- `countdown.tsx`: class-only — veil wash section, paper tiles, Fraunces
  tabular numerals.
- `site-menu-bar.tsx`: class-only — active/hover accent terracotta → gild.
- `invitation-shell.tsx`: header right slot now shows the couple's monogram
  text in gild Fraunces italic (falls back to the mono "Invitation" label);
  footer sign-off restyled to the same voice. Watermark logic untouched.
  `monogramText` threaded from SiteBody (optional prop — other call-sites
  unchanged).
- `tailwind.config.ts`: `font-pahina` family utility (var --font-pahina-display).
- Editor bridge safe: the `SITE_MENU_ANCHORS` marker nodes are separate
  zero-height spans/divs and were not moved.
- Targets `wave/a-pahina-reskin` (single prod build per wave · §12).
- Resequenced within the wave: the GuestHubCard hub-plate restyle (build plan
  §5 PR-2 amendment) moves to PR-4 with the rest of the guest-personal layer;
  GuestHubBar stays palette-token-only per the later chrome-is-a-clone owner
  ruling (no bar merge, no invented notch).

SPEC IMPACT: None (implements Design_Premium_Guest_Site_2026-07-25 build plan §1 PR-2).
