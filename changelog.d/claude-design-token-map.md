## 2026-11-14 · feat(design): the token layer — Phase 1 map + Phase 2 tokens, no pixel changes

- `docs/design-token-map.md`: a measured inventory of every hand-typed visual value in `apps/web`
  (11,510 files: hex, palette classes, radius, shadow, font size, spacing, border width, button and
  frame looks), the proposed token names, near-duplicate clusters, and intentional exceptions.
  The scanner is beside it (`docs/design-token-map.scan.mts`).
- `globals.css`: new `--sn-*` tokens for button shape (`--sn-btn-min-height` 44, `--sn-btn-height` 40,
  `--sn-btn-height-lg` 44, radius, icon size), frame line, padding and tile shadow, the sheet,
  border widths, spacing 4·8·12·16·24, tap heights, icon boxes and a type scale of the exact sizes the
  app types today. `--sn-surface`, `--sn-hairline`, `--sn-line`, `--sn-ink-500`, `--sn-r-lg` and
  `--sn-r-pill` now point at their equal `--m-*` twins.
  Button colours are deliberately not declared on `:root`. Hub themes, `[data-art]` and Admin › Colours
  re-point their sources per scope, and a root alias would freeze those scopes.
- `tailwind.config.ts`: the new tokens are exposed as `text-sn-*`, `p-sn-*`/`gap-sn-*`, `h-sn-btn`,
  `min-h-sn-btn`, `size-sn-*`, `border-sn-*` and `shadow-sn-*`.
- `lib/the-main-button-is-the-accent.test.ts`: its hex reader follows a `var(--x)` alias to the real hex.
  Sabotaged: a dark `--m-paper` now fails it through the alias.
- Proof of no change: the compiled stylesheet before and after differs only in token declarations, with no
  utility rule added, removed or changed. Every aliased token computes identically in Chromium in light and dark.

SPEC IMPACT: DECISION_LOG row 2026-11-14 "THE TOKEN LAYER KEEPS THE HOUSE NAMES". The owner ruled to
keep the `--sn-` / `--m-` names instead of the generic `--surface-*` / `--accent` / `--btn-*` names.
