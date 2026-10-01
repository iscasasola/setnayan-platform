/**
 * The RA 10173 export's face-tagging section: the SUBJECT'S OWN enrollment
 * records, and nobody else's (owner 2026-10-01, "yes fix it now").
 *
 * ── WHY THIS IS NOT "WHATEVER RLS LETS ME READ" ─────────────────────────────
 * `guest_face_enrollments` has no user column — a row is keyed to a GUEST
 * (`guest_id`). Three SELECT arms admit rows to an authenticated caller:
 *   • guest_reads_own_face_enrollment — guest rows linked to the caller through
 *     `event_members.guest_id`. This is the subject's own data.
 *   • event_member_can_read_face_enrollment — every row on an event in
 *     `current_couple_event_ids()` (20270920030000). A HOST's arm.
 *   • couple_writes_face_enrollment (FOR ALL, so it reads too) — every row on a
 *     couple event, OR every row on the platform when `is_admin()`.
 * The route used to read the table with no filter, so a couple's own data file
 * carried the face-tagging records of EVERY GUEST at their events, and an admin's
 * carried everyone's. Those rows are the guests' personal data, not the host's:
 * a subject-access file that hands them over is a third-party disclosure.
 *
 * ── THE SUBJECT FILTER ──────────────────────────────────────────────────────
 * `event_members.guest_id` is the one user→guest link the schema has (`guests`
 * carries no user column) — the same link the account-erasure biometric purge
 * walks (lib/account-erasure.ts · distinctGuestIds). Resolve the caller's own
 * guest ids from their OWN membership rows (`user_id = <session uid>`), then read
 * only enrollments on those guest ids. RLS stays the second bound.
 *
 * ── WHY A LIB FUNCTION AND NOT INLINE IN THE ROUTE ──────────────────────────
 * So the real read can be run against the replayed schema under a host's real
 * RLS session (tests/db/a-hosts-export-has-no-guests-face-records.db.test.ts).
 * No `server-only` import, so tsx can load it.
 *
 * face_vector (the raw embedding) and asset_url (the selfie itself) are NOT in
 * the projection — the export discloses what biometric data we hold, not the
 * biometric.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { distinctGuestIds } from './account-erasure';

export const FACE_ENROLLMENT_EXPORT_PROJECTION =
  'enrollment_id, event_id, source, consent_at, consent_source, ' +
  'revoked_at, quality_score, vector_model, created_at, updated_at';

export async function readOwnFaceEnrollments(
  client: SupabaseClient,
  userId: string,
): Promise<{ data: unknown[] | null; error: { message: string } | null }> {
  // ERROR FIRST: a failed membership read is handed through so the section is
  // named in `not_included`, never rendered as "you have no face records".
  const mine = await client
    .from('event_members')
    .select('guest_id')
    .eq('user_id', userId)
    .not('guest_id', 'is', null);
  if (mine.error) return { data: null, error: mine.error };
  const ownGuestIds = distinctGuestIds(mine.data as Array<{ guest_id?: string | null }>);
  // A genuine empty: the subject is linked to no guest row, so no enrollment
  // can be theirs.
  if (ownGuestIds.length === 0) return { data: [], error: null };
  const res = await client
    .from('guest_face_enrollments')
    .select(FACE_ENROLLMENT_EXPORT_PROJECTION)
    .in('guest_id', ownGuestIds)
    .order('created_at', { ascending: true });
  return { data: res.data as unknown[] | null, error: res.error };
}
