# HANDOVER — rd/c-guests-see-passes-2-3 ("What guests see", passes 2 and 3)

Worktree `/Users/icecasasola/Documents/Claude/Projects/wt-c-guests-see`. Local commits only: no push, no PR, no database.
Report of the round before the join: head `efa2926b3` (see `changelog.d/rd-c-guests-see-passes-2-3.md`).

## The coordinator's five steps (2026-10-12) — state

1. **Join `origin/main` (d2e38b7c1)** — DONE (merge `c83f85c23`, no textual conflict). After the join the part door
   reads through `guestRead` (the released failure handling) — `9f20362e7`. My tests green on the merged tree.
2. **Two cells** — DONE. Live × Save the Date = the prototype's dash ("Live opens on the day."); the mount is unchanged
   (the player follows the broadcast — owner 2026-09-02 — so a stream on air on a Save the Date is still drawn and
   cannot be unticked there: TELL THE CONTROLLER). Your seat × Save the Date and × Post Event STAY ticked: the one seat
   rule shows the table after the day, and before it when seats were opened early — unticking by default would hide
   what a guest sees today (`fixed-rows-are-real-boxes` test 4c).
3. **`/seat` (venue QR)** follows the other seat pages' rule — NOT STARTED.
4. **Checks**: `rm -rf apps/web/.next`, full tsc (8192 MB) rc 0, my tests + `app/[slug]` suite + Maker neighbours, then the
   WHOLE `pnpm preflight` under the heavy lock — NOT STARTED.
5. **Lab walk 375×812**, pictures `joined-…` into `controller-2026-10-08/batch-c/guests-see/` — NOT STARTED.

## Next (do in this order)

- Run from `apps/web`: `../../node_modules/.bin/tsx --test lib/fixed-rows-are-real-boxes.test.ts lib/a-hidden-part-closes-its-doors.test.ts lib/guests-see-table.test.ts`
- Then steps 2 → 5 above.

## Rules that bit before

- Heavy lock: `~/Documents/Claude/Projects/heavy-lock.sh acquire "guests-see"` → ONE heavy step → release. Let labels with
  'assembler', 'maker-fixes', 'walker' go ahead.
- Never run the test runner with an empty file list (it runs the whole suite).
- Bracketed paths in zsh: `"app/[[]slug[]]/x.test.ts"`.
- Source-text pins are everywhere: keep the pinned string (withhold one step earlier) before re-aiming someone's test.

## Helper scripts (session scratchpad — may be gone)

`c-heavy1.sh` (tsc + sweep), `c-lab.sh` + `c-shots.mjs` (lab walk), `sab2/sab.py` (sabotage one string, run tests, restore).
