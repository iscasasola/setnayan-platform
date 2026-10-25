## 2026-10-19 · fix(guests): one Enter adds the guest, and the name is on the list at once

Owner, adding guests on his phone and laptop: "why does it take a lot of seconds before the name. and need to enter
button twice to add … adding multiple person needs to be fast and easy" · "we want to see added name realtime and fast" ·
"i type a name and it is not found there. when i press enter that should add that person there already".

- **Search or add — one Enter.** On the Guests list's box, Enter on a name that matches nobody adds that person on the
  spot (the shipped capture-bar grammar + `addSingleGuest`); it used to open the add sheet with the name in it (a second
  Enter). One match → Enter opens that guest; several → stays filtered; a filter word that finds nobody ("best man",
  "no reply", a group's name — `typedLineIsAFilter` / `isSearchVocabulary`) is never added as a person; a lone first
  name is told "Add both a first and last name." at once and never sent.
- **The name shows before the server answers.** A new ordered queue (`guests/_components/guest-add-queue.ts`) draws
  each typed name immediately ("Adding…" → "Added") at the top of the List and under the box in the + sheet and Quick
  add (`just-added.tsx`); writes go out one at a time in the order typed; a refused or failed write stays on its row with
  the plain reason, Retry and Remove — it never vanishes and never reads as saved.
- **No whole-page redraw per add.** `quickAddGuest` / `addSingleGuest` take `{ refresh: false }` from the queue and skip
  `revalidatePath`; the list re-reads ONCE when the queue is empty (10 names → 1 redraw, was 10). Every other caller is
  unchanged (the option is absent → as before).
- **Rapid entry fixed.** The + sheet's box refused Enter while an add was out (`if (pending) return`) — 8 of 10 names
  typed in a row were dropped and one came back cut. Now 10/10, in order, no duplicates. Quick add: a whole name typed in
  First adds on ONE Enter (only a lone first name moves to Last); its boxes clear and First keeps the focus at once;
  Side · Role · Group stay as picked (#782).
- **The Add card (2026-10-20, approved prototype `guest_group_and_fast_add_2026-10-20.html` strip B · DECISION_LOG
  2026-10-20).** "Nobody matches “…”" now carries Side · Role · Group · Plus, two by two, sticky for every next name
  (`search-add-card.tsx`): Group is ONE multi list (one standard group → `group_category`, own groups ticked →
  memberships, ＋ New group… made in place); Plus = the card's "Extra seats" (None · +1 … +4) → the shipped
  `plus_one_count` + `syncExtraSeats` "+1 · TBA" rows. What is typed wins over a pick ("vip", "+2", "#Choir").
  "Ninang Rose" is kept as a name (it was refused as half a name).
- **Search or add looks in your People.** The same read as "Add from your people" (`listPeopleYouCanInvite`); a match
  not on the list shows under "FROM YOUR PEOPLE · NOT ON THIS LIST YET", one tap or Enter adds the first with the four
  picks — `addGuestsFromPeople(…, picks)` now routes through `addSingleGuest` with the address People holds. A list
  match still opens that guest. The title reads "Not them? Add “…” as new".
- Lab: `/dev/guests-lab?part=screen&addMs=N` (adds answer after N ms; a name with "Refuse" is refused); the + sheet and
  Quick add are now mounted INSIDE the lab's stand-ins (the + sheet's add used to reach the real action).
- Guard: `one-enter-adds-one-guest-at-once.test.ts` (10 checks, each sabotaged red). Seven existing guards re-pointed
  from the capture bar's old await/toast to the queue.

SPEC IMPACT: None — implements DECISION_LOG 2026-10-20 (search-or-add, part 3) and the approved prototype's strip B; no new decision.
