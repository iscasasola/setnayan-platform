# Guest list · Access · Hosts · Check-in — handoff (2026-09-30)

From cloud session "Claire Buanhog coordinator status" (branch `claude/charming-rubin-vgwpii`).
**Owner, verbatim: "let that session decide how to build it. just make sure, he gets all the design
and plans we are doing here."** So this file is the design + plan. How and when to build the rest is
the handoff session's call.

- Prototype the owner reviewed: `build-sessions/prototypes/guest_list_access_2026-09-30.html` (also
  published privately to him at https://claude.ai/artifact/VRqMeVxzCVjqk1Qcz61od5).
- No PR is open for this branch. Nothing is merged or deployed.

## ⚠ Overlap to resolve first

Cloud session **"E · Guest card + Guest list rows redesign (Fable)"** (branch
`rd/guest-card-and-rows-redesign`) was running at the same time and touches the same files:
`guests/_components/guest-list-multiselect.tsx` (roster rows), the guest card
(`guest-card-body.tsx`, `guest-access-control.tsx`) and `guests/page.tsx`. This session did not
know it existed until the end. Pick the order (one train, or rebase one onto the other).
`apps/web/scripts/port-control-baseline.json` is regenerated on this branch too, so regenerate it
once after both are in (`pnpm port:baseline`).

## Owner rulings, 2026-09-30 (for DECISION_LOG — this session had no corpus access)

1. **Colour access is for coordinators and limited helpers only**, never the couple or a co-host.
   Owner: *"Claire Buanhog is not a coordinator"* (she is the Bride).
2. **The Hosts row leaves the event menu.** Owner: *"remove the host from the side menu since host
   is inside the guests?"*
3. **ACCESS is a column on the guest list** (None · Co-host · Limited helper), one guest at a time.
   The bulk "Part of the host" picker stays retired. Owner: *"do you think it is better to just
   have an access column?"* → yes.
4. **On the guest list, the TOP BAR search searches this event's guests, and the in-page row is
   Add only.** Owner: *"i thought we had a build that will make the search on the top to do the
   search? so the text box on people will only be add?"* → *"ok"*.
5. **RSVP = who is coming; Check-in = who arrived.** Owner: *"RSVP fills up the list · Check-in
   fills up who arrived · Is that correct? Then add a column for checkin instead so we can remove
   the whole row of Guests, Hosts, Check-in"* → *"okay. so build it."*
6. **The Guests · Hosts · Check-in parts row is removed** once Hosts' pieces have moved (cut LAST).
7. **Columns by device.** Owner: *"on desktop we can show what columns can show. on mobile, we can
   pick the header of the column to show what you want to see. make the header a drop down."*
   Recommended and not contradicted: **one** picked column on a phone (at 375–430px the avatar and
   name need ~200px; two columns would truncate both).

Also answered: the owner's profile photo shows as "IC" because
`users.share_profile_photo_with_hosts` is opt-in (his 2026-09-20 ruling;
`lib/guest-account-photos.ts` `accountPhotoRefsByGuest`). He needs to turn on Profile → Privacy →
"Share my profile photo with hosts". Offered (undecided): always show a person's own photo on their
own row, while other hosts still need the opt-in.

## Built and pushed on `claude/charming-rubin-vgwpii` (base `origin/main` 2a4d91d0)

| Commit | What |
|---|---|
| `3dbd2b51d` | **fix(hosts): Colour access lists coordinators only.** Full co-host seats are `couple` members since `20271251336140`; `set_coordinator_colour_access` only grants to `coordinator` members. New `seatIsFullCohost()` in `lib/guest-access.ts` mirrors SQL `seat_is_full_cohost`. Guard: `lib/colour-access-lists-only-coordinators.test.ts`. |
| `08dba5bcd` | **fix(hosts): the Hosts part speaks the co-host model.** Live = `user_id` set (not `accepted_at`, which defaults to now()). Guest-list seats show as waiting. Seats use Co-host / Limited helper words (`seatAccessWord`). Full co-hosts get no area/budget/photo grants (`setDelegateBudget`/`setDelegatePhotos` refuse server-side). Celebrant: "A celebrant stays a co-host." Stale copy and dead role-picker code removed. Guard: `lib/the-hosts-part-speaks-the-cohost-model.test.ts`. |
| `09dad303b` | **feat(menu): the Hosts row leaves the event menu** (`lib/customer-menu.ts`). The Guests row gets `alsoMatch` for `/hosts`. Menu tests updated. |
| `f01000e99` | **feat(guests): ACCESS column.** `guests/_components/guest-access-cell.tsx` (`GuestAccessCell`): one `PickMenu` per guest, calls the SAME `setGuestAccess` as the card, saves optimistically, fixed for the creator and celebrants, editable only by the couple (`canManageAccess = viewer.isCouple`). The "+Co-host" tag after Role is removed. `PickMenu` gained `compact`. Server-action budget unchanged (1225/1225). Guard: `guests/_components/the-access-column-is-the-cards-access-line.test.ts`. |
| `53171ce74` | fix(hosts): the seat-name guest read is gated on the viewer being allowed to see guests (`lib/event-viewer.test.ts`). |

Checks run: tsc clean · lint clean · `lint:port-controls` and `lint:dup-rule` clean · full unit suite
on `3dbd2b51d` 20,787 pass / 0 fail. A full-suite run on `53171ce74` was still in progress when this
was written (0 failures in the first 16.5k tests).

## Designed, not built on this branch — the handoff session decides how

### A · Top bar searches the guest list; the page row is Add only (ruling 4)
- The 2026-09-23 "search follows the place" build (#5919, `lib/search-scope.ts`) names "one event's
  guests" as agreed but **deliberately absent** only because no source answered it. The source
  exists: the roster's `?q=` filter (`guests/_components/live-search.tsx`, filtered server-side).
- Add a `guests` scope ("Search guests" / short "Guests", `widerKey` to the next scope out). On the
  guest list, the top bar box drives `?q=` instead of the palette index. It shows the current query
  when landing on `/guests?q=…` and keeps the escape row that climbs out with what was typed.
  Relevant files: `app/dashboard/(launcher)/_components/home-command-bar.tsx`,
  `app/_components/frontdoor/app-rail-shell.tsx` (`searchSlot`), `lib/command-key-claim.ts`.
- ⌘K goes back to the top bar (today `guests-search.tsx` claims it via `claimCommandKey`).
- `guests/_components/find-add-row.tsx` loses its search half and its fold/expand. The row becomes
  add box (`capture-bar.tsx`) + Filter. Keep: an empty list opens on Add, and after the event the add
  box waits behind "+".
- Phone: remove the in-page `LiveSearch` in `mobile-guest-carousel.tsx` **only if** the phone top
  bar shows a search control on that page.
- Guards to extend, not loosen: `lib/search-scope.test.ts`, `lib/two-bars-two-jobs.test.ts`,
  `app/_components/frontdoor/one-top-bar.test.ts`, `one-matcher-two-surfaces.test.ts`.
- A subagent of this session was building this in a local worktree. Nothing from it is pushed; treat
  this section as the spec.

### B · Check-in column, Hosts pieces move, parts row removed (rulings 5–7)
1. **CHECK-IN column** on the roster: Arrived / not yet, from `guest_checkins` (`guests/page.tsx`
   already reads it). Tap to check in or undo through the SAME `checkInGuest` / `undoCheckIn`
   (`guests/checkin/actions.ts`). Shown from the day of the event onward (the Check-in part's rule in
   `lib/pillar-parts.ts`). Door crew = couple or coordinator (the `guest_checkins` RLS). Consider an
   "Arrived N of M" in the summary bar on the day, and a "Scan tickets" door into the desk's scanner.
   `/guests/checkin` stays as the door crew's standalone desk and the day-of menu row's destination.
2. **Hosts pieces MOVE** (none re-invented):

   | Still on Hosts | Moves to |
   |---|---|
   | Helper grants: areas chips, Allow budget view, Allow event photos (`CoordinatorGrantChips`, `CoordinatorSeatControls`, `setDelegateBudget`, `setDelegatePhotos`) | Under the Access line on that guest's card (`guest-access-control.tsx` / `guest-card-body.tsx`), Limited helper only |
   | Colour access (`CoordinatorColourDomains`, `setCoordinatorColourDomain`, `rejectColourChange`) | Same, on the helper's card |
   | Delegate activity ("your coordinator did X") | Each person's card, plus a short feed on Overview |
   | Promote your booked coordinator (RA 10173 consent gate) | Your Team, on the planner's supplier workspace (`vendors/[vendorId]/workspace`, whose `colour-access-card.tsx` already points at `/hosts`) |
   | Old email invites to people not on the list | Retire; still-pending ones show until they expire |

   Watch the server-action budget (`lint-server-action-budget`, at 1225/1225): move or re-export
   actions, never duplicate them. `lint:port-controls` fails when a route loses a control, so each
   moved control has to be accounted for in the baseline.
3. **Phone column picker.** Below `lg` the roster is a card list (`MobileListRow`, `ArrangeSheet`)
   with no header. Add one header strip: "Name" on the left and, on the right, ONE column whose
   header is a `PickMenu`: Access · RSVP · Check-in · Seat · Side · Groups · Invite (whichever exist
   for that event and phase). Each card shows that value with the same control the desktop cell uses
   (`GuestAccessCell size='phone'`, the RSVP cycle, `SeatChip`, the check-in cell). The pick is
   remembered per device (localStorage, try/catch). Default: RSVP before the day, Check-in from the
   day. Desktop shows every column; the table already scrolls sideways in its own container.
4. **Remove the parts row LAST** (`lib/pillar-parts.ts` `guestListParts`, `?gview=` in
   `guests/page.tsx`). Decide what old `?gview=hosts|checkin` and `/hosts` links do, and where a
   helper without guest-list access lands (today `isDelegateWithoutArea` sends them to `/hosts`
   standalone).

A read-only Fable planning pass for section B was running when this file was written. If its plan
arrives, it is appended below.
