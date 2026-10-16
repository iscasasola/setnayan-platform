# HANDOVER — Cover Scene build (2026-10-16/17)

⚠ Delete this file before PR B (`rd/cover-scene-opening`) merges. It is named `HANDOVER-cover-scene.md` because the repo
already has its own `HANDOVER.md`, which must not be overwritten.

## The two PRs (a stack)
| | branch | PR | head | worktree | state |
|---|---|---|---|---|---|
| A — items 1–3 | `rd/cover-scene-tools` | **#6592** (draft, `do-not-auto-merge`) | `d7c0d33fed` | `~/Documents/Claude/Projects/wt-cover-scene-a` | **CI: 26/26 green** on that sha. Ready for the coordinator to ship. |
| B — items 4–5 | `rd/cover-scene-opening` (base: `rd/cover-scene-tools`) | not opened yet | see `git log -1` | `~/Documents/Claude/Projects/wt-cover-scene` | Pushed; tsc 0 errors; touched guards green; full unit suite not re-run after the last fixes |

Contract: the corpus DECISION_LOG rows of 2026-10-16 (Cover Scene's own Edit · Style (Opening) · Animate; words in the
upper part + RSVP button + "Swipe up"; shimmer = an Action on any text; Confirm attendance = RSVP; all animate/effects/
styles/accents are Pro ◆); prototype v2 `prototypes/cover_scene_edit_animate_2026-10-16.html` (corpus f484bca7).

## Done
**A (#6592)**
1. Words in the upper part on all four designs (`COVER_SCENE_UPPER`). The foot holds the RSVP button: hero el `rsvp`,
   Maker part `rsvpbutton` "RSVP button", default "Confirm attendance", `.button-primary` 44 px. It shows the guest's
   state: ask / "You're coming ✓ · Change" / "You can't make it · Change" / "Replies are closed" (plain text). Under it is
   the "Swipe up for the event" hint. The stranger's cover draws no foot, because its one door "Get inside" is the
   passcode-first route. Exit preview has moved to the right edge.
2. Shimmer is an Action, shown as Still · Drift · Shimmer ◆ in one dropdown plus Band ▾. It works on any text part, is
   gated by reduced motion and Save-Data (`.sn-save-data`), and the Apply sheet names it "Shimmer".
3. Cover Scene › Edit: the cover's lines, each with the house switch. Event title is always on. Logo writes
   `events.logo_wanted`, and the cover draws no mark when it is off. A hidden line leaves the canvas.
4. Merged main, including the Vintage art kit #6590, keeping both sides. Goldens were regenerated.

**B (`rd/cover-scene-opening`)**
5. The Cover Scene has all four tools. Style is the Opening (`RevealPartTools`). The Reveal tile is removed everywhere
   (page lists, the `revealStubHtml` stub, CSS). The cover's corner tag reads "Sheer veil ◆ opens over it" or "No opening".
6. Animate is one entrance (`lib/cover-entrance.ts`, `stage-panel/cover-animate.tsx`): Entrance ▾, Movement ◆, beats,
   and a reset. It is stored as `canvas.entrance` and resolved at read time in site-body, the lab and the element
   preview. A word's own Animate shows "Follows the cover's entrance — …" and offers a reset. Entrance is Pro at Apply.
7. ▶ on the Cover Scene plays veil → unveil → entrance (`play-sequence.ts` `playCover`, bridge `playCover`).
8. Guard `lib/the-cover-scene-has-its-own-animate.test.ts`, sabotaged four ways (all went red). 13 Reveal-tile guards
   were re-anchored to the ruling.

## Left, in order
1. Open PR B as a draft with base `rd/cover-scene-tools` and label `do-not-auto-merge`. Run first:
   `git -C ~/Documents/Claude/Projects/wt-cover-scene rm HANDOVER-cover-scene.md` (commit, push), then
   `gh pr create --draft --base rd/cover-scene-tools --head rd/cover-scene-opening --label do-not-auto-merge --title "feat(cover-scene): Style = the Opening, one-entrance Animate, ▶ veil → entrance (2/2)" --body-file <body>`
   (the changelog fragment `changelog.d/cover-scene-opening-entrance.md` is the body's source).
2. Wait for CI on B and fix any red. Re-run the full unit suite from `apps/web` under the heavy lock:
   `L=~/Documents/Claude/Projects/heavy-lock.sh; "$L" acquire "unit B" && { npx tsx --test "lib/**/*.test.ts" "app/**/*.test.ts" > /tmp/unitB.txt 2>&1; "$L" release "unit B"; }`
3. Walk B on the Maker lab (`/dev/maker-lab?studio=1`): Cover Scene › Edit switches, Style = Opening cards + corner tag,
   Animate entrance + ▶, and shimmer on a scene heading. Use WebKit iPhone 13 at 375. The walk script is in
   `controller-2026-10-12/cover-scene-build/handover/walk.mjs` (guest pages only, so the Maker clicks need adding).
   Run `next dev` under the WALK lane and copy `apps/web/.env.local` from the main checkout.
4. When A merges, rebase or merge main into B and switch B's base to main.

## Open questions (owner)
- While the cover's RSVP button shows, the Welcome Reply card under it is not drawn (one doorway), and so neither is the
  art kit's `slot="reply"` ornament. Placing an accent on the cover button is part of the accents design.
- An event whose Logo answer is "No" loses its cover mark (ruling 2026-10-15 (4)). cale-ice's `logo_wanted` was not
  read from production.
- The cover entrance counts as motion, so it is Pro at Apply (per "all animate … are Pro").
- The shipped Reply is the reply page (2026-10-11 "one reply form"). The prototype's phone sheet and 440 px side panel
  are not shipped, so the button links to the page.

## Traps hit
- Running every `scripts/*.mjs` from ci.yml locally also runs `changelog-collect.mjs`. It folds and deletes every
  `changelog.d` fragment. Restore with `git checkout <sha> -- CHANGELOG.md changelog.d`.
- The repo has a tracked `HANDOVER.md`. Never write your notes there.
- Bracketed paths make `tsx --test` match nothing. Use `"app/**/<name>.test.ts"`.

## Screenshots
`~/Documents/Claude/Projects/controller-2026-10-12/cover-scene-build/` (wk375-01…10, ch1280-01/02, walk-log.txt) and the
handover copies in `…/cover-scene-build/handover/`.
