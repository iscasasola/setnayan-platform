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
