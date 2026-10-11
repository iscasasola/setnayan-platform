# Scrub — the cover's hand-over on the REAL invitation page (HANDOVER, kept true after each step)

Branch `rd/scrub-cover-on-the-real-invitation` · worktree `~/Documents/Claude/Projects/wt-scrub-real` · LOCAL ONLY
(never pushed, no PR). **Built, not live.** `lib/scrub-out-offered.ts` `SCRUB_OUT_OFFERED = false` — do not turn it on.
Everything proven is proven in **Chromium only**; nothing has run on iOS Safari.

## State (2026-10-12)
- `origin/main` d2e38b7c1 is MERGED IN (merge commit on this branch). Conflicts were two: the fixture test's
  "tooling" list (both lists kept) and the controls baseline (regenerated).
- Guest tree: both mastheads handed over through `HubCoverHold` (`site-body.tsx`, guest tree's
  `plan.body === 'normal' && plan.heroShouldRender` branches). Stranger's tree: both masthead call sites too.
- RULE (owner 2026-10-10 "Together."): what arrives after the cover is the next block; when that block is the page's
  ACTION ROW (`data-arrival-action` = reply row / arrival row; `data-get-inside` = the stranger's door) the block after
  it arrives WITH it, as one unit. Engine: `hub-scrub-engine.ts` (`ACTION_ROW`, `mate`, `outside`/`data-hub-zrest`).
- After the merge the stranger's door row draws no box (`.sn-door-row`, `display: contents`): the engine looks
  through such a row (`boxless`); the text-only stranger cover's rest box says the door's own fit-aware margin
  (`STRANGER_TEXT_COVER_BOXES_DOOR_FIRST`).
- Fixture guards (`lib/site-body-fixture-render.test.ts`): 8/8 dark and 8/8 with the switch on by hand, on the merged
  tree; main's guest golden is UNTOUCHED by the wiring (guard (2) green against it). The stranger's golden was
  regenerated from the merged tree: 3 changes, all main's (the link's words, the door row, the fit island's marker).

## Half-done / not yet re-proven on the merged tree
- The browser check (`scripts/scrub-browser-check.mjs`, blocks 14–17) last ran green (515) on e97cb2962, BEFORE the
  merge. On the merged tree it has not had its turn yet — in particular block 16's stranger part reads the door by
  `closest('.space-y-4')` in `GAPS_S` (now `.sn-door-row`/the `details` itself): fix that selector first.
- `first-screen-door.tsx` (main's cover fit, a client island) is NOT hydrated on the check's static pages: the fit and
  the wrapped cover have never been seen together.
- Save the Date is not wired (its cover is the film; needs its own design).

## Next three steps
1. DONE 2026-10-12: full `tsc` on the merged tree, under the lock → rc 0, 0 errors.
2. `GAPS_S` is fixed (the door is read itself) and block 16 now also measures "no still stretch while the page is
   held for the cover". STILL TO DO: run the whole browser check under the lock on the merged tree and read the
   stranger's rows; pictures at 375×812 first (`c16-real-…-together.png`, `c16-stranger-…-together.png`).
3. The owner's three open points (see the report): the still stretch, the heading clipped on iPhone, the cover.

## How to run the walk
- Guards: from `apps/web`: `../../node_modules/.bin/tsx --test lib/site-body-fixture-render.test.ts lib/scrub-is-a-held-hand-over.test.ts`
- Browser check (HEAVY — under `~/Documents/Claude/Projects/heavy-lock.sh acquire scrub-real` … `release scrub-real`):
  `node scripts/scrub-browser-check.mjs <playwright-dir>/ <scratch-dir> [pictures-dir]`; one block alone: `SCRUB_ONLY=16`.
  It writes the real guest/stranger pages itself (`scripts/scrub-fixture-page.tsx`) with Scrub offered for that
  process only.
- To see the switched-on arm of the fixture guards: flip the constant BY HAND, run, put it back (never commit it).
