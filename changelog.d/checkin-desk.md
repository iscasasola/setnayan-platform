## 2026-11-16 · feat(checkin): the Check-in desk in three parts — Guests · Suppliers · Team, and ⚙ Who runs the desk

Owner, 16 Nov 2026, "Yes, as drawn" (*"checkin desk for all suppliers and coordinators and guests? a coordinator/host
control?"*; DECISION_LOG, specs 9f6ff16e; prototype `event_pages_guests_doors_2026-11-16` § "Check-in desk (three
parts)"). The shipped desk becomes one desk with three parts picked from one dropdown ("Desk · Guests ▾"):

- **Guests** — the shipped desk, unchanged (QR / name search, Mark arrived, Recent arrivals with undo, offline queue).
- **Suppliers** — an arrivals board read from each supplier's OWN shipped status presets (`VENDOR_STATUS_PRESETS`:
  On site · Setup done · Ready to start · Packed up), with "On site" checked against `supplier_own_times.arrive_clock`
  (On time · Late · Not yet) and "Packed up" against `done_clock`. No second arrival mechanism.
- **Team** — who is on the desk now, read off `guest_checkins.checked_in_by_user_id` and
  `guest_souvenir_claims.claimed_by_user_id` (Scanning · Souvenirs · Away Nm). A coordinator checks in by working it.
- **⚙ Who runs the desk** (hosts only, right-hand panel): hosts always every part; the coordinator, helpers and one
  supplier at the door get the parts the hosts pick. Start: coordinator all three, helpers Guests, supplier Off.

Every part stays mounted (switching never reloads; the scanner keeps its state). The new reads join the page's one
`Promise.all`. `checkInGuest` / `undoCheckIn` ask the same reader (`readDeskViewer`) at the write — a couple member
skips it. No new server action: the ⚙ save and the undo share ONE export, `changeDesk` (the count stays at its
ceiling, 1251). One new column (`events.checkin_desk_access`, service role only).

SPEC IMPACT: None — implements the approved drawing; no decision changed. Migration `20271357880360_checkin_desk_access`
(one nullable jsonb column on `events`, no user grant; listed in `lint-events-column-grants.mjs` NO_GRANT_NEEDED).

### 2026-11-22 · catch-up and finish (cloud builder)

- Merged `origin/main` in; the migration moved to `20271357880360` (51 migrations landed after its old prefix).
- `saveDeskAccess` + `undoCheckIn` folded into one export, `changeDesk(eventId, { kind: 'undo' | 'access' })`.
- **The supplier at the door works their part.** The 16 Nov row ("one supplier at the door each get the parts you
  choose") is newer than the 8 Nov "a supplier proposes" rule. The helper gate now gives way ONLY for the supplier the
  hosts picked in ⚙, and only for the Guests part they gave (check in + undo). ⚙ stays hosts-only. The database already
  admitted the write (`guest_checkins_member_manage`).
- **Their way in:** Event Hub › Scanner shows "Check-in desk · The hosts gave you …" (`readMyDeskDoorParts`). Before,
  only the hosts' coordinator had a Hub row.
- **Two columns from 1280** (owner "Yes, all 8", item 1): headcount, Scan and name search left; the arriving guest and
  recent arrivals right. The phone keeps one column in the same order. Undo in Recent arrivals presses at 44 px.
