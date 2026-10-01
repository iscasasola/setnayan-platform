import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminProfile } from '@/lib/admin/admin-predicate';

/**
 * seat-unlink.ts — "THIS INVITATION IS LINKED TO <ACCOUNT> — UNLINK".
 *
 * The couple's (and admin's) undo for a seat bound to the wrong account — the
 * door that did not exist on 2026-09-30, when a test account turned out to hold
 * the owner's own GROOM row. Nothing shipped fitted: `releaseGuestClaim` is
 * hidden for couple rows and never deletes the membership; the swap, the
 * soft-delete, the claims Remove, "Leave" and host removal each do something
 * else. This does exactly four things, in this order, and nothing more:
 *
 *   1. ROTATES THE ROW'S KEY FIRST (`rotate_guest_qr_token`, the audited RPC
 *      every other rotation uses). Its failure aborts: unbinding while the old
 *      link still works hands the seat straight back to whoever holds it — the
 *      lesson `releaseGuestClaim` records. The guest pass minted from the old
 *      key dies with it (`readGuestSession` checks the token on every read).
 *   2. DELETES ONE ROW: `event_members` WHERE this event, THAT account,
 *      `member_type = 'guest'`, THIS guest_id. Never a couple membership —
 *      the creator's own has no guest_id, and an account holding the row as a
 *      live Co-host / helper (member_type couple / coordinator) is REFUSED
 *      with `holds_access` so the couple removes the Access first.
 *   3. UNDOES WHAT THAT ACCOUNT WROTE ON THE ROW — and only that: `person_id`
 *      when it is that account's own person (the `link_guest_to_account_person`
 *      trigger put it there), `email` when it is that account's address. The
 *      same UPDATE re-sends the email it keeps, so the `set_guest_person`
 *      trigger re-derives the row's person from the row's OWN address — which
 *      is how the creator's groom row gets the creator back.
 *   4. CLOSES that account's claim on this event (`guest_claims` → rejected).
 *
 * Unlike "Take this seat back" it keeps the guest, the RSVP, the seat and the
 * name — the row is the couple's; the wrong account simply stops holding it.
 * Works on couple rows too: that is how the owner fixes his own wedding.
 */

export type UnlinkResult =
  | { ok: true; accountEmail: string | null }
  | { ok: false; reason: 'not_allowed' | 'nothing_linked' | 'holds_access' | 'failed' };

/** Is the caller a couple member of this event, or Setnayan staff? */
async function callerMayUnlink(
  supabase: SupabaseClient,
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: couple }, { data: me }] = await Promise.all([
    admin
      .from('event_members')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .eq('member_type', 'couple')
      .maybeSingle(),
    admin.from('users').select('is_internal, is_team_member, account_type').eq('user_id', user.id).maybeSingle(),
  ]);
  return couple || isAdminProfile(me) ? user.id : null;
}

export async function unlinkSeatFromAccount(
  supabase: SupabaseClient,
  input: { eventId: string; guestId: string },
): Promise<UnlinkResult> {
  const { eventId, guestId } = input;
  const admin = createAdminClient();
  const callerId = await callerMayUnlink(supabase, admin, eventId);
  if (!callerId) return { ok: false, reason: 'not_allowed' };

  const { data: guest, error: guestErr } = await admin
    .from('guests')
    .select('guest_id, person_id, email')
    .eq('guest_id', guestId)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .maybeSingle();
  if (guestErr || !guest) return { ok: false, reason: 'failed' };

  const { data: binding, error: bindErr } = await admin
    .from('event_members')
    .select('id, user_id, member_type')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .maybeSingle();
  if (bindErr) return { ok: false, reason: 'failed' };
  if (!binding?.user_id) return { ok: false, reason: 'nothing_linked' };
  // A live Co-host / helper through this row: the membership is no longer a
  // guest's, and deleting it would take their dashboard with it. The couple
  // removes the Access first (which returns it to 'guest'), then unlinks.
  if (binding.member_type !== 'guest') return { ok: false, reason: 'holds_access' };
  const accountId = binding.user_id as string;

  // 1. THE KEY FIRST. Through the caller's own session so the audit row names
  //    them and the RPC's own couple / admin check runs.
  const { data: rpcData, error: rpcError } = await supabase.rpc('rotate_guest_qr_token', {
    p_guest_id: guestId,
    p_reason: 'unlinked from the wrong account',
  });
  const rotated = rpcData as { ok?: boolean } | null;
  if (rpcError || !rotated?.ok) return { ok: false, reason: 'failed' };

  // 2. ONE ROW: this event · that account · a guest's membership · this row.
  const { error: delErr } = await admin
    .from('event_members')
    .delete()
    .eq('id', binding.id as number)
    .eq('event_id', eventId)
    .eq('user_id', accountId)
    .eq('member_type', 'guest')
    .eq('guest_id', guestId);
  if (delErr) return { ok: false, reason: 'failed' };

  // 3. Only what that account put on the row.
  const [{ data: persons }, { data: account }] = await Promise.all([
    admin.from('people').select('person_id').eq('claimed_by_user_id', accountId),
    admin.from('users').select('email').eq('user_id', accountId).maybeSingle(),
  ]);
  const theirPersons = new Set((persons ?? []).map((p) => p.person_id as string));
  const accountEmail = ((account?.email as string | null) ?? '').trim() || null;
  const rowEmail = ((guest.email as string | null) ?? '').trim() || null;
  const emailWasTheirs = Boolean(
    accountEmail && rowEmail && rowEmail.toLowerCase() === accountEmail.toLowerCase(),
  );
  const personWasTheirs = Boolean(guest.person_id && theirPersons.has(guest.person_id as string));
  if (personWasTheirs || emailWasTheirs) {
    const { error: rowErr } = await admin
      .from('guests')
      .update({
        ...(personWasTheirs ? { person_id: null } : {}),
        // Written even when KEPT: an UPDATE OF email fires `set_guest_person`,
        // which re-derives the person from the row's own address.
        email: emailWasTheirs ? null : rowEmail,
        updated_at: new Date().toISOString(),
      })
      .eq('guest_id', guestId)
      .eq('event_id', eventId);
    if (rowErr) console.error('[supabase-error] lib/seat-unlink.ts · from:guests.update', rowErr);
  }

  // 4. Their claim on this event, closed.
  const { error: claimErr } = await admin
    .from('guest_claims')
    .update({
      status: 'rejected',
      reviewed_by_user_id: callerId,
      reviewed_at: new Date().toISOString(),
      review_note: 'Unlinked by the couple — this invitation was not theirs.',
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
    .eq('claimer_user_id', accountId)
    .neq('status', 'rejected');
  if (claimErr) console.error('[supabase-error] lib/seat-unlink.ts · from:guest_claims.update', claimErr);

  return { ok: true, accountEmail };
}

/**
 * Who holds this row, for the guest card's "linked to <account>" line — or null.
 * Admin-client read (another account's membership), made only for a caller the
 * card has already established is the couple or staff.
 */
export async function readSeatAccount(
  eventId: string,
  guestId: string,
): Promise<{ email: string | null; memberType: string } | null> {
  const admin = createAdminClient();
  const { data: binding, error } = await admin
    .from('event_members')
    .select('user_id, member_type')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] lib/seat-unlink.ts · from:event_members.select', error);
    return null;
  }
  if (!binding?.user_id) return null;
  const { data: account } = await admin
    .from('users')
    .select('email')
    .eq('user_id', binding.user_id as string)
    .maybeSingle();
  return {
    email: ((account?.email as string | null) ?? '').trim() || null,
    memberType: binding.member_type as string,
  };
}
