## 2026-10-26 · feat(theme): two font roles in the theme file + the named-font ratchet — brand refresh step 2 (no visual change)

Stacked on step 1 (`rd/theme-tokens`). Plan §1b and PR row 2 of corpus
`prototypes/brand_refresh_2026-10-26/before_after.html`; owner "Yes in new look" (2026-10-26).

- **`app/theme.css` · fonts block:** exactly two font ROLES — `--font-ui` (today `var(--font-hanken)`)
  and `--font-ui-mono` (today `var(--font-space-mono)`). Every family name app screens still read —
  `--font-sans` · `--font-display` · `--font-app` · `--font-condensed` · `--font-sans-marketing` ·
  `--font-serif-marketing` · `--font-mono` · `--font-mono-marketing` — is aliased at a role under
  `html:root` (out-specifies globals.css's `:root`), each resolving to the face it already had.
  Named `--font-ui-mono` rather than the plan's `--font-mono`: `--font-mono` is the per-scope consumer
  that `.sn-editorial` and every `[data-hub-theme]` re-point, and a role must not be overridable from
  inside a page.
- **`globals.css` `.app-surface`:** `--font-mono: var(--font-space-mono)` → `var(--font-ui-mono)` (same
  face today) so the flip reaches the dashboards. The guest tree's `.sn-editorial` faces are untouched.
- **Tailwind:** `font-ui` added; `font-mono` unchanged (reads `--font-mono` → the mono role).
- **No loading change.** Hanken Grotesk + Space Mono load once in `app/layout.tsx` exactly as before;
  `lib/fonts-preload-only-the-first-paint.test.ts` is untouched (Inter Tight is plan step 15).
- **`apps/web/scripts/lint-font-family.mjs`** + `font-family.baseline.txt` (new CI guard `Lint font
  family`, in the blocking aggregator; `pnpm lint:font-family`): a per-file ratchet over `.ts`/`.tsx`
  AND `.css` — named face utilities, arbitrary `font-[…]`, and `fontFamily:` / `font-family:` / `font:`
  that name a family (the Home countdown's `.hc-cd-n { font-family: Georgia … }` is counted). Baseline
  today: **1,480 named faces in 317 files** (font-family: 606 · font-serif 231 · fontFamily: 181 ·
  font-display 178 · font: 151 · font-sans 65 · font-pahina 61 · other 7). Not scanned: `app/[slug]/**`,
  `app/api/og/**`, `app/_fonts/**`, `lib/*-themes.ts`, `lib/hub-theme-*.ts`, `app/theme.css`.
- Tests: `lib/font-family-guard.test.ts`, `lib/theme-fonts-are-one-token.test.ts`;
  `lib/theme-roles-are-todays-colours.test.ts` reads only the colour roles now that theme.css holds both.

Proof: before/after screenshots at 390 (Home lab, Suppliers lab, Pricing; viewport + full page; Light
and Dark) pixel-identical — `~/Documents/Claude/Projects/shots-2026-10-26/theme-1-4/`.

SPEC IMPACT: None — implements the approved plan's PR 2 (one naming deviation, stated above).
