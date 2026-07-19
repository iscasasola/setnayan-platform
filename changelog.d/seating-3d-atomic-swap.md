## 2026-07-03 · fix(seating): atomic 3D seat/table swap RPC + seat-collision guard

The 3D seating lab swapped guests (tap A → tap B) and whole tables by firing two
or more independent `event_seat_assignments` upserts from the client. That was
(1) not atomic — a crash between writes left a half-swap — and (2) had no
physical-chair uniqueness, so two guests could end up on the same
`(event_id, table_id, seat_number)`.

- **Migration** `20270506562608_atomic_seat_table_swap.sql`:
  - Data cleanup: nulls `seat_number` on later-created rows of any existing
    `(event_id, table_id, seat_number)` collision (keeps earliest by
    `created_at`; NULL seat = "at table, no specific chair", so non-destructive).
  - Partial unique index `event_seat_assignments_chair_uniq` on
    `(event_id, table_id, seat_number) WHERE seat_number IS NOT NULL` — one guest
    per physical chair.
  - `public.swap_seat_assignments(uuid, uuid, uuid)` and
    `public.swap_table_assignments(uuid, uuid, uuid)`, both `SECURITY INVOKER`
    (couple RLS authorizes). Each does the exchange in one transaction; because
    the partial unique index can't be deferred, they use a NULL-park intermediate
    (park a seat to NULL → move → restore) so no statement ever sees two guests
    on one chair.
- **Server actions** `swapSeats` / `swapTableOccupants` in
  `apps/web/app/dashboard/[eventId]/seating/actions.ts` — assert the seating lock
  first, then call the RPCs (same zod-less FormData parsing + error shape +
  `revalidatePath` as neighbours).
- **3D lab** `seating-lab-3d.tsx`: `swapGuests` / `swapTables` now animate the
  movers locally (persist suppressed) and persist the exchange atomically via one
  RPC instead of N independent `assignGuest` writes. Optimistic state + mover
  animations unchanged; a failed action arms the existing full server resync.
- **Tests**: pure `computeGuestSwap` / `computeTableSwap` added to `lib/seating.ts`
  (mirror the RPC end state) with 8 new cases in `lib/seating.test.ts` (28 pass).
  DB-side atomicity + uniqueness behaviour is documented in the migration comments.

SPEC IMPACT: 0008 as-built § invariants — atomic seat/table swap + one-guest-per-
physical-chair unique guard on `event_seat_assignments`. (Corpus not edited here;
flagging for the as-built ground-truth doc.)
