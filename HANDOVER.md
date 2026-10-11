# Scrub — the cover's hand-over on the REAL invitation page (HANDOVER — true as of the stop, 2026-10-12)

Branch `rd/scrub-cover-on-the-real-invitation` · worktree `~/Documents/Claude/Projects/wt-scrub-real` · LOCAL ONLY
(never pushed, no PR). **Built, not live.** `lib/scrub-out-offered.ts` `SCRUB_OUT_OFFERED = false` — do not turn it on.
Everything proven is proven in **Chromium only**; nothing has run on iOS Safari. Stopped at the account's limit.

## Round 3 (2026-10-12) — IN PROGRESS (commit 0ac615287 and after)
- Touch check fixed to test its claim (slow drag, rests before lifting, inside the hold; travel == Build out by
  `--hub-pout` AND the drawn fade; React's own root delegation read apart — only a non-passive
  touchstart/touchmove/wheel counts as able to hold a finger back). Block 16 alone: touch rows green.
- FOUND + FIXED: main's first-screen fit (`first-screen-door.tsx`) and the wrapped stranger cover fed a LOOP on short
  screens — the page changed length every ~120 ms at 375x560, 375x600, 320x568 (fit shrinks the cover → hand-over
  re-measures and moves the door → fit undoes its plan → …). The fit now stands aside while the page's hold is armed
  (`data-hub-page-on`), and watches the arming. Switch off: the mark never exists, so it is today's fit exactly.
- FOUND, NOT FIXED (owner decision): while the cover is held, its NAMES are under the pinned top bar on a short
  screen — 375x667 guest and stranger (names' top 7.5 px, the bar ends 69 px; the cover 582 px on a 667 screen is
  held by the ordinary rule, its bottom on the centre line); the stranger's PHOTO cover at 375x812 and 1280x770 has
  its names wholly above the screen for the whole hold (−375 px / −599 px). Likely the owner's open point 2 ("the
  heading clipped at the top on iPhone": Safari's bars make most iPhones a short screen). New rows in block 16 say it.
- Switch OFF = today's page, proven: the real `SiteBody` rendered for 24 cases (guest · no-row guest · stranger text
  · stranger photo · guest on Details · stranger on Details × plain · cover-Scrub · scene-Scrub · both) on this branch
  and on origin/main d2e38b7c1: byte-identical, and no island mounted; flipping the switch by hand makes all 18 Scrub
  cases differ (the comparison can see a change). Every stylesheet rule the branch adds needs `[data-hub-page-on]`.
- Queued under the lock: the WHOLE browser check (walk lane), then `next lint` and the sweep (heavy lane).

## Done
- `origin/main` d2e38b7c1 MERGED IN (a87125049). Two conflicts (the fixture test's "tooling" list — both kept; the
  controls baseline — regenerated). Full `tsc` on the merged tree under the lock: rc 0.
- GUEST tree: both mastheads handed over through `HubCoverHold` (`site-body.tsx`). STRANGER's tree: both too.
- RULE (owner 2026-10-10 "Together."): what arrives after the cover is the next block; when it is the page's ACTION
  ROW (`data-arrival-action` = reply/arrival row; `data-get-inside` = the stranger's door) the block after it arrives
  WITH it, one unit. A row that draws no box (`.sn-door-row`, `display: contents`, since the merge) arrives WHOLE.
  A cover with nothing after it in its group never fades to nothing (`data-hub-zrest`). Engine: `hub-scrub-engine.ts`.
- Fixture guards (`lib/site-body-fixture-render.test.ts`) 8/8 dark and 8/8 with the switch on by hand, merged tree;
  main's guest golden is untouched by the wiring. Sweep on the merged tree (7843eec03): 426 files / 3,560 pass.
- Browser, merged tree, block 16 alone with the row fix (041fa14ca): 131 ok, 1 red (the touch check — see below).
  Whole check on 7843eec03 (before the row fix): 503 ok, 16 red, all on the stranger's page — what the row fix is for.

## Half-done (file + symbol)
- `scripts/scrub-browser-check.mjs`, block 16, "👆 A PHONE, BY TOUCH": the CHECK is wrong, not the page. The drag
  moved the page 666 px (past the 537 px hold, so the cover was 100 % out and had scrolled on), and `WATCH` counted
  the listeners of the island bundle's React root as if they were the engine's. Fix: drag ≤ 250 px (`k * 30` → fewer
  steps), and compare `window.__took.listeners` against the same page WITHOUT the island (or check the engine's
  bundle alone, as the size loop does). `took.prevented` was not the failing part.
- Not re-run after 041fa14ca: the WHOLE browser check (blocks 1–15, 17 were green on 7843eec03), `next lint` on the
  merged tree (it was started and stopped at the stop point), the sweep on 041fa14ca (engine + harness changed since).
- `first-screen-door.tsx` (main's cover fit, a client island) is not hydrated on the check's static pages: the fit
  and a wrapped cover have never been seen together. `STRANGER_TEXT_COVER_BOXES_DOOR_FIRST` (`site-body.tsx`) says
  the fit's own margin on the rest box, by reading the CSS — unproven in a browser.
- Save the Date is not wired (its cover is the film; needs its own design).

## The owner's three open points (2026-10-09)
1. "A still stretch read as stuck" — MEASURED on the real guest page for the cover's hold (block 16, "no still
   stretch"): green at four sizes — something a guest can see changes at every sampled position (≤ 16 px). NOT
   measured for scene-to-scene hand-overs: there the approved ~30 %-of-a-screen rest between two back-to-back
   hand-overs IS a still stretch (≈ 244 px at 812). Which stretch he saw is not known — ask for the recording/page.
2. "The heading clipped at the top on iPhone" — in Chromium nothing that arrives is ever under the pinned top bar
   while the page is held (block 16, real page: the bar ends 69 px, arrivals begin ≥ 99 px; block 12: a long arrival
   stands ON the stylesheet's line). A long list's heading leaving the top while its rows are scrolled through is
   the approved rule. iPhone itself: NOT VERIFIED — nothing has run on WebKit.
3. "The cover as hand-over zero" — BUILT on the real page (guest + stranger), dark; proven on the real `SiteBody`
   markup in Chromium, 375×812 first; pictures `c16-real-…-together.png`, `c16-stranger-…-together.png`.

## Next three steps
1. Fix the touch check (above), then run the WHOLE browser check under the lock on the tip; read every stranger row.
2. `next lint` + the sweep on the tip, each alone under the lock; regenerate the controls baseline if more than its
   ref line changes.
3. Hydrate the first-screen fit on a check page (or walk the lab's published state) and compare the wrapped
   stranger page with today's on a SHORT phone (375×667), where the fit closes the door's margin.

## How to run the walk
- Guards: from `apps/web`: `../../node_modules/.bin/tsx --test lib/site-body-fixture-render.test.ts lib/scrub-is-a-held-hand-over.test.ts`
- Browser check (HEAVY — `~/Documents/Claude/Projects/heavy-lock.sh acquire scrub-real` → ONE run → `release scrub-real`):
  `node scripts/scrub-browser-check.mjs <playwright-dir>/ <scratch-dir> [pictures-dir]`; one block: `SCRUB_ONLY=16`
  (15, 17 too). It writes the real guest/stranger pages itself (`scripts/scrub-fixture-page.tsx`), with Scrub
  offered for that process only.
- The switched-on arm of the fixture guards: flip the constant BY HAND, run, put it back (never commit it).
