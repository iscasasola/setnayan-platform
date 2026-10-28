## 2026-10-28 · feat(guests): R4 — Seats and March join Guests (List · Map · Seats · March); every old door forwards

Owner, 28 Oct: *"On guests we have things to move there: March, Seat, Rsvp"* (RSVP was R1, #7019) · Q7/Q8 *"3D plan:
yes, inside Seats"* · *"all mapping will be kept"*. R4 of `EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` (DECISION_LOG
2026-10-27 "GUESTS = LIST · MAP · SEATS · MARCH; RSVP SETTINGS LIVE IN THE GUESTS ⚙"). Moved whole — nothing redrawn.

- **Guests' view row** (`guests-screen.tsx`, the shipped pill selector extended — the owner-approved Guests selector is
  this segmented row, "PINNED ROWS KEEP THEIR SELECTORS — SIMPLIFIED"): **List · Map · Seats · March**, each a link
  (`lib/guests-views.ts` — one place for the views, their words and every address). Seats where the type has a seat
  plan (`surfaceEnabled(…, 'seating')`); March where the role set prints an entourage (`marchOffered`) and only for the
  couple (it drafts into their Event Hub draft). The ⚙ stays at the row's end on every view. Map is still the guest tree.
- **Seats** = the shipped seat plan page drawn in place (`seating/page.tsx` `host=guests`): the same `SeatingEditor`,
  its same Details shell (2D · 3D room · List · the guests' map = the Indoor Blueprint's wayfinding · the rules ·
  "Show guests their seats early"). Its two side parts — the place, the guests — are this view's own slots now
  (`seat-plan-in-guests.tsx`: place · plan · guests from 1024, plan · guests from 768); on a phone it is the Studio's
  approved phone seat plan (the map the screen, the people a pull-up sheet). It owns its height to the bottom dock.
- **March** = the shipped Wedding March maker (`details-march.tsx` `MarchMaker`) on the very reads its Maker item had
  (`loadMarch`, the saved section order, the drafted moves — `lib/march-as-drafted.ts`, now ONE builder for both). Its
  save is unchanged: the Event Hub draft, live with ✓ Apply (owner 2026-10-06 "Wait for apply"), said under its ⓘ.
- **Studio:** the Wedding March and Seat plan tiles are gone (`STUDIO_TILE_KEYS` 10 → 8; their cards, icons, words and
  counts). "n of N ready" counts the eight. The Maker draws only a door to each (`guests-view-door.tsx`) — never a
  second copy of either maker — and no longer streams the seat plan page or preloads its chunk.
- **Home's progress / the guided flow:** the march and seat-plan steps are LINK steps to their Guests view (R1's
  shape) — the same facts, the same states, counted in the same place, so Home never reads "Missing" for finished work.
