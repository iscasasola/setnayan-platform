## 2026-07-20 · feat(coordinator): day-of broadcast backend + email call-times (P3, flag-off)

Coordinator P3 (`Coordinator_Role_Feature_Spec_2026-07-18.md` §P3): the day-of
grid's coordinator-broadcast card is no longer a stub, and per-vendor call-time
emails derive from the P2 run-of-show.

- **Migration `20270825364600_coordinator_p3_broadcasts`** — new
  `coordinator_broadcasts` table (immutable day-of announcements), RLS at
  CREATE from canonical patterns only: Pattern B member read
  (`current_event_ids()`) + delegate read (`current_moderator_event_ids()`) +
  admin read; INSERT for the couple (`current_couple_event_ids()`) and for a
  coordinator holding the schedule-'edit' delegate grant
  (`moderator_area_level(event_id,'schedule') = 'edit'` — the same authority
  that owns the run-of-show). No UPDATE/DELETE — a sent broadcast is immutable.
  The spec's optional `broadcast_acknowledgments` sibling is deferred
  (prefer-minimal: the card has no ack affordance).
- **Broadcast card wired** (`coordinator-broadcast-card.tsx`): when
  `NEXT_PUBLIC_COORDINATOR_P3_ENABLED=true`, the day-of page resolves the
  latest broadcasts + the viewer's compose authority server-side (the grid's
  existing fetch→props read model); couple/coordinator get a composer, every
  event member sees the feed. Flag off/absent → the pre-P3 "Coming soon" stub
  renders byte-for-byte as today.
- **Email call-times** (`lib/coordinator-broadcasts.ts` +
  `_actions/day-of-broadcast.ts`): explicit couple/coordinator button press
  (the opt-in) emails each responsible-tagged vendor their call time — the
  earliest schedule block they're tagged on via P2's `responsible_vendor_ids`
  lens; untagged or email-less vendors are skipped, never invented. EMAIL-ONLY
  per the no-SMS V1 lock, through the central `lib/email.ts` Resend gate —
  `RESEND_API_KEY` absent (prod today) → clean `not_configured` no-op, the
  code lands inert.
- Unit suite `lib/coordinator-broadcasts.test.ts` pins the derivation
  (earliest-tagged-wins, opt-in-by-tagging, email-less skip, Manila-time
  shaping) + the body validation mirror of the table CHECK.

SPEC IMPACT: `Coordinator_Whats_Next_2026-07-18.md` §P3 shipped (flag-off) —
the day-of broadcast card is no longer a stub; `coordinator_broadcasts` exists
with couple+coordinator write / members read; call-time nudges are email-only.
Acknowledgments table deferred. Owner actions to go live: push migration
20270825364600, flip `NEXT_PUBLIC_COORDINATOR_P3_ENABLED`, configure Resend
for the email leg.
