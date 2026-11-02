## 2026-09-15 · fix(rls): a day-of access grant cannot be repointed at another celebration

`vendor_event_access_grants` fenced its INSERT on both the shop and the booking
(`event_id IN current_vendor_booked_event_ids()`), then re-checked only the shop
on UPDATE. Because `authenticated` holds UPDATE on `event_id` and the table had
no trigger, a shop admin could issue a legitimate grant on a celebration they
are booked on and then move that row's `event_id` to one they never were — the
INSERT fence walked around by an UPDATE. RLS is row-level, never value-level: a
policy that admits you to your own row cannot govern what you write into it
unless the WITH CHECK names the column, and WITH CHECK cannot see OLD.

What a moved grant buys: `current_vendor_dayof_grant_event_ids()` reads exactly
that column, and five live policies read that helper — FOR ALL (read AND write)
on `vendor_event_sets` and `vendor_event_set_songs`, plus SELECT on
`event_playlist_picks`, `event_playlist_slot_vibes` and `event_song_picks`.

Fixed by a BEFORE UPDATE trigger that makes the grant's target — shop, event,
account — immutable and RAISES when it is moved, so the refusal is explicit
rather than a zero-row UPDATE that looks like success. `revoked_at` (the soft
revoke, and the launcher's re-grant upsert) and `granted_by` (nulled by RA 10173
erasure) stay writable.

⚠ The symmetric fix — copying the INSERT's booked-event check into the UPDATE's
WITH CHECK — was rejected on purpose: the only legitimate UPDATE is the soft
revoke, and that check would refuse it the moment a booking is cancelled,
leaving an outstanding grant permanently active on a wedding the shop no longer
serves. A dormant escalation traded for a live one.

Measured, not assumed: `vendor_event_access_grants` held 0 rows and 0 distinct
grantees in production. The register's "2 people" belongs to
`vendor_event_unlocks`, a different table.

- `supabase/migrations/20271228546306_a_day_of_grant_cannot_be_moved.sql`
- `apps/web/tests/db/a-day-of-grant-cannot-be-moved.db.test.ts` — drives the
  policy directly (`SET ROLE authenticated` + JWT claim), never a server action,
  with a neutralising control that disables the trigger inside a rolled-back
  transaction and shows the same session repointing the grant through RLS alone.

SPEC IMPACT: None. No product behaviour changes — the launcher only ever wrote
`revoked_at` on an existing grant. This closes a write path no screen offered.
