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
3. **`/seat` (venue QR)** — DONE (`9aa58960e`): both ways in (a table sign's code; the clean address after the claim
   hop) go back to the event's page when "Your seat" is hidden. The claim hop is NOT gated (it signs the guest in
   and records the scan).
   After the join also (`494d4487c`): the entourage gate is named `entourageShownOn` (dup-rule guard refused a local
   named like the lib's `stageShowsEntourage`; 3 pins re-aimed with reasons); the photos door const is `myPhotosHref`
   (so the screens map still sees the door); `lib/ugat/screens.generated.json` regenerated — 1 entry moved (`/[slug]`
   gains a redirect door from `seat/page.tsx`). `node scripts/preflight.mjs --only guards` → 43 pass.
4. **Checks** — FULL TSC rc 0 on head f727888e4 (`.next` removed first, 8192 MB). Sweep + preflight still QUEUED/RUNNING in a detached script (scratchpad `c-join.sh` → `c-join.log`): `rm -rf apps/web/.next`
   + full tsc (8192 MB) → `j-tsc.out`; sweep of 710 files (my tests + all 162 `app/[slug]` tests + Maker neighbours)
   → `j-sweep.out`; the WHOLE `pnpm preflight` → `j-preflight.out`. Each under its own hold of the heavy lock.
   If the scratchpad is gone, rerun by hand: from `apps/web`,
   `NODE_OPTIONS=--max-old-space-size=8192 ../../node_modules/.bin/tsc --noEmit`, then from the root `pnpm preflight`.
5. **Lab walk 375×812** — NOT RUN. Script ready in the scratchpad (`j-lab.sh` + `j-shots.mjs`, pictures `joined-…` into
   `controller-2026-10-08/batch-c/guests-see/`, notes `joined-notes.json`).

## Next (do in this order)

- Read the three outputs of step 4; fix what the join broke (never weaken a guard); commit.
- Run the lab walk (step 5) under the heavy lock; LOOK at each picture.
- Reply to the coordinator: head sha; conflicts → how resolved; the two cells; `/seat`; checks; walk; not verified.

## Rules that bit before

- Heavy lock: `~/Documents/Claude/Projects/heavy-lock.sh acquire "guests-see"` → ONE heavy step → release. Let labels with
  'assembler', 'maker-fixes', 'walker' go ahead.
- Never run the test runner with an empty file list (it runs the whole suite).
- Bracketed paths in zsh: `"app/[[]slug[]]/x.test.ts"`.
- Source-text pins are everywhere: keep the pinned string (withhold one step earlier) before re-aiming someone's test.

## Helper scripts (session scratchpad — may be gone)

`c-heavy1.sh` (tsc + sweep), `c-lab.sh` + `c-shots.mjs` (lab walk), `sab2/sab.py` (sabotage one string, run tests, restore).
