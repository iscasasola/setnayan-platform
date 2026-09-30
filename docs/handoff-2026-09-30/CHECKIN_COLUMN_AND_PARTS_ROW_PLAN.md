# Build plan: CHECK-IN column, Hosts pieces move, parts row cut LAST (2026-09-30)

Companion to `GUEST_LIST_ACCESS_AND_HOSTS.md` §B. This is a read-only Fable planning pass against
`claude/charming-rubin-vgwpii` at `6e43474b6`; nothing in it is built. **The handoff session decides
how to build it** (owner, 2026-09-30). The open-PR sweep could not run from the cloud container
(`gh` is absent), so re-check the in-flight work first, especially `rd/guest-card-and-rows-redesign`,
which touches the same files.

Owner questions still open are at the bottom.

## 1 · The CHECK-IN column

**Data.** `guests/page.tsx` already reads `guest_checkins` in its `Promise.all` as a head count
(`.select('checkin_id', { count: 'exact', head: true })`). Change that one read to
`.select('guest_id, checked_in_at')`.
- `arrivedCount = rows.length` and `arrivedMeasured` stay as they are.
- Build `checkinByGuest: Record<string, string> | null`. It is `null` on refusal: a refused read draws
  no cell, never "not yet" (the `accessByGuest` rule).
- Pass `checkinByGuest`, `canCheckIn` and `checkinOpen` to `GuestListMultiselect`, next to
  `accessByGuest` / `canManageAccess`.

**Cell.** New `guests/_components/guest-checkin-cell.tsx` `GuestCheckinCell`, in the
`guest-access-cell.tsx` shape: its own file, `size='row'|'phone'`, optimistic, no reads, no
`'use server'`. It is a button, not a PickMenu (two states are not a set of choices).
- "Check in" shows "Arrived · 7:42" at once, then calls `checkInGuest(eventId, guestId, 'manual_search')`.
  A refusal restores the word and prints the error.
- Tapping "Arrived" calls `undoCheckIn`, like the desk's one-tap undo.
- Draw "—" for the rows the door refuses: `entry_source === REQUEST_ENTRY_SOURCE` and `passed_away`
  (the desk excludes both).
- A `RowCheckin` wrapper in `guest-list-multiselect.tsx`, like `RowAccess`, reads a memoised
  `GuestCheckinContext`.

**When.** `checkinOpen = phase !== 'plan'` (`getMenuLifecyclePhase`, the Check-in part's own rule in
`guestListParts`). Before the day the column is absent. The `<th>`, every `DesktopRow` `<td>` and the
section `colSpan` all key off the same flag, so `the-roster-lines-up.test.ts` stays true.

**Who may tap.** `canCheckIn = viewer.isCouple || viewer.delegatePermissions !== null`, which is
couple plus coordinator members, the same set as the `guest_checkins_member_manage` RLS and
`assertDoorCrew`. The action stays the gate; the prop only switches between read-only and a button.

**Position and width.** Between RSVP and Seat, fixed `w-[96px]`. Raise the pixel cap in
`the-header-fits-its-own-cell.test.ts` from 292 to 388, with the reason written into the test.

**Scanner, NFC, live ticket check.** Untouched. `/guests/checkin` stays the door crew's standalone page
and the day-of menu row's destination.
- `lib/roster-doors.ts`: the trailing `checkin` door becomes **"Scan tickets"** →
  `/dashboard/${eventId}/guests/checkin`, shown from the day on (via a new `checkinOpen` input).
- The carousel's Day-of segment and the wrap strip's "Who came" link already go to the desk.

**Counts.**
- `RosterMeters` gains an "Arrived N of M" meter while `checkinOpen`. M = `stats.attending`, the desk's
  own `expected`. On a refused read it shows "not loaded".
- A named plus-one has its own guest row, so it gets its own cell. Unnamed extra seats have no row and
  no check-in.

## 2 · Removing the parts row (LAST commit)

- **`guests/page.tsx`:** delete the part branch (`EventHostsPage`, `CheckinDeskPage`, both
  `PillarPartPicker`s, `guestListParts`, `GUEST_LIST_PART_VIEW`, `partPhase`). Redirect old links the
  way the existing `gview === 'walk'` redirect does:
  - `?gview=hosts` → `/guests`;
  - `?gview=checkin` → `/guests/checkin`.
