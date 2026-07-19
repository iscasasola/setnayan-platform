## 2026-07-08 · feat(seating): live provisional seating wired into guest writes (Smart Seat-Plan Phase 5 · S3)

Smart Seat-Plan guest-reactive program, **PR S3** — turns on the reconcile engine
from S2. The seat plan now reacts to the guest list without the couple pressing
Auto-Arrange (points #3/#4/#5/#6/#9).

- **Migration** `20270524000000_seating_autoplace_flag.sql` — `events.seating_autoplace_enabled BOOLEAN DEFAULT TRUE` (a couple can switch live auto-seat off). Plain column; existing events RLS covers it.
- **`lib/seating-reconcile.ts`** — `applyReconcileForEvent(supabase, eventId, { reseatGuestIds? })`: loads the roster + tables + floor plan + groups + keep-apart, runs `reconcileProvisionalSeats`, applies the delta (upsert `assign` on `event_id,guest_id`, delete `release`). **Best-effort** (never throws — seating is secondary to the guest write); no-op when the flag is off or no tables exist yet. Pulls each reseat target's +1 in so a pair moves together.
- **Wired call sites** — gap-fill on add: `createGuest`, `bulkAddGuests`, `quickAddGuest`, `importGuestsCsv`, claims `keepGuestAction`; re-place on tier change: `updateGuest` (only when role/group_category changed), `setGuestPrimaryRole`, `bulkAssignGuestRole`, `bulkAddGuestsToGroup` (group join → #9), `bulkApplyRoleAndGroup` (role/group; side-only skipped).

Locked (Phase 4) seats are never moved; a guest who had a seat is never stranded
(both invariants live in `reconcileProvisionalSeats`, unit-tested in S2). No
change to pricing / final count. UI polish (provisional badge + "needs a table"
banner + the settings toggle) is a follow-up.

SPEC IMPACT: Implements PR S3 of `02_Specifications/Smart_Seat_Planning_Guest_Reactive_2026-07-08.md` (Phase 5 wiring). Spec already in the corpus; no further corpus edit.
