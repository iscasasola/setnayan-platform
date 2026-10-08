/**
 * The RA 10173 export's "gifts you said you sent" section: what the SUBJECT told
 * a host through "I sent it" on a gift page (the E-Gifts wish list, owner
 * 2026-10-08), and nobody else's.
 *
 * ── WHY THIS IS NOT "WHATEVER RLS LETS ME READ" ─────────────────────────────
 * `event_gift_records` has no user column — a row is keyed to a GUEST
 * (`giver_guest_id`) — and its only SELECT policy admits the event's HOSTS
 * (migration 20271266228704). So:
 *   • a guest's own session reads NONE of their own records — the read below
 *     has to be made with the service-role client, bounded by the filter;
 *   • a host's session (and the service role) reads EVERY guest's record at
 *     their event. Those are the guests' data, not the host's: a subject-access
 *     file that hands them over is a third-party disclosure.
 * One filter for every caller: the subject's OWN guest ids.
 *
 * ── THE SUBJECT FILTER ──────────────────────────────────────────────────────
 * `event_members.guest_id` is the one user→guest link the schema has — the same
 * link the face-enrollment export and the account-erasure purge walk
 * (lib/account-erasure.ts · distinctGuestIds). The caller's own guest ids are
 * resolved from their OWN membership rows (`user_id = <the subject>`), then only
 * records on those guest ids are read.
 *
 * ── WHAT IS IN THE FILE ─────────────────────────────────────────────────────
 * What they said: the amount, their words, the name it was signed with, when.
 * The screenshot itself is NOT copied into a JSON file — the row says whether
 * one is held (`screenshot_held`). Whether the host has set a record aside is
 * the host's own note about their list and is not in the projection.
 *
 * No `server-only` import, so tsx can load it for a test.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { distinctGuestIds } from './account-erasure';

const OWN_GIFT_FIELDS = 'public_id, event_id, amount_php, message, giver_name, method_kind, created_at, screenshot_r2_key';

export async function readOwnGiftRecords(
  /** Reads the subject's own membership rows (their session, or the service role on the admin door). */
  client: SupabaseClient,
  /** Service role — there is no guest SELECT policy on the table. `null` = not available on this run. */
  admin: SupabaseClient | null,
  userId: string,
): Promise<{ data: unknown[] | null; error: { message: string } | null } | null> {
  // NOT READ is told apart from "you sent none" — the caller names the section.
  if (!admin) return null;
  // ERROR FIRST: a failed membership read is handed through, never rendered as
  // "you have said nothing".
  const mine = await client
    .from('event_members')
    .select('guest_id')
    .eq('user_id', userId)
    .not('guest_id', 'is', null);
  if (mine.error) return { data: null, error: mine.error };
  const ownGuestIds = distinctGuestIds(mine.data as Array<{ guest_id?: string | null }>);
  // A genuine empty: the subject is linked to no guest row, so no record can be theirs.
  if (ownGuestIds.length === 0) return { data: [], error: null };
  const res = await admin
    .from('event_gift_records')
    .select(OWN_GIFT_FIELDS)
    .in('giver_guest_id', ownGuestIds)
    .order('created_at', { ascending: true });
  if (res.error) return { data: null, error: res.error };
  return {
    data: ((res.data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => {
      const { screenshot_r2_key: shot, ...said } = row;
      return { ...said, screenshot_held: typeof shot === 'string' && shot.length > 0 };
    }),
    error: null,
  };
}
