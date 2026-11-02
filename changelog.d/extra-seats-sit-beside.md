## 2026-09-21 · feat(guests): each extra seat is a chair, beside the guest who brings it

Owner, asked whether the seat plan should hold chairs for +2/+3/+4: *"decision. yes. + will have seats
beside the person invited."*

- A guest's `plus_one_count` now means that many **seat rows** (`plus_one_of_guest_id` → the guest) —
  the shape a named plus-one already had, which the seat engine already keeps beside its primary and
  the pax count already counts. `lib/extra-seats.ts` plans it (pure); `lib/extra-seats-sync.ts`
  applies it under the caller's RLS: missing seats → "+ TBA 2 · brought by Ana" rows on the guest's
  side, group and blocks; surplus placeholders → chair released + soft-deleted, as a list removal
  does; then the guest is re-seated, which pulls their seats in beside them.
- 🔒 **Only an unnamed placeholder is ever removed.** Going below a NAMED plus-one is refused with
  the reason, before anything is saved.
- Every writer syncs: the Seat-column picker, quick-add "+N", the guest-detail form, the add-guest
  form (a typed name becomes one named seat; the rest TBA), CSV import.
- 🔴 **Fixed with it:** the guest's RSVP looked up "the" plus-one row with `.maybeSingle()` — which
  errors on two rows, reads as none, and inserted ANOTHER seat on every RSVP (and counted removed
  rows). It now fills the oldest open seat, or updates the first if all are named.
- Verified: planner (5) — top-up, placeholder-only removal newest first, refusal below a named
  plus-one, RSVP fills the oldest open seat; wiring guard `lib/extra-seats-are-chairs.test.ts` (4),
  sabotaged 3 ways, each caught; db test that the exact seat-row shape is accepted and linked.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-21 🪑 row (owner ruling: extra seats are chairs beside the guest).
