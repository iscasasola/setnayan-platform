# Progress — rd/palette-styles brought onto main (paused 2026-10-01)

Paused by the controller ("STOP NOW", moving to a cloud session). This branch is
`rd/palette-styles` (fe343bc54) + a merge of `origin/main` + follow-ups, pushed as
`rd/palette-styles-merge`. The original `rd/palette-styles` on origin is unchanged.

Spec: DECISION_LOG 2026-09-29 "APPROVED — FIVE PALETTE STYLES, PICKED ON THE TOOLBAR"
and 2026-09-30 "AS BUILT — FIVE PALETTE STYLES, PICKED ON THE TOOLBAR".
Design: corpus `prototypes/palette_styles_2026-09-29.html`.

## Done
- Merged `origin/main` (~449 commits) into the branch, history kept (merge commit).
- Conflicts resolved, all in the Dress code widget path:
  - `app/[slug]/_components/hideable-widget-render.tsx` and `public-hideable-widget.tsx`:
    main's line (roleNames, `dressCodeGeneral`) + `paletteLook={paletteLookOfRow(widget)}`.
  - `app/[slug]/_components/dress-code-widget.tsx`: kept main's `colourName` names,
    #6137's `RoleFigure` (reader's panel + every role row) and the general/you split;
    the picked look draws the chips beside them. Tags (absent / `tags` / unknown id)
    is main's markup unchanged. Looks get `name: colourName(...)` so they say the same words.
- "Tags still by default": checked. Absent, `tags` and an unknown id resolve to Tags
  (`resolvePaletteLook`), nothing on main writes `canvas.palette`, and Tags renders no
  `sn-pal` class or motion hook (guard 1 in `every-palette-look-draws.test.ts`).
- New: main moved the reader's "You are …" onto the Welcome page (`guest-welcome.tsx`,
  `part="you"`). It now follows the Dress code row's look (`WelcomeLook.paletteLook`;
  `site-body.tsx` passes `paletteLookOfRow(widgetByType(widgets, 'dress_code'))`).
- New guards in `every-palette-look-draws.test.ts`: 7 (the person's figure is identical
  in every look) and 8 (Welcome follows the look, and site-body wires it). Each was
  sabotage-checked once and went red: dropping the Welcome prop, dropping the site-body
  wiring, and making the figure's colours depend on the look.
- `palette-look-row.tsx`: three `rounded-[Npx]` changed to `rounded-sm` / `rounded-b-sm`
  (the radius guard was red on them).
- `changelog.d/rd-palette-styles.md`: merge note added; SPEC IMPACT: None.
- Checked locally: `every-palette-look-draws.test.ts` 9/9 and `lib/palette-looks.test.ts`
  10/10 pass. Every `node scripts/lint-*.mjs` step in ci.yml passes, radius strict
  included. Server actions: 1225 / 1225 (none added).

## Not done
- `pnpm typecheck` was stopped before it finished (controller stop). No result.
- `pnpm lint`, the full unit suite and the DB replay were not run.
- Budgets were not measured. They need a production build: shared bundle
  (`scripts/check-bundle-size.mjs`, ≤206,848 B) and Maker first load
  (`scripts/check-maker-js-budget.mjs`, ≤517,120 B; main ~514,334 B). The Maker
  side of this branch is only `palette-look-row.tsx` + the `scene-style-row.tsx`
  delta, both inside the lazy `maker-details` chunk.
- No PR has been opened.

## Next step (cloud session)
1. Check out `rd/palette-styles-merge`. If main has moved, merge `origin/main` again.
2. `pnpm install`, then from apps/web: `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`.
   Run a bracketed path as `app/?slug?/...`, or it runs zero tests.
3. `pnpm --filter @setnayan/web build`, then `bundle-size-check` and
   `node apps/web/scripts/check-maker-js-budget.mjs`. Record before/after in the
   changelog fragment.
4. Push to `rd/palette-styles`, or open the PR from this branch:
   `gh pr create --base main --draft`, add the `do-not-auto-merge` label, mark it
   `ready` when every check is green, read `autoMergeRequest` and disable it if armed.
   Never merge.
5. Delete this progress note before the PR leaves draft.
