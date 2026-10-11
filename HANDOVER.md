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
4. **Checks** — HALF-DONE (stopped at the account limit, 2026-10-12).
   - DONE: full tsc rc 0 on head f727888e4 (`apps/web/.next` removed first, 8192 MB heap); `node scripts/preflight.mjs
     --only guards` → 43 pass; my own test files green on the merged tree (fixed-rows-are-real-boxes,
     a-hidden-part-closes-its-doors, guests-see-table, the-guests-see-sheet-is-lazy, lab-draft, maker-part-groups,
     each-stage-does-one-job, a-fixed-block-has-its-own-motion, a-guests-pages-are-filed-like-the-makers,
     each-guest-page-has-one-main-action).
   - DONE 2026-10-12 (round 2): the sweep — 386 test files (every `app/[slug]` test + every test naming site-body,
     maker-scene-list, guests-see, hub-draft, what-guests-see, stage-scenes, part-door, part_show) → 3261 tests,
     3261 pass, 0 fail, rc 0, 187 s, under the lock.
   - Whole `pnpm preflight`: queued behind the lock (round 2).
5. **Lab walk 375×812** — NOT RUN. No `joined-…` picture exists.

Nothing of mine is running; I do not hold the heavy lock and am not in its line; `apps/web/.next` is removed.

## Half-done, by file + symbol

- Nothing is half-written in code: every commit is a whole step and the tree is clean.
- UNPROVEN after the join (code written, checks not run): `app/[slug]/seat/page.tsx` (the two `partDoorHidden(…, 'seat')`
  gates), `app/[slug]/_lib/part-door.server.ts` (`hiddenPartDoors` now reads through `guestRead`),
  `app/[slug]/_components/site-body.tsx` (`entourageShownOn`), `app/[slug]/page.tsx` (`myPhotosHref`),
  `lib/guests-see-build.ts` (`FIXED.live.cols = 'XLBBB'`). tsc is green for all of them; only the wide sweep and the
  whole preflight have not seen them.

## The next three steps

1. Under the heavy lock, from `apps/web`: run the sweep — every `app/[slug]/**/*.test.ts` plus the tests that name
   `site-body`, `maker-scene-list`, `guests-see`, `hub-draft`, `what-guests-see`, `stage-scenes`, `part-door`,
   `seat/page` (`../../node_modules/.bin/tsx --test --test-concurrency=3 <files>`; bracketed paths as `[[]slug[]]`;
   NEVER an empty list). Then from the root: `pnpm preflight`. Fix what fails; never weaken a guard. Commit.
2. Lab walk at 375×812 (`/dev/maker-lab?studio=1`, own dev server on a free port, stop it by its own PID): the table
   (six box rows; Live × Save the Date a dash; Your seat ticked ×4), untick E-Gifts × Invitation → Apply → the
   Invitation canvas loses `f:gifts`; publish with ✓; the Studio row's status; the RSVP fold; Remove Countdown on the
   canvas → its box unticks → ＋ offers it back. Pictures `joined-…` into
   `controller-2026-10-08/batch-c/guests-see/`. LOOK at each picture.
3. Reply to the coordinator (head sha; conflicts → none, how the join was reconciled; the two cells; `/seat`; checks;
   walk; not verified). Tell them plainly: (a) Live × Save the Date is a dash but a stream on air is still drawn
   there (owner 2026-09-02, the player follows the broadcast) and cannot be unticked; (b) Your seat stays ticked on
   Save the Date and Post Event because unticking by default would hide what a guest sees today; (c) sub-pages and
   the hub were never opened in a browser; (d) at 1280 the table has no door (`lg:hidden` bar).

## Rules that bit before

- Heavy lock: `~/Documents/Claude/Projects/heavy-lock.sh acquire "guests-see"` → ONE heavy step → release. Let labels with
  'assembler', 'maker-fixes', 'walker' go ahead.
- Never run the test runner with an empty file list (it runs the whole suite).
- Bracketed paths in zsh: `"app/[[]slug[]]/x.test.ts"`.
- Source-text pins are everywhere: keep the pinned string (withhold one step earlier) before re-aiming someone's test.

## Helper scripts (session scratchpad — may be gone)

`c-heavy1.sh` (tsc + sweep), `c-lab.sh` + `c-shots.mjs` (lab walk), `sab2/sab.py` (sabotage one string, run tests, restore).
