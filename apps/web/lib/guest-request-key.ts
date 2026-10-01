import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * KEEP OR LINK ISSUES THE KEY (guest pathway, owner 2026-09-26: *"then they get
 * their key + Save to my account"*). Called by the couple's Keep and Link — and
 * by nothing else — AFTER the request row has been kept or merged.
 *
 * `requestGuestId` is the request row the person created; `seatGuestId` is the
 * row they now hold (the same row on Keep, the existing guest on Link).
 *
 * Best-effort AFTER the couple's decision is already saved (a failed bind must
 * never undo a Keep):
 *
 *   1. A SIGNED-IN asker (remembered in `guest_claims`, status
 *      `pending_review`, `target_guest_id` = the request row) is bound to the
 *      seat now — this `event_members` row is what makes the event appear in
 *      their account. Never over a seat another account already holds, and
 *      never a second membership for an account that already has one.
 *   2. 📵 NOTHING IS EMAILED (owner 2026-09-29, "NO EMAIL TO GUESTS"). The
 *      requester was handed their own key the moment they sent the request
 *      (the pending ticket + "Copy my link"); Keep or Link makes that same
 *      key open their invitation. The couple nudges them from the Accept row.
 *
 * Returns what actually happened so the screen can say so.
 */
export type IssuedKey = { bound: boolean };

export async function issueRequestKey(input: {
  eventId: string;
  requestGuestId: string;
  seatGuestId: string;
  reviewerUserId: string;
}): Promise<IssuedKey> {
  const admin = createAdminClient();
  const { eventId, requestGuestId, seatGuestId } = input;
  let bound = false;

  const { data: claim } = await admin
    .from('guest_claims')
    .select('id, claimer_user_id, claimer_email')
    .eq('event_id', eventId)
    .eq('target_guest_id', requestGuestId)
    .eq('status', 'pending_review')
    .maybeSingle();

  if (claim?.claimer_user_id) {
    const userId = claim.claimer_user_id as string;
    const [{ data: seatHolder }, { data: already }, { data: seat }] = await Promise.all([
      admin.from('event_members').select('user_id').eq('event_id', eventId).eq('guest_id', seatGuestId).maybeSingle(),
      admin.from('event_members').select('id').eq('event_id', eventId).eq('user_id', userId).maybeSingle(),
      admin.from('guests').select('role').eq('guest_id', seatGuestId).eq('event_id', eventId).maybeSingle(),
    ]);
    if (already) {
      bound = true; // they are already inside by another door — nothing to add
    } else if (!seatHolder || seatHolder.user_id === userId) {
      const { error } = await admin.from('event_members').insert({
        event_id: eventId,
        user_id: userId,
        member_type: 'guest',
        role: (seat?.role as string | null) ?? 'guest',
        // `invite_claim` is the join_method this ledger was created with — the
        // couple accepted this person's claim to a place on their list.
        joined_via: 'invite_claim',
        guest_id: seatGuestId,
      });
      if (error) console.error('[supabase-error] lib/guest-request-key.ts · from:event_members.insert', error);
      bound = !error;
    }
    const { error: claimErr } = await admin
      .from('guest_claims')
      .update({
        status: 'confirmed',
        resolved_guest_id: seatGuestId,
        reviewed_by_user_id: input.reviewerUserId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', claim.id);
    if (claimErr) console.error('[supabase-error] lib/guest-request-key.ts · from:guest_claims.update', claimErr);
  }

  // 📵 NO EMAIL (owner 2026-09-29, DECISION_LOG "NO EMAIL TO GUESTS — THE QR AND
  // THE LINK DO EVERYTHING"). The person already holds their key — the request
  // handed it to them on Send — and reopening it now opens their invitation.
  // The couple can nudge them with Send invite / Copy message on the Accept row.
  return { bound };
}

/** Remove: the request is closed with nothing sent (owner: Remove tells them nothing). */
export async function closeRequestClaim(input: {
  eventId: string;
  requestGuestId: string;
  reviewerUserId: string;
}): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('guest_claims')
    .update({
      status: 'rejected',
      reviewed_by_user_id: input.reviewerUserId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', input.eventId)
    .eq('target_guest_id', input.requestGuestId)
    .eq('status', 'pending_review');
  if (error) console.error('[supabase-error] lib/guest-request-key.ts · from:guest_claims.update', error);
  return !error;
}
