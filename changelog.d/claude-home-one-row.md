## 2026-11-13 · fix(home, nav): one row of sections on Home · every bar tab keeps its last view, a re-tap goes to the top

- **Home — one row, not two** (owner 13 Nov, on a screenshot: *"the buttons and the menu events people memories are
  dupes. we want them to be simple and just 1"*). The pill doors under the name ("3 events · people · 3 service cards ·
  memories") are gone; the underlined tabs are Home's one row of sections. "＋ Create an event" stays. Nothing lost: the
  People tab now carries the "N asking" number the doors had, in the brand colour (`hot`), with "asking" in its
  accessible name. `HomeDoorsInView` and the `.door` CSS are removed. The shared `ProfileHeader` is unchanged (its
  `doors` prop is optional; the public `/u/[slug]` never passed it).
- **Every bottom-bar tab keeps its last view** (owner 9 Nov, DECISION_LOG row 44a4c660 — *"tapping home returns you to
  your last view on home"* — widened 13 Nov: *"this should apply to any menu"*). Built ONCE in the shared `BottomNav`
  (`app/_components/nav/tab-memory.ts` + `useTabMemory`), so the account, event, supplier and admin bars all get it:
  tapping another tab opens its last address within that tab AND puts its scroll back (sessionStorage, try/catch,
  keyed per bar + tab); tapping the tab you are on goes to its top in one tap — the page answers first
  (`sn:tab-reselect`), else the bar scrolls up in place on the tab's first screen or opens that first screen — and the
  tab's kept view is forgotten. Home's own section memory (`useHomeDoor` + the `HOME_LAST_SEG_KEY` write) is retired in
  favour of the shared one; Home keeps its re-tap answer (top of the section you are in).
- Guards: `lib/home-is-the-profile.test.ts` test 5 (no door row; People carries asking) ·
  `app/_components/nav/every-tab-keeps-its-last-view.test.ts` (both rules, every bar draws the shared bar, no bar keeps
  its own memory) · `the-chrome-steps-away.test.ts` and `the-bottom-bar-stays.test.ts` updated.
- Not done: risen sheets that are client-only state (not in the URL) are not closed by a generic re-tap unless the page
  listens for `sn:tab-reselect`; a re-tap deeper in a tab opens the first screen, which closes URL-driven ones.

SPEC IMPACT: None — owner simplification of the approved v3 Home, and the existing 9 Nov ruling (row 44a4c660) applied
to every bar as the owner widened it.
