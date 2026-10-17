# HANDOVER — rd/hub-follow-ups-2026-10-18 · started 2026-10-18 ~05:30 PHT by the controller

Owner approved the day's list ("all builds for today"); these are the small Event Hub follow-ups the 2026-10-17 builders
named as left. Each is its own commit with a test + sabotage (where testable) + 375 px WebKit shot before/after.
Verify each on this branch first; if a finding does not reproduce, say so and skip it. Rule 0: extend, never redraw.

1. FONT HAND-BACK on the canvas for Text and Labels & buttons. PR #6610 (`d8a61081f0` "a Names font handed back shows on
   the canvas", branch rd/names-font-reaches-event-title) fixed it for Names only; its builder said Text and Labels &
   buttons "likely have the same hand-back gap (same nested-look cause, not walked)". Walk it; apply the same fix.
2. TEXT COVER ON SHORT PHONES (maria-and-jose shape): the cover is ~825–835 px tall at 375 wide; at 375×667 the
   "Confirm your Booking"/door lands just below the fold (y 660–716) and under the cookie notice. Make the door sit on the
   first screen at 375×667 (the earlier first-screen fit did this) without changing 375×812 or desktop.
3. PRINTS READ THE OLD DRESS-CODE FIELDS: prints still read the old group/role dress-code fields; the guest page now
   reads the by-role picks (#6612 era). Make prints read the same source the guest page reads.
4. MOOD BOARD COLOUR SEARCH shows the same swatch twice → de-duplicate (by hex + name), keep order.
5. STALE-RENDER SHAPE in `DressFiguresRow` and `useBlockLooksDraft` (named by the Closing builder 2026-10-17 as the same
   stale-render shape it fixed elsewhere) — read its fix, apply if the same bug reproduces.
6. HOST LANDING 14 px EDGE: a 2026-10-17 walk reported the host landing's content sits 14 px from the screen edge at 375
   (house gutter is 16 px). Measure; fix if true; skip if not.
NOT IN THIS PR (name them in the PR body as left): call times → Studio (no owner ruling yet), E-Gifts money spray
"a way to give" (needs a design), own-section photos on the phone (owner's design call).

Other builders running now: rd/two-hosts-never-overwrite (host SAVE paths — Mood Board/Dress Code editor saves, Maker
draft save/Apply, guests, seating) and rd/guest-page-cache (app/[slug]/page.tsx, _lib/loaders.ts, lib/entitlements.ts,
redeem, guest-session). Do NOT touch those files; if an item needs one, leave the item and say so.
Shots → ~/Documents/Claude/Projects/shots-2026-10-18/<pr>/. Changelog fragment changelog.d/rd-hub-follow-ups-2026-10-18.md.

---------------------------------------------------------------------------------------------------------------------
## BUILDER STATE (2026-10-18)

| # | Verified? | State |
|---|---|---|
| 1 | REPRODUCED on the real guest markup in the canvas's two scopes (Chromium+WebKit): handed back, buttons stayed live face (Classic+theme), theme eyebrows stayed it, Classic text stayed it | FIXED `globals.css` nearest-scope rules + `--hub-page-text-face`; guard `app/[slug]/_components/a-font-handed-back-shows-on-the-canvas.test.ts` (3 sabotages red); shots item1-* |
| 2 | named gap in `tests/e2e/the-strangers-cover-keeps-its-order.spec.ts` docblock (foot door unfitted, `FirstScreenDoor fit={false}`) | FIXED `FirstScreenDoor foot` (whole foot is the fitted block, door's limit; <1280 only); e2e re-aimed + 320×568 added (24/24 local; sabotage `fit:false` → red at 667/568); shots item2-* |
| 3 | REPRODUCED: print printed "Maid of Honor — Cocktail dress", no women's pick | FIXED `dressCodeLines` (lib/dress-code-for-everyone.ts) read by print-set; guard `lib/the-print-says-the-pages-dress-code.test.ts` (2 sabotages red); shots item3-* |
| 4 | REPRODUCED: `searchColorNames` listed "Coral"/"Gold"/"Navy"/"Plum"/"Forest Green" twice (wedding + CSS, hex-only dedupe) — 45 queries | FIXED `lib/color-search.ts` `listedOnce` + sweep test (sabotage: main's file → red) |
| 5 | `DressFiguresRow` not mounted (`<DressFiguresRow` 0 hits); `useBlockLooksDraft` race is a Maker draft save — the lane of rd/two-hosts-never-overwrite (merge-from-base) | SKIP (named in PR body) |
| 6 | NOT REPRODUCED: Home (`/dev/home-lab`, real `HomeFirstScreen` in the layout's own `px-4`) and `/` at 375 — no box under 16 px (WebKit+Chromium); real layout wrapper is `px-4` | SKIP |

NEXT: draft PR, label, disable auto-merge, CI loop. Walk server stopped, lane released, .next removed.
