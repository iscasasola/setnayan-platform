## 2026-10-25 · feat(guests, people): search is the add — no round ＋ on the guest list or on People

Owner, verbatim: *"Yes, remove the + on the guest list. Typing in the search adds; put From People, Import and Scan
in the search results and the menu. Do the same on People."* (after *"why is there still the add button if the search
bar is the add button"*).

**Guest list** (`guests-screen.tsx`, list and map): the thumb row is ⇕ · Search guests · ≡ — the round ＋ (`addRound`)
is gone. Enter with no match still adds (`addTyped`, unchanged). While words are typed and the list has hits, the
FIRST result is "Add “…” as a guest" (the same `addTyped`; a one-name line opens the add sheet with the name) and
then "Add another way" — the shipped `AddDoors` rows (From your people · Add with details · Import a file · Paste
many names), two to a line. That box is marked as the first result, so the search pin shows it with the hits under
it. With no hit, the no-match card's pinned box holds the same Add and the same ways. ≡ (Sort, and Arrange on the
map) now also lists the four ways, read from ONE list (`ADD_WAYS` in `add-guest-sheet.tsx`, also the sheet's
"Add another way" dropdown) and opened by ONE opener (`openAddWay`, the imported sheet openers). The empty list keeps
its "Add a guest" (the add sheet). The read-only last copy offers none of it.

**People** (`find-or-invite.tsx`, roster + the other views): the row is ≡ · Find or invite — `InviteAction`'s
＋ Invite is gone. A typed name's first result is `InviteCard`: "Invite “…” by email" (details in the ⓘ), the email
box in place, the shipped `addPersonConnection`. The invite sheet (`InviteSheet`, same two fields) opens from
≡ → "Invite someone" on every People view. "Invited …" / an error now draws above the list (`FindNotes`), so it no
longer vanishes with the results when a successful invite clears the line.

**Not built — "Scan":** no scan-a-list way ships to add guests (re-measured on origin/main); not invented. Open owner
question, recorded in DECISION_LOG 2026-10-25. **Desktop capture bar:** already off the page on main (only the add
sheet's name box remains) — nothing to de-duplicate.

Tours: the guest list's ＋ stop and People's ＋ Invite stop are gone (their ≡ / field stops say where adding lives).
Port baseline regenerated for the genuine moves only (`InviteAction`, `addRound` out; `InviteCard`, `InviteSheet`,
`FindNotes`, `TypedWays`, `InfoTip` in). `lib/ugat/screens.generated.json` regenerated.

Guards: `guests/_components/search-or-add.test.ts` (render: no ＋, Add + ways first, no-match carries them, ≡ holds
them, Enter still adds), `thumb-row-order-and-field-share.test.ts`, `the-phone-guest-list-is-frame-2.test.ts`,
`people/people-wears-the-guest-list.test.ts` (no ＋ Invite, invite first, ≡ Invite someone),
`lib/a-search-pins-its-first-result.test.ts`, `lib/a-finished-event-reads-as-finished.test.ts`,
`a-failed-refresh-shows-the-last-copy-as-old.test.ts`, `lib/help-tips-and-tours-name-what-ships.test.ts`,
`lib/spotlight-anchors-exist.test.ts`.

SPEC IMPACT: DECISION_LOG.md row 2026-10-25 "SEARCH IS THE ADD — NO ROUND ＋ ON THE GUEST LIST OR ON PEOPLE"
(supersedes, for these two rows, 2026-10-01 "PHONE GUEST LIST: ONLY THE ROUND + ADDS", "DESKTOP GUEST LIST: A QUICK
ADD BOX ON TOP", "ONE WAY TO ADD A GUEST, EVERYWHERE: THE ROUND +", and the 2026-10-22 "＋ Add is always there"
answer); flags "Scan" as an open owner question.
