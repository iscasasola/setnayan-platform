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
