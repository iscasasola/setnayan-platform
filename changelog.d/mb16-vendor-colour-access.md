## 2026-09-04 · feat(mood-board): a supplier or coordinator can adjust colour in their own lane (MB16)

The couple can hand one booked supplier — or a coordinator, several domains at
once — standing permission to change colour inside their own part of the design.
No per-change approval. Every change notifies the couple by email as well as
in-app, and any single change can be put back without touching that person's
ongoing access.

**The boundary did not move.** `events.role_palette` is still writable only by
`member_type = 'couple'` — `couple_can_update_event` is byte-for-byte what
`20260513040000` wrote, and `tests/db/colour-access-is-a-door-not-a-window.db.test.ts`
reads it back out of `pg_policies` and fails on a diff in either direction. A
grant holder reaches the column through `apply_colour_change`, a SECURITY
DEFINER function that checks the grant and performs the write internally — the
shape MB8's `moodboard_begin_render` and MB12's `vendor_agree_to_part` proved.

- `supabase/migrations/20271204557031_notification_type_colour_changed_in_lane.sql`
  — the enum label, its own file (Postgres forbids USING a new enum value in the
  transaction that adds it).
- `supabase/migrations/20271204966904_colour_access_grants.sql` —
  `event_colour_grants` (per booking × domain), `event_colour_grants_host` (per
  person × domain, composite-FK'd to `event_members` so removing a delegate
  CASCADEs their access away), `event_colour_changes` (the history "reject"
  operates against), and five RPCs. The lane is resolved from
  `event_vendors.category` INSIDE the function, so no caller can widen it.
- `apps/web/lib/colour-access.ts` — pure; the TS mirror of the two SQL lane
  functions, plus the log copy and the editable-swatch expansion.
- `apps/web/lib/moodboard-slots.ts` — `MOODBOARD_PART_TRADES`: the eight design
  parts that aliased no inspiration slot now have a trade, so MB12's handshake
  can reach them. Composed into `tradesForPart` only where the slot join is
  empty, with a module-load assertion that the two maps never both answer one
  part.
- `apps/web/app/dashboard/[eventId]/colour-access-actions.ts` — grant, revoke,
  apply (+ the notification), reject.
- The vendor workspace card (after Conversation, before Documents), the
  coordinator checklist on the hosts page, and the supplier's own swatch editor
  on their read-only mood board.
- `UGAT_TYPES` gains `TYPE-COLOURGRANT` and `UGAT_JOINTS` gains `J48`.

**Two things found while building, both worth naming:**

- `jsonb_set(palette, ARRAY['room_dressing','linens'], …)` RETURNS THE INPUT
  UNCHANGED when `room_dressing` does not exist — a two-element path cannot
  create its own parent, and nothing raises. Most boards carry no
  `room_dressing` key until somebody overrides a field, so this would have
  silently swallowed the FIRST change every florist ever made and reported
  success. `apply_colour_change`'s read-back turned it into a refusal instead of
  a lie, which is what surfaced it.
- MB12's `events_hold_part_finalization_freeze` reverts an agreed part's colour
  inside the same statement and the UPDATE still reports success. Both
  `apply_colour_change` and `reject_colour_change` now re-read the row and
  return `frozen` rather than logging a change that never happened.

**Deliberately not built:** the vendor is NOT told when a change of theirs is
rejected. Arguments run both ways and nobody has ruled, so no notification type
was invented for it.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/` — a new access model for
`events.role_palette`: a standing, revocable, lane-scoped grant with three
independent controls (the switch, the notice, the reject). Applied to
`DECISION_LOG.md` as the 2026-09-04 colour-access ruling; the eight orphaned
design parts gaining a trade is a change to what MB12's finalization handshake
can reach and belongs in the same row.
