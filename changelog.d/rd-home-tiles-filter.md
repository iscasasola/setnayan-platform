## 2026-10-08 · fix(home): COMING and NO REPLY open the guest list filtered to those guests; one "no reply"; "0% paid · Budget ›"

Owner (2026-10-07): *"pressing this will show all guests who accepted requests"* · *"no reply will show all guest who have not yet answered"* · *"opens budget"*.

- COMING opens `/guests?q=coming` and NO REPLY opens `/guests?q=no+reply` — the Guests page's own `?q=`, which seeds its search box, so the couple sees the filter and can clear it.
- ONE definition of "no reply", `hasNotAnswered` (`lib/guest-roster-view.ts`): every counted guest who has not answered, invited or not, never the couple or celebrants. It is used by the Guests counts line (`rosterStats().none`), the "no reply" search word, and Home's tile (the page hands `rosterStats(guests).none` to `homeFacts`). Before this, Home counted every pending guest and the list showed only invited-and-silent ones, so the tile and the list could disagree.
- The money line reads "0% paid · Budget ›"; it still opens `/vendors?part=budget`, which renders the Budget view itself (`vendors/page.tsx` returns `<BudgetPage>` for `part=budget`).
- New: `home-tiles-open-their-guests.test.ts` checks that each tile's link carries its filter and that the tile's count equals the rows its filter shows on one fixture (sabotaged twice: link dropped → red, definitions split → red). 4f's `search-understands-words` and `counts-equal-the-rows` now follow the owner's definition.

**Added 2026-10-08 (the doors between Home ↔ Guests ↔ sending):**

- On Guests › List, "N to invite" in the counts line is now a door: when N > 0 the count and its words are one link into the send run (`/guests/send`), the same place Setup's "Send to N" opens — the List is the tab people land on, and it had no way to start sending. With nobody left to invite it stays plain words (never a dead link); a refused guest read still draws no counts line at all. Words unchanged.
- Home's COMING tile now reads the list's own count too: the page calls `rosterStats(guests)` once and hands `.yes` and `.none` to `homeFacts`, so both tiles and the Guests summary line come from one function.
- Tests: `counts-equal-the-rows.test.ts` now DRAWS the real screen and the real Setup rows (`render-guests-screen.ts`, the sibling of `render-setup.ts`) — N > 0 is a link into the run; N = 0 is plain words; a refused read prints no count; the List's door and Setup's door open the same place. `home-tiles-open-their-guests.test.ts` holds the one `rosterStats` call. `the-home-leads-with-one-next.test.ts` is re-aimed at the new shape. Nine sabotages, each seen red.
- Merged `origin/main` (#6405 as merged, #6409 Guests › Setup, #6418); port-control baseline regenerated.

SPEC IMPACT: None — "no reply" moves to the owner's own words (HOME_AND_GUESTS G4/G18 count and search); flagged in the PR for sign-off since it reverses 4f's "invited and silent" split.
