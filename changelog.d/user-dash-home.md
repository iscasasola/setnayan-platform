## 2026-11-17 · feat(home): the user dashboard's Home, cleaned up — the pinned row is the one switch

Owner, 17 Nov 2026, "Yes, all 3" on the user dashboard drawing (`prototypes/user_dashboard_clean_2026-11-17/`,
artifact JaP9vBA519Y6x3EKY9AEah). Reposition and realign only; no new server action, no new read.

- **The tab row goes.** Home no longer draws Events · People · Shop · Memories as underlined tabs. The section's ONE
  pinned row ("Events ▾" · planning · celebrated · ＋ Event · ⚙) is drawn **at rest** under the name and stays when
  the header scrolls away. Its picker lists the sections with the numbers the tabs carried (Events N · Shop N), and
  People's "N asking" is the picker's dot.
- **One way to start an event in each place.** The big "＋ Create an event" under the name and the Planning head's (+)
  go. An event is created from the row's "＋ Event", the "New event" tile, and the empty state's button.
- Shared `CollapsingTop` gains an opt-in `rowAtRest` (the row is live and visible at rest; every other top is
  unchanged). The "Your sections" tour stop now rings the pinned row.
- New guard `app/dashboard/(launcher)/home-sections-keep-the-bar.test.ts`: every Home section stays on `/dashboard`,
  the bar, rail and top bar are the layout's, and a switch is client navigation. The guards for the old tabs and the
  Planning (+) were rewritten to the 17 Nov ruling (`lib/home-is-the-profile.test.ts` 5,
  `the-add-flow-opens-the-real-picker.test.ts`).

Not in this change: Discover's pinned row and the "‹ Discover" back on See all (their files are in #7840) and the
profile menu (drawn in the event dashboard drawing).

SPEC IMPACT: None. The ruling is already in DECISION_LOG (17 Nov, "USER DASHBOARD … owner Yes, all 3").
