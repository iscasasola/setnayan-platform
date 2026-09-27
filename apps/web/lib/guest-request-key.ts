import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { buildInvitationUrl } from '@/lib/qr';
import { resolveEventOwnerSlug } from '@/lib/public-event-url';

/**
 * KEEP OR LINK ISSUES THE KEY (guest pathway, owner 2026-09-26: *"then they get
 * their key + Save to my account"*). Called by the couple's Keep and Link — and
 * by nothing else — AFTER the request row has been kept or merged.
 *
 * `requestGuestId` is the request row the person created; `seatGuestId` is the
 * row they now hold (the same row on Keep, the existing guest on Link).
 *
 * Two halves, both best-effort AFTER the couple's decision is already saved (a
 * failed email must never undo a Keep):
 *
 *   1. A SIGNED-IN asker (remembered in `guest_claims`, status
 *      `pending_review`, `target_guest_id` = the request row) is bound to the
 *      seat now — this `event_members` row is what makes the event appear in
 *      their account. Never over a seat another account already holds, and
 *      never a second membership for an account that already has one.
 *   2. The person is emailed THEIR invitation link — the key itself
 *      (`?invite=<qr_token>`, the same link a QR opens) — where "Save to my
 *      account" waits. No SMS in V1: a request with only a mobile gets no
 *      email, and the couple shares the link from the guest list.
 *
 * Returns what actually happened so the screen can say so.
 */
export type IssuedKey = { bound: boolean; emailed: boolean; noEmail: boolean };

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

  // The key, by email — to the address the person gave on their request.
  const [{ data: request }, { data: seatRow }, { data: event }] = await Promise.all([
    admin.from('guests').select('email').eq('guest_id', requestGuestId).maybeSingle(),
    admin.from('guests').select('qr_token, email').eq('guest_id', seatGuestId).eq('event_id', eventId).maybeSingle(),
    admin.from('events').select('slug, display_name').eq('event_id', eventId).maybeSingle(),
  ]);
  const to =
    ((request?.email as string | null) ?? '').trim() ||
    ((claim?.claimer_email as string | null) ?? '').trim() ||
    ((seatRow?.email as string | null) ?? '').trim();
  const slug = ((event?.slug as string | null) ?? '').trim();
  const qr = (seatRow?.qr_token as string | null) ?? '';
  if (!to) return { bound, emailed: false, noEmail: true };
  if (!slug || !qr) return { bound, emailed: false, noEmail: false };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const ownerSlug = await resolveEventOwnerSlug(admin, eventId);
  const link = buildInvitationUrl({ appUrl, slug, qrToken: qr, ownerSlug });
  const name = ((event?.display_name as string | null) ?? '').trim() || 'the celebration';
  const result = await sendEmail({
    to,
    subject: `You're on the guest list — ${name}`,
    text: [
      `Good news — your request was accepted. You're on the guest list for ${name}.`,
      ``,
      `This is your personal invitation. Open it on your phone, and tap "Save to my account" to keep it:`,
      ``,
      link,
      ``,
      `It is yours alone — please don't forward it.`,
      ``,
      `—`,
      `Set na 'yan.`,
    ].join('\n'),
  });
  return { bound, emailed: result.ok, noEmail: false };
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
