# Scrub — the cover's hand-over on the REAL invitation page (HANDOVER — round 3, 2026-10-12)

Branch `rd/scrub-cover-on-the-real-invitation` · worktree `~/Documents/Claude/Projects/wt-scrub-real` · draft PR
(see the round-3 section). **Built, not live.** `lib/scrub-out-offered.ts` `SCRUB_OUT_OFFERED = false` — do not turn it on.
Everything proven is proven in **Chromium only**; nothing has run on iOS Safari. Stopped at the account's limit.

## Round 3 (2026-10-12) — commit 0ac615287 and after
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
- WHOLE browser check on 8bded5d45 (walk lane, every block): **536 ok · 4 FAIL — all four the names-under-the-bar
  finding above** (375x667 guest, 375x667 stranger text, stranger photo 375x812 + 1280x770). Every other stranger
  row green at all sizes (boxes unmoved without script, chapters, one pair, still page, TOGETHER, whole arrival,
  nothing over, back == down). Touch rows green. Fit rows green at 375x667 and 375x560.
- Sabotage (block 16 in a throw-away worktree): a non-passive touchmove listener in the engine → the touch-listener
  row RED; the cover's out scaled ×1.3 → "the travel IS the Build out" RED (65 % out, drawn 0.35, for 50 % travel);
  the fit's stand-aside removed → the 375x560 fit rows RED (the page length flips 1578 ↔ 1295). The source pin in
  `the-first-screen-keeps-its-action.test.ts`: RED when sabotaged, green restored.
- `next lint` (whole app, under the lock): rc 0, 0 errors, 15 warnings — none in a file this branch touches.
  Controls baseline: the generator changes only its ref line → left as is (not regenerated).
- Quick preflight (guards, lint, types, pins) on 6e72d252b: 46 checks, nothing failed.
- The sweep on 893a0c1f2 (under the lock): 428 test files (every `app/[slug]` test + every test naming site-body,
  maker-scene-list, guests-see, hub-draft, what-guests-see, stage-scenes, part-door, part_show, first-screen, scrub,
  get-inside) → 3,673 tests, 3,673 pass, 0 fail, rc 0, 124 s.
- Short-phone comparison 375x667 (pictures `c16-stranger-fit-375x667-{today,wrapped-0-opens,wrapped-1-held}.png`,
  `c16-stranger-375x667-3-arrived-together.png`): TODAY the fit closes the cover up and "Get inside" is on the first
  screen (534–590). WRAPPED the cover opens at full air (its link cut at the screen's foot), the door is NOT on the
  first screen — it arrives with the Countdown after the cover builds out (98–412) — and while held "Maria" is under
  the pinned bar. Owner point: "the first screen keeps its action" (main's fit) and "the cover as hand-over zero"
  (the action arrives after the cover) meet here; under Scrub the second wins by construction.

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

## Left (not done)
- 🔝 THE NAMES UNDER THE PINNED BAR (block 16's four red rows) — owner decision, not engineering: a cover taller than
  the room is held by the ordinary rule (bottom on the centre line). Candidate answers for him: (a) a cover is held
  with its TOP on the page's line instead (its foot may then run off the screen); (b) let the first-screen fit close
  the cover's air under Scrub too, so a 375x667 cover fits the room and is centred (the fit's air alone would take the text
  cover from 582 px to roughly 500 — ESTIMATED from today's fitted page, not measured wrapped; the room is 544) — does not help the photo cover; (c) a cover that cannot be held whole
  is not held at all (plain scroll). Until he picks, the rows stay red on purpose.
- Save the Date is NOT wired this round (its cover is the film, with a walker of its own: needs its own design).
- iOS Safari: nothing has run on WebKit. The list for the owner's iPhone is in the PR body and below.
- `STRANGER_TEXT_COVER_BOXES_DOOR_FIRST`'s fit margin on the rest box is now seen in a browser with the fit running
  (reduce motion: today's fitted page box for box) — no longer unproven.

## For the owner's iPhone (Safari), once a page is switched on for him (lab or preview — never `cale-ice`)
1. A slow finger drag from the cover: the page moves with the finger, the cover stands still and fades — no stick,
   no jump, no "stuck" stretch.
2. A hard flick through the cover: the hand-over finishes; "RSVP"/"Get inside" and the Countdown arrive whole.
3. Safari's bars collapsing/expanding in the middle of the hold (scroll a little up and down): the cover must not
   jump. The engine re-measures on `resize`; WebKit fires it as the bars move.
4. The heading at the top: is "Maria" under the top bar while the cover fades (the red rows above)? On an iPhone with
   the bars shown the screen is "short" (~660 px) — this is likely what he saw.
5. Scroll back up: everything comes back the way it went.
6. Rubber-band at the very top (pull down): the cover doesn't shift or flicker.
7. Settings › Accessibility › Motion › Reduce Motion ON: the plain page — today's — and the stranger's "Get inside"
   on the first screen (the fit makes room).
8. Turn the phone sideways mid-hold and back.
9. The stranger's page: tap "Get inside" after it arrives — it opens and scrolls clear of the bottom bar.

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
1. The owner's answer on the names under the bar (a/b/c above) → build it; the four red rows go green.
2. Save the Date's own design for its film cover, then wire it.
3. The iPhone walk (list above) with the owner.

## How to run the walk
- Guards: from `apps/web`: `../../node_modules/.bin/tsx --test lib/site-body-fixture-render.test.ts lib/scrub-is-a-held-hand-over.test.ts`
- Browser check (the WALK lane — `~/Documents/Claude/Projects/heavy-lock.sh acquire walk:scrub-real` → ONE run → `release walk:scrub-real`):
  `node scripts/scrub-browser-check.mjs <playwright-dir>/ <scratch-dir> [pictures-dir]`; one block: `SCRUB_ONLY=16`
  (15, 17 too). It writes the real guest/stranger pages itself (`scripts/scrub-fixture-page.tsx`), with Scrub
  offered for that process only.
- The switched-on arm of the fixture guards: flip the constant BY HAND, run, put it back (never commit it).