- **Every old door forwards** (decided by the address alone, before any read): `/launch?tool=details&item=seating|march`
  (carrying `seat`) → the view; `/seating` (+ `?view=list`) → Guests › Seats for everyone; `/plan3d` → Seats' 3D room
  (the control centre page retired — its one switch is the seat plan's own row); `/studio/indoor-blueprint` → Seats'
  guests' map; the Guest list's `?gview=walk` / `?view=march` → Guests › March. The Hub parts' doors (the march, a
  guest's role, their seat) say "Open in Guests › March / Seats". The seat plan's pages light Guests on the rail and
  the bar; their backs go to Guests › Seats (`lib/page-home.ts`, `BackButton route=`).
- **Guards:** `lib/r4-seats-march-forwards.test.ts` (6 tests, each sabotaged red once). Superseded guards re-aimed to the
  new truth (Studio counts, the seat plan's Details wiring, the menu lighting, the guided plan, the part doors).
  Regenerated: port, Ugat screens, root-map and design-rules baselines.
- **Dark mode:** the march's walk rows and tray chips wore `bg-white` (the Maker draws light only); in Guests they take
  the house's dark surface (`dark:bg-raised`, the 37-site convention) — walked in the app's dark class.
- **Lab:** `/dev/guests-lab?part=screen&gview=seats|march` draws both views on fixtures (a fixture id no real event can
  have; nothing is written).

⏳ Owner: the March in Guests still waits for the Event Hub's ✓ Apply (as ruled 2026-10-06) — keep, or save live like
the rest of Guests? · the Parents & hosts list that sat under the Maker's march stays in Info (not under Guests › March).

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` row 6 (R4) marked built
(draft PR, not live); DECISION_LOG 2026-10-27 "GUESTS = LIST · MAP · SEATS · MARCH" — the Seats + March half built.

## 2026-10-29 · feat(guests): R4 round 2 — Seats and March follow the Guests screen; views switch with no request

Owner on #7028's side-by-sides (28–29 Oct): *"the label of 20 walks, 34 walking can be like the carousel row of guests"* ·
*"improve the way the seats are created on list, 2d and 3d … follow the screen"* · *"always maximize the screen use"* ·
*"fastest load and fewest requests"* · *"tapping a seat can show a guest card"*.

- **Summary row:** March and Seats lead with the Guests carousel's OWN cards (`view-summary-cards.tsx`, the shared
  `SnapCarousel` + `guests-screen.module.css`): March — "34 walking · in 20 walks" · Walks · Walking · Not walking (a door
  to the tray); Seats — "19 seated · 9 still to seat" · Tables · Seated · To seat (a door to them). A count nobody could
  read says "—, couldn't read", never 0. The loose "Drag the names ⓘ" heading went into the card's ⓘ.
- **Seats wears the Guests chrome at every width:** head (Seat plan · ONE mode dropdown List · 2D · 3D — the shared
  PickMenu · Edit · ⋯) → the summary row → the plan → the frosted thumb row at the foot (Auto arrange · Rules ▾ · ＋ ·
  on a phone the people's door). The desk command bar and the room's own pill segment are not drawn in Guests. Phone:
  the people are the house `Sheet`; ≥768 the side panel; ≥1024 place · plan · people.
- **Seats › List = foldable tables of faces** (`seat-faces-list.tsx`, the house `.sn-acc-head`): "Table 3 · 8 of 10",
  the guests as faces (photo, else initials), one dashed blank per free seat; "To seat" leads. A face — in the list AND on
  the 2D plan — opens the SHIPPED guest card (`GuestCardSheet`, new `seats` reader) with Remove · Swap; a blank raises the
  pop-up bar "Pick a guest ▾"; Swap picks them up and the next seat tapped is theirs (blank: move; face: trade — built
  from the two shipped writes, `swapSeats`).
- **No request on a switch:** List · Map · Seats · March switch in place (`replaceState`); both makers are streamed with
  the page and mounted on first open, then kept. Seats' List ↔ 2D ↔ 3D likewise — the 3D room is streamed with the
  page and its code loads on first open; leaving it re-reads the plan once (`router.refresh`, the room may have moved a
  table).
- **Screen use:** Seats is full-bleed on a phone; March uses the width (the tray is a side panel from 1024) and no
  longer overflows at 375. Dark mode on the march rows (`dark:bg-raised`).
- Guards: `lib/r4-seats-march-forwards.test.ts` test 7 (summary row + honest unread · ONE mode dropdown · thumb-row verbs
  · faces + blanks · a face opens the one card), sabotaged red twice; the one-card, lazy-pieces and one-render guards
  re-aimed.

Not built in this PR (follow-ups, flagged): the 2D table pop-up toolbar's Duplicate (the engine has no duplicate — the
table's shipped dock holds Type · seats −/+ · Rotate · Edit chairs · Link · Delete), March's groups as foldable headers,
the pinned-row dropdown in the shared row, and Guests › Requests (an immediately-following PR).

## 2026-10-29 · feat(guests): R4 slice 3 — ONE fixed count row on Seats and March

Owner (prototype v12): *"walks walking and not walking needs to be fixed together, maybe we can use this row to add the
preview walk so it is not lost?"*. Seats and March no longer swipe: `ViewCountRow` draws equal tiles at the prototype's
count-row height — Seats: Seated · Unseated · Tables · ✨ Auto arrange (the forward tile; it left the thumb row); March:
Walks · Walking · Not walking (opens the tray) · ▶ Preview, disabled and saying "The walk preview is coming" (no walk
preview ships yet). Unread counts read "—". Guard: `lib/r4-seats-march-forwards.test.ts` test 8.

## 2026-10-29 · feat(guests): R4 slice 1 — ONE thumb row on every Guests view, ONE shared ⇅ (Show · Group by · Sort)

Owner (prototype v12–v26 `renderThumb` / `filterSheet` / `setShow`): every Guests view wears THE shared
`components/thumb-row.tsx` — List ⇕ · Search guests · ⇅ (the shipped seats, no ＋) · Map Search · ⇅ · ＋ Add guest ·
Seats ⇕ (List mode) · Search guests · ⇅ · ＋ Add ▾ (New table · Entrance · Service door · Dance floor · Cocktail area ·
Sign · Supplier booth — the plan's own Add menu, its handlers and refusals) · March ⇕ · Search guests · ⇅ · ＋ Add a
walk ▾ (the "Not walking" names; one picked walks alone at the end of their section — the SAME `planMove` as dragging
them out of the tray, Undo and all).
- **⇅ is ONE PickMenu** (`guests/_components/guests-filter-menu.tsx`) with Show (Everyone · Attending · Not coming · No
  reply · To invite) · Group by (List: the five shipped groupings; Map: its four) · Sort (List: Importance · Name ·
  Table), then each view's shipped items (+1 · Select… · File · ways to add; Seats' People). ✓ marks each section's
  choice; a dot on the round while anything narrows.
- **ONE state** (`lib/guests-filter.ts`): the carousel's count doors and every ⇅ write it; List and Map read one Group
  by; it is kept in the address as `?gshow=` · `?ggroup=` · `?gsort=` (g-prefixed: the page already reads `?group=` — a
  group id that narrows the server read — and `?sort=`), carried across a view switch, nothing asked of the server.
- **Seats and March** read it through the Guests lens (`guests/_components/guests-lens.tsx`): a face or a walking name
  that the Show or the search leaves out is drawn faint (never hidden — its seat is still taken); Enter goes to the first
  found. They draw the row into the Guests screen's own seat (a portal), so it slides and floats like the List's. Who
  sits together moved to the Seats head's ⋯ (nothing lost); the bespoke `GuestsSeatThumbRow` is retired.
- Seats › List table names wrap (up to three lines) instead of being cut.
- Guards: `lib/guests-filter.test.ts` (6 properties; sabotaged red three ways — a second Show state, Seats off the lens,
  a pick that swallowed a view's own key), and the List / Map / Sides / Excel / r4 guards re-aimed at the shared ⇅.

SPEC IMPACT: None — the prototype v12–v26 is the record; a DECISION_LOG row for "Map ＋ Add guest is back (supersedes
2026-10-25's no-＋ on the Map)" is flagged for the owner in the PR body.

## 2026-10-29 · fix(guests): R4 — Seats and March words wrap, never cut

Owner (prototype v15, "names never ellipsized"): the Seats › List table names, the count tiles' words, the move sheet's
guest name and the seat head's title (beside its mode dropdown) wrap (line-clamp, `overflow-wrap:anywhere`) instead of
ending in "…". Guard `lib/guests-words-are-never-cut.test.ts`, anchored per element, sabotaged once.

SPEC IMPACT: None.
