## 2026-10-19 · feat(dress-code): the honour attendants get their own dress-code rows

Owner, on Studio › Mood Board & Dress Code: *"i cannot see the best man, best woman, maid of honor and matron of
honor"* → *"Best man and best woman share a row like principal sponsors. same goes to maid and matron of honor"*.

- Two new Studio rows at the head of the entourage, shaped like the sponsors' row: **Maid of Honor & Matron of
  Honor** (one person; Long gown · Cocktail dress · Filipiniana) and **Best Man & Best Woman** (For men = the groom's
  list incl. Tuxedo · For women = the maid of honor's list). Each only when the guest list has one of its roles, named
  with the event's own role names; one call time and one note per row. Stored in the existing shape —
  `dress_code_config.roles.maid_of_honor` / `.roles.best_man`, the best woman's pick in `women.roles.best_man`;
  coloured by the Mood Board slots that already covered the pairs (`maid_of_honor`, `best_man`). No migration.
- Bridesmaids / Groomsmen "N people" no longer count them; a group made only of honour attendants is not drawn.
- Guest side: an honour attendant reads her row once her Wear is picked there, else her group's row as before
  (`honourRowSpeaks` · `studioRowOf(role, config)`); the Studio says so on an undressed honour row.
- The general view (Event Hub dress-code scene, the prints) lists the honour rows like every other Studio row.
- `studioAttireRows` moved to `lib/studio-attire-rows.ts`; the dev labs build their rows with it.
  Lab: `/dev/details-lab?look=1&studio=1&attire=cale-honour`, `/dev/maker-lab/guest?attire=cale-honour&as=1&asrole=maid_of_honor`.
- Guard: `lib/the-honour-attendants-have-their-own-rows.test.ts`.

SPEC IMPACT: DECISION_LOG 2026-10-19 "THE HONOUR ATTENDANTS GET THEIR OWN DRESS-CODE ROWS" (recorded by the controller).
