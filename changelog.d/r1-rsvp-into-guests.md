## 2026-10-28 · feat(r1): RSVP leaves Studio for the Guests ⚙ sheet — every old door forwards there

Owner, 28 Oct: *"Why is the event hub's studio pages are all still there"* → *"When will we start moving them?"*
R1 of `EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` (DECISION_LOG 2026-10-27 "GUESTS = LIST · MAP · SEATS · MARCH;
RSVP SETTINGS LIVE IN THE GUESTS ⚙").

- **Studio:** the RSVP tile is gone (`STUDIO_TILE_KEYS` 11 → 10; its card, icon, words and the no-guest-list hide
  rule went with it). Studio's "n of N ready" counts the ten that are there.
- **Guests ⚙ (the shipped `GuestSetupRows`):** gains the two reply settings ONLY the tile held — **How guests answer**
  (All at once · One by one, `oneAtATime`, ONE PickMenu dropdown like the rows beside it) and **Replies open ▾ · Replies close ▾**
  (the Maker's `RepliesWindowRows`, mounted as-is) — beside RSVP asks and Reply by, which were already there. Same
  `rsvp_ask_config` keys, same draft door (`hubDraftAction`); two new `SETTINGS_ROWS` (`answer`, `replies-window`).
  The reply page's own words (eyebrow, question, hint, Yes/No) and the When-yes Celebration stay on the Reply page,
  typed on its lines in the Invitation stage — where guests read them.
- **Every old door forwards (owner: "all mapping will be kept"):** `/launch?tool=details&item=rsvp` →
  `/guests?settings=1&row=asks` (`MAKER_ITEMS_MOVED_TO_GUESTS`, the launch page's first step); the RSVP stage's
  "Open in Studio › RSVP" door → "RSVP settings in Guests" (a plain link to the sheet's row); the guided flow's How
  guests get in · What to ask · Reply by → link steps to their Guests ⚙ rows (Home's count unchanged: same facts,
  same states).
- **Help:** the Guests tour names ⚙ as the RSVP's home; the RSVP form's ⓘ says where its settings live; the Prints
  "Kindly reply" tip no longer names the Studio RSVP page.
- **Guard:** `lib/r1-rsvp-forwards.test.ts` (5 tests, each sabotaged red once). Port baseline regenerated.

Not removed (flagged): the Maker's own RSVP panel (`MakerRsvpSettings` with `studio`, the launch page's `rsvpItem`)
is now reached by no door — the Reply page's stage keeps its own copy of those rows; deleting the dead branch and
its guards is a follow-up.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` step 5 (R1) marked
built (draft PR, not live); DECISION_LOG 2026-10-27 "GUESTS = LIST · MAP · SEATS · MARCH; RSVP SETTINGS LIVE IN THE
GUESTS ⚙" — the RSVP half built.