- **`guests/checkin/page.tsx`:** drop the `embedded` prop; `DeskTitle` goes back to `h1`.
- **`hosts/page.tsx`:** becomes redirect-only, so bookmarks and registry rows still resolve.
  - Anyone who holds the guest list → `/guests`.
  - A delegate without it → the event Overview, whose Hosts `ExpandCard` lists every account.
  - Delete `hosts/loading.tsx` and `hosts/_components/` (their contents have moved).
  - `hosts/actions.ts` stays where it is.
- **`lib/pillar-parts.ts`:** remove `GuestListPartKey`, `GUEST_LIST_PART_VIEW` and `guestListParts`.
  Keep the Your Team parts, `partHref` and `PillarPartPicker`.
- **Doors that pointed at `/hosts`:**
  - Overview → `/guests` ("Set access on the guest list").
  - `people/page.tsx` and `lib/event-people-roster.ts` → `/guests`.
  - The `customer-menu.ts` `alsoMatch` can stay.

## 3 · The Hosts moves (git mv or extract; nothing redrawn)

| Piece | How it moves | Destination |
|---|---|---|
| Helper grants: `CoordinatorGrantChips`, `CoordinatorSeatControls`; actions `setDelegateBudget` / `setDelegatePhotos` | Extract into `guests/_components/guest-helper-grants.tsx`. Action redirects go to `/guests/${guestId}?grant_updated=1` (via a hidden `guest_id`); revalidate `/guests`. `loadGuestCard` reads the seat's `moderator_id, user_id, permissions_json`. | Guest card (`guest-card-body.tsx`) under the Access section, only when `limited_helper` and `canManageAccess` |
| Reasoned `removeHost` (the coordinator-reason select) | Not for a guest-list helper: their removal is Access → None through `setGuestAccess`. It goes with the planner. | Planner's workspace |
| Colour access: `CoordinatorColourDomains`, `setCoordinatorColourDomain`, `rejectColourChange` | `git mv` the component into `guests/_components/`. The grantee assembly becomes `lib/colour-access.server.ts` `loadCoordinatorColourGrantee(eventId, userId)`, keeping the `!seatIsFullCohost` filter. Revalidate `/guests`. | Helper's card when `limited_helper` and live; the planner's copy on the workspace |
| Delegate activity | The `event_action_log` `delegate_%` read becomes `lib/delegate-activity.server.ts` `fetchDelegateActivity`, plus a pure, tested `lib/delegate-activity.ts` `delegateActivityLine`. | Card: an "Activity" section, couple only. Overview: the last 5 lines inside the existing Hosts `ExpandCard` in `event-dashboard.tsx`. |
| Promote your booked coordinator (RA 10173 consent gate) | Extract into `vendors/[vendorId]/workspace/_components/promote-coordinator-card.tsx` (off/on-platform sections, `ConsentGatedInviteForm` git mv, pending planner seat + `revokeHostInvite`, the accepted planner's grants, reasoned `removeHost`, colour domains). Rendered when `ev.category === 'planner_coordinator'`. `inviteHost` redirects to the workspace. This replaces `colour-access-card.tsx`'s `isCoordinatorBooking`/`hostsHref` branch. | Your Team → the planner's supplier workspace |
| Old email invites | Generic form already gone. Pending planner invites show on the workspace until they expire. For legacy seats with `guest_id IS NULL`, measure prod first (query below). If zero, build nothing; otherwise add a temporary `LegacyHostSeats` block under the roster (couple only). | Roster foot, temporary |

Legacy-seat query:
`select role_subtype, (user_id is not null) live, count(*) from event_moderators where guest_id is null and removed_at is null group by 1,2`

Also fix `event-dashboard.tsx`: `acceptedMods = mods.filter((m) => m.accepted_at)` has the same
`accepted_at DEFAULT now()` bug that `08dba5bcd` fixed on Hosts. Split on `user_id` there, and print
`seatAccessWord`.

**Server-action budget** (`scripts/lint-server-action-budget.mjs`, CEILING 1225, currently at the cap):
this plan exports **zero** new actions. Every piece imports the existing action.

## 4 · Columns by device

**Desktop (`lg` and up):** every column: Name · Side · Role · Access · Groups · RSVP · Check-in (from
the day) · Seat · Contact · Invite.

**Phone and tablet (below `lg`):**
- New `guests/_components/phone-column-header.tsx` `PhoneColumnHeader`, beside `ArrangeSheet`: "Name"
  on the left and ONE compact `PickMenu` on the right (`data-phone-column-pick`).
- Options come from a pure, tested `lib/phone-columns.ts`, which drops what the event lacks.
- Default: `checkin` from the day, otherwise `rsvp`.
- The pick is remembered in localStorage (`sn:guests:phone-column:<phase>`, try/catch), read after
  hydration. A stale key falls back to the default.

**The chosen column on each card.** The `switch (column)` sits inside `MobileListRow`, because
`the-phone-card-edits-what-the-desktop-row-edits.test.ts` reads that function's body. Each option
reuses the desktop control:

| Column | Control |
|---|---|
| access | `RowAccess size='phone'` |
| rsvp | `RsvpChipEditor mobileCycle` |
| checkin | `RowCheckin size='phone'` |
| seat | `SeatChip` + `PlusOneChipEditor` |
| side | `SideChipEditor` |
| groups | `GroupChipList` + `AddToGroupControl` |
| invite | `RowInvite size='phone'` |

**Card sub-line:**
- Role stays (owner 2026-09-05).
- Groups stays unless groups is the chosen column.
- The Access chip leaves the sub-line.
- The plus-one summary stays unless seat is the chosen column.

`MobileGuestCarousel` renders no rows, so the picker is not its job.

## 5 · Tests and guards to update

- `lib/pillar-parts.test.ts`: drop the Guest-list tests; keep Your Team.
- `roster-doors.test.ts`: the Scan-tickets href.
- `reachable-without-typing-the-url.test.ts`: `partHomes` loses `guestListParts`.
- `lib/the-hosts-part-speaks-the-cohost-model.test.ts`: keep the actions half; re-anchor rules 1–3 on
  `guest-card-body.tsx`, the workspace card and `event-dashboard.tsx`.
- `lib/colour-access-lists-only-coordinators.test.ts`: move the anchor to `lib/colour-access.server.ts`
  and add an executable case.
- `lib/coordinator-photos-area.test.ts`: point at `guest-helper-grants.tsx`.
- `lib/event-people-roster.test.ts`: the `/hosts` href expectation.
- `app/dashboard/reads-are-honest.test.ts`: remove the `hosts/page.tsx` row.
- `lib/no-door-out-of-the-app.test.ts`: move the `CONTACT_TEXT_BILL` entry.
- `scripts/page-masthead-baseline.json`: delete the `hosts/page.tsx` line.
- `the-header-fits-its-own-cell.test.ts`: cap 292 → 388, with the reason.
- New guards: `the-checkin-column-is-the-desks-door.test.ts`, `lib/phone-columns.test.ts`,
  `lib/delegate-activity.test.ts`.
- `port-control-baseline.json`: `/hosts` keeps a redirect `page.tsx`, so the guard WILL list its
  controls as lost. Each reappears under `/guests`, `/guests/[guestId]` and the workspace. Run
  `pnpm --filter @setnayan/web port:baseline` ONCE, in the last commit.

## 6 · Order (small commits; the row is cut last)

1. CHECK-IN column (cell, header, meter, Scan-tickets door, guard).
2. Phone column header.
3. Delegate activity becomes a lib; the card Activity section; the Overview feed plus the `user_id` fix.
4. Helper grants and colour access move onto the guest card.
5. The booked planner's seat moves onto their workspace.
6. Measure legacy seats on prod; build `LegacyHostSeats` only if the count is non-zero.
7. Remove the Guests · Hosts · Check-in row, repoint the doors, update the tests, run `port:baseline`
   once, add the changelog fragment.

Each commit: tsc, lint, `lint:port-controls`, `lint:dup-rule`, then the FULL unit suite from
`apps/web` (bracketed paths run zero tests).

## Open owner questions

1. Once Hosts is gone, the only list of who holds access is the Overview's Hosts card. Is that enough,
   or should the guest list get a "Hosts" filter (rows with Access ≠ None)?
2. On the phone, RSVP stops being always visible on every card once one column is picked. Is that
   intended?
3. If prod still has legacy email co-host seats or pending non-planner email invites: keep them under
   the roster until they expire or are removed, or let them expire with no door?
