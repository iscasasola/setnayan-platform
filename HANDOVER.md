# HANDOVER — rd/closing-scene (the Closing "See you soon" is its own Maker scene)

(Replaces #6590's art-kit handover, which is done and merged; its text is in git history at `0e1abab9dd:HANDOVER.md`.)

Ruling: corpus DECISION_LOG 2026-10-17 "THE CLOSING ('SEE YOU SOON') IS ITS OWN SCENE IN THE MAKER, WITH STYLE › ACCENT ◆ ▾
(NONE · OVAL FRAME)" (corpus commit cf1f8009). Owner verbatim: *"Make the closing (See you soon) its own scene in the Maker,
with Style › Accent ◆ ▾: None · Oval frame. Black and white photo is fine."*

PR: **#6595** (draft, label `do-not-auto-merge`), branch `rd/closing-scene`, worktree `~/Documents/Claude/Projects/wt-closing-scene`.
Head sha: see `git log -1` on the branch (the feature commit is `4cad4f3981`; this handover is the commit after it).

## Done
- Part `closing` (`apps/web/lib/maker-parts.ts`, canvas `f:closing`), last on every page of save_the_date / rsvp / event /
  editorial in `MAKER_STAGE_PAGES` (not the RSVP stage's reply routes). Fixed row `closing` in `lib/maker-scene-list.ts`
  (`MakerFixedKey`, `MAKER_FIXED_LABEL`, `MAKER_FIXED_SOURCE`).
- Marker: `site-body.tsx` passes `closingMark={makerMark('f:closing')}`; `invitation-shell.tsx` renders `{closingMark}` right
  before the footer (canvas binder from #6582 binds the footer).
- Style: `editor-shell.tsx` `fixedStylePanel` → `if (fixed === 'closing') return accentRowFor('sign-off');` (the #6590 Accent
  row, `scene_accents`, ◆ Pro, None free, Vintage default on).
- None keeps band: site-body mounts `KitClosing` when `artKit && (artKit.look || artKit.pieces.closing?.length)`.
- Maker lab: closing drawn with marker from `lab_accents` cookie; cookie `lab_kit=vintage` puts the Vintage look on.
- Guard `apps/web/lib/the-closing-is-its-own-scene.test.ts` (5 tests, green). Updated: the-stage-pages-are-the-prototypes,
  the-day-toolbar-is-the-prototypes, a-guests-pages-are-filed-like-the-makers, the-vintage-art-kit (closing gate regex).
- Local: full `pnpm typecheck` clean (before the test file was added); 235 related test files green after fixes.
- Walk DONE: WebKit iPhone 13 @375 in the Maker lab, Vintage — tap "See you soon." → Invitation › Home › Closing → Style →
  "◆ Accent · Oval frame" → options exactly None · Oval frame → None: oval gone, "See you soon." + band stay, ✓ count 1,
  draft `{"sign-off":"none"}` → Oval frame: oval back, photo `grayscale(1)`.
  Screenshots: `~/Documents/Claude/Projects/controller-2026-10-12/closing-scene/01..06-*.png`, log `walk-log.txt`,
  scripts `closing-scene/scripts/{serve.sh,walk.mjs,stub.mjs}`.

## Left, in order
1. DONE: preflight. The real failures were the comment-stripper lint and a stale ugat screens map, both fixed in b60d82a75d. Everything else timed out on the loaded machine.
2. DONE: sabotage (removing the editor-shell closing branch turns test 2 red; restored, green). Recorded in a PR comment.
3. DONE 2026-10-17: merged origin/main (#6592 cover scene) — conflicts in `lib/maker-parts.ts` (rsvp home keeps BOTH
   `rsvpbutton` and `closing`) and the maker-lab guest page (keeps BOTH the lab kit and the lab RSVP button). ugat
   generators re-run: no change. 277 touched tests green (merge commit 3721053278).
3b. Re-walk at 375 after the merge (WebKit iPhone 13, Vintage): shots to `controller-2026-10-12/closing-scene/r2/` and
   `shots-2026-10-17/6595/`; script `closing-scene/scripts/walk2.mjs [light|dark]`.
3c. Wait for CI green on #6595: `gh pr checks 6595`. Fix any red, then push.
4. Report to the controller: PR #6595, head sha, CI count, walk, screenshot paths.

## Exact next command
`gh pr checks 6595`

## Open questions / notes
- The Closing's frame on the canvas shows the generic ＋ (add above) like other fixed rows — not changed here.
- Overlap risk with #6592 (rd/cover-scene-tools): both touch `lib/maker-parts.ts`, `site-body.tsx`, the maker-lab guest page,
  `the-stage-pages-are-the-prototypes.test.ts`, `the-day-toolbar-is-the-prototypes.test.ts`. My edits are small and local;
  whoever merges second rebases.
- Tapping the sign-off when it sits under the canvas's page bar (bottom edge) misses — scroll it into view first (walk note,
  not a code defect).
