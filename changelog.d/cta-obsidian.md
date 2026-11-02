## 2026-06-25 · style(brand): CTA colour → Deep Obsidian #1E2229

Supersedes the same-day Terracotta Clay swap (#2182, which merged then was
reverted within the hour): owner asked for a recommendation and went with
**Deep Obsidian `#1E2229`** as the primary CTA / brand "focus" colour. Obsidian
is the brand's existing ink colour, so CTAs are now black-tie buttons + cream
text, and Champagne Gold becomes the single hero accent (it no longer competes
with a warm CTA the way terracotta did).

Same surfaces as #2182, repointed terracotta → obsidian:
- `globals.css` — `--color-mulberry` (light + dark) + `--m-mulberry` families →
  obsidian ramp (light CTA `#1E2229` · hover `#343A44` · deepest `#15171B`;
  dark-mode CTA `#4A515C` charcoal so the button reads on the dark bg; wash
  `#ECEDEE`). Token names kept (`mulberry`). White-on-obsidian = 16.42:1 AAA
  (strongest possible button contrast).
- `tailwind.config.ts` mulberry shades → obsidian grays.
- Swept hardcoded mulberry/terracotta literals → obsidian in the vendors
  workspace, `onboarding.css`, the `/tour/*` prototype, `email-template.ts`,
  social cards, the monogram-studio CTA button, `global-error.tsx`, and the
  per-couple `site-palette.ts` default seed.
- Content colours still untouched: wax-seal palette, monogram inks, feel
  palettes, STD backgrounds. `--color-terracotta` (= legacy name for Gold) is
  unaffected.

SPEC IMPACT: project_setnayan_palette — Clean Editorial CTA colour is now Deep
Obsidian #1E2229 (final; superseded Mulberry → Terracotta → Obsidian, all
2026-06-25). Decision-log + memory updated.
