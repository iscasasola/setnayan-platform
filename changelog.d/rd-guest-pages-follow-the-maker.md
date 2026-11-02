## 2026-10-08 · feat(hub): a guest's pages are filed like the Maker's — one filing for both

**Changes LIVE guest pages — merges only after the owner's side-by-side OK; not part of any train.**

Owner, 2026-10-08 (DECISION_LOG "EIGHT OWNER ANSWERS", answer 5). Asked: *"the Maker now files parts by the
prototype (for example Countdown on Welcome), while guests' phones still use the old filing (Countdown on Details).
Should the guest page change to match?"* — *"yes"*. Still holding: 2026-09-30 *"each menu gets their own full page
scroll"* and 2026-10-07 *"yes pages"*.

**One filing.** `lib/maker-stage-filing.ts` gains `prototypePageOf` (the prototype's page for a canvas key —
`MAKER_STAGE_PAGES`), read by BOTH `makerStagesPageOf` (the Maker's Stages canvas, unchanged answers) and the new
`readerPageOf` (a guest's page). `app/[slug]/_components/site-body.tsx` asks it for every part a guest is drawn
(`readerAt`), so a part the prototype names can no longer be on one page for the couple and another for the guest.

**The fallback, stated.** A reader's tabs stay the tabs of their OWN bar (a tab with nothing behind it is not drawn).
A part falls through: the prototype's page (when the reader's bar has it) · the tab it asked for before this ruling ·
the nearest tab above that in `HUB_TAB_ORDER` (live · home · details · story · gallery · me) · the bar's first tab.
A section no part names (the checklist, the reply lines, the scan-trail switch, the song request) is not moved.

**What moves for a guest** (tab before → after):

- Invitation — Countdown, Message: Details → Welcome (drawn in the prototype's order: reply card · countdown ·
  greeting · message · E-Gifts). The guest's own look: Welcome → Me (only where Me's four for-each-guest parts do not
  already say it). The seat line: Welcome → Me (Me already carried the same line; it is now there once).
- The Day — the guest's table (floor plan): Welcome → Me, before the ticket. The couple's Venue and Dress code scenes:
  Live → Welcome. The walking order for a reader without a key: Live → Welcome (a guest already read it there).
  The "Happening now" card: Welcome → Live. The couple's own seat finder: Welcome → Me ("Manage"); a supplier's stays
  on Welcome (their bar has no Me). The couple's Photos scene, where it is on the day: Live → Gallery.
- A booked supplier on the day: the programme leaves Welcome for Live (it had fallen there off the "Cues" tab their
  bar does not draw).

**The bar stays honest.** A Details tab is drawn only when a scene's own page is Details (a couple with only a
countdown and a message no longer gets an empty Details tab — `#site-details`, which the cover's "the day, the place,
the story ↓" names, lands on the Welcome's scenes there). The day's Welcome is drawn when its own parts or a scene
filed on it exist; a guest's table no longer makes the tab by itself.

**Not changed.** Whether anything is shown: every withholding rule (venues, seat, pass, E-Gifts, private chapters) is
untouched. Save the Date and Post Event (single pages). The Maker's Stages canvas — its arms read what they read
before; a See as sample guest's page in that canvas is the guest's page and follows it.

Guards: `lib/a-guests-pages-are-filed-like-the-makers.test.ts` (the real bar resolver and filing over a roster of six
readers × two stages × three events; every `group(…)` of both trees accounted for), and extensions to
`every-stages-tab-has-its-own-page`, `each-tab-is-its-own-page`, `the-stage-pages-are-the-prototypes`. Five pins
amended with the owner's words (`the-day-guest-pages`, `the-invitation-opens-on-the-mark`, `the-hub-is-cards`,
`the-panel-follow-ups-are-real`, `welcome-is-the-guests-own`).

No migration. +0 server actions. No new client code (the filing runs in the server component). Nothing on the Maker's
first load or in the shared bundle imports the new functions.

SPEC IMPACT: `STAGES_PANEL_BUILD_STATUS_2026-10-08.md` — "Round 6 — the guest follows the Maker" (the before → after
table, the fallback order, the deviations to confirm). No decision row changed: this builds DECISION_LOG 2026-10-08
"EIGHT OWNER ANSWERS" answer 5 as written.
