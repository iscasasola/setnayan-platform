## 2026-10-08 · fix(home): COMING and NO REPLY open the guest list filtered to those guests; one "no reply"; "0% paid · Budget ›"

Owner (2026-10-07): *"pressing this will show all guests who accepted requests"* · *"no reply will show all guest who have not yet answered"* · *"opens budget"*.

- COMING opens `/guests?q=coming` and NO REPLY opens `/guests?q=no+reply` — the Guests page's own `?q=`, which seeds its search box, so the couple sees the filter and can clear it.
- ONE definition of "no reply", `hasNotAnswered` (`lib/guest-roster-view.ts`): every counted guest who has not answered, invited or not, never the couple or celebrants. It is used by the Guests counts line (`rosterStats().none`), the "no reply" search word, and Home's tile (the page hands `rosterStats(guests).none` to `homeFacts`). Before this, Home counted every pending guest and the list showed only invited-and-silent ones, so the tile and the list could disagree.
- The money line reads "0% paid · Budget ›"; it still opens `/vendors?part=budget`, which renders the Budget view itself (`vendors/page.tsx` returns `<BudgetPage>` for `part=budget`).
- New: `home-tiles-open-their-guests.test.ts` checks that each tile's link carries its filter and that the tile's count equals the rows its filter shows on one fixture (sabotaged twice: link dropped → red, definitions split → red). 4f's `search-understands-words` and `counts-equal-the-rows` now follow the owner's definition.

SPEC IMPACT: None — "no reply" moves to the owner's own words (HOME_AND_GUESTS G4/G18 count and search); flagged in the PR for sign-off since it reverses 4f's "invited and silent" split.
