# Progress: one font dropdown (PR #6160), brought up to date with main

Branch with this work: `rd/one-font-dropdown-merge`. PR #6160's branch `rd/one-font-dropdown` is untouched (#6160 was set back to draft).
Delete this file before the PR leaves draft.

## Done
- Merged `origin/main` into the branch with a merge commit, so history is kept. Only two files conflicted:
  - `website/editor/_components/pick-menu.tsx`: main moved PickMenu's props into `pick-menu-types.ts`. `stickyGroups` now lives in `PickMenuProps`. The font-row `content-visibility` note moved into the types file's notes, because pick-menu.tsx must stay comment-free (`pick-menu-stays-inline.test.ts`).
  - `website/editor/page.tsx`: `elementCanvases` now also carries main's Post Event scene scopes (`postEventElementScope`). Per-element editing and "In use" read that same object, so a font set on a Post Event part also shows as "In use".
- `lib/hub-font-shelves.test.ts`:
  - Test 4's regex is updated to the new `elementCanvases` shape, and it now also asserts the Post Event scopes are there.
  - Test 5 (the sweep) now asserts that `type-in-place.tsx` is among the swept files.
- Sabotage checks, both done:
  - Planting `HUB_FONTS` in type-in-place.tsx turns test 5 red.
  - Dropping `postEventElementScope(key)` from page.tsx turns test 4 red.
- type-in-place.tsx (#6209) is NOT edited. Its Style ▾ calls `onStyle`, which opens the part's ElementSheet → PartInspector, and that Font row is already `FontPick`. So there is no second font picker, and P7's edits to that file can't conflict with this one.
- Grep for other font pickers (HUB_FONTS / hubFontPreviewStack / name="site_font_key" in the launch + website trees): only FontPick offers fonts. It is mounted in part-inspector, maker-logo and pro-panels.
- Changelog fragment renamed to `changelog.d/rd-one-font-dropdown.md`, with a note about this merge. SPEC IMPACT: None.
- After the merge, before the stop: `pnpm typecheck` was clean, and 26 touched test files passed.
  - Warning: bracketed `app/...` paths passed to `tsx --test` run 0 tests. They have to be run as `npx tsx <file>`. Of the 26 files, 7 bracketed ones went through `tsx --test`, ran 0 tests, and so are NOT verified. One of them, element-preview, was re-run afterwards as `npx tsx <file>`: 21/21 passed.

## Not done
- The full unit suite. It was started and then stopped on the controller's order.
- Lint: root `pnpm lint`, plus every `node scripts/lint-*.mjs` step in `.github/workflows/ci.yml`.
- Budgets, before and after, all unmeasured:
  - shared client bundle (`scripts/check-bundle-size.mjs`, ≤206,848 B)
  - Maker first load (`scripts/check-maker-js-budget.mjs`, needs a production build, ≤517,120 B)
  - server-action count (≤1225)
- Regenerated baselines (port-control baseline etc.), if CI asks for them.
- Pushing to `rd/one-font-dropdown`, then CI on #6160, then `gh pr ready 6160`, then checking `autoMergeRequest` and disabling it if it is set.
- Phone check at 390 px.

## Next step
1. In the cloud session, check out `rd/one-font-dropdown-merge` and run `pnpm install`.
2. Delete this file.
3. Run the full unit suite. Run bracketed files with `npx tsx <file>`.
4. Run lint and the `lint-*.mjs` steps, plus the bundle and server-action budget scripts.
5. Push it to `rd/one-font-dropdown` as a fast-forward: `git push origin HEAD:rd/one-font-dropdown`. Then let #6160's CI run.
