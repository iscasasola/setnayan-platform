## 2026-10-26 · feat(theme): one theme file of colour ROLES + the raw-colour ratchet — brand refresh step 1 (no visual change)

Owner, 2026-10-26: "if we choose a different color or icon or font, it will be easy to make the
whole app to look differently" (DECISION_LOG "ONE PLACE TO RESTYLE THE WHOLE APP" · "APPROVED — THE
NEW LOOK AND ITS BUILD PLAN"; contract = corpus `prototypes/brand_refresh_2026-10-26/before_after.html`,
plan §1a and PR row 1).

- **`apps/web/app/theme.css`** (new, imported by the root layout right after `globals.css`): 24 colour
  ROLES as `--role-*` triples, Light + Dark — page · surface · surface-2 · ink · muted · line · primary ·
  on-primary · link · selected · selected-soft · badge · badge-ink · success/warning/danger/info (+ `-wash`)
  · focus · masthead (+ `-ink`). **Every value is today's colour, byte for byte** (pinned to the
  globals.css token it was measured from by `lib/theme-roles-are-todays-colours.test.ts`).
- **Legacy aliases in the same file:** `--color-cream` · `--color-raised` · `--color-ink` · `--ink-soft` ·
  `--color-mulberry` · `--sn-on-accent` · `--color-link` · `--color-terracotta` · `--color-ok` ·
  `--color-warn` · `--color-danger` · `--color-info` · `--surface` · `--surface-soft` · `--accent-soft`
  now read the roles, under `html:root, html.dark:root` (out-specifies globals.css in both themes, so it
  does not depend on bundle order). Editing a role therefore moves every `bg-cream` / `bg-mulberry` /
  `text-ink/55` too — probed live: setting `--role-page` on <html> moved `--color-cream` in Light and Dark.
  The globals.css literals stay (160+ tests and lint:contrast parse them) — shadowed, equal, deleted at
  plan step 16/17.
- **Tailwind role utilities:** `bg-page` · `bg-surface-2` · `text-muted` · `border-line` · `bg-primary` ·
  `text-on-primary` · `bg-selected` / `-soft` · `bg-badge` / `text-badge-ink` · `bg-warning` / `-wash` ·
  `ring-focus` · `bg-masthead` / `text-masthead-ink`, plus `DEFAULT` + `wash` on success/danger/info.
  `ink`, `link`, `surface` keep their keys (their tokens are aliased).
- **`apps/web/scripts/lint-raw-colour.mjs`** + `raw-colour.baseline.txt` (new CI guard `Lint raw colour`,
  in the blocking aggregator; `pnpm lint:raw-colour`): a per-file ratchet on hex, numeric rgb()/hsl(),
  `--x: R G B` triples, colour-word / ramp / stock-palette Tailwind classes, and roles with an `/alpha`.
  Baseline today: **34,958 raw colours in 1,630 files** (14,771 role-alpha · 13,969 legacy classes ·
  4,579 hex · 1,320 rgb()/hsl() · 319 triples). Not scanned: `app/[slug]/**`, `app/api/og/**`,
  `lib/*-themes.ts`, `lib/hub-theme-*.ts`, the Mood Board colour vocabulary, `app/theme.css`.
  `scripts/strip-css-comments.mjs` is the stylesheet counterpart of the one comment stripper (the JS
  lexer would read `url(https://…)` as a line comment).
- `lib/every-colour-token-has-a-dark-pair.test.ts` reads `theme.css` beside `globals.css`.
- `app/admin/hub-music/hub-music-manager.tsx`: three dead classes removed (`text-danger`,
  `border-danger/40`, `hover:bg-danger/5` emitted NO CSS — `danger` had no DEFAULT); giving `danger` its
  role DEFAULT would otherwise have turned that button red. Pixel-identical.

Proof: before/after screenshots at 390 (Home lab, Suppliers lab, Pricing; viewport + full page; Light
and Dark) are pixel-identical — `~/Documents/Claude/Projects/shots-2026-10-26/theme-1-4/`.

SPEC IMPACT: None — implements the approved plan's PR 1 as written (role aliases sit at the CSS-variable
layer rather than as Tailwind-key aliases, so CSS readers of `--color-*` follow the roles too).
