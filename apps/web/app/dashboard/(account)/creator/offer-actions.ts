'use server';

/**
 * Creator dashboard · discount-offer inbox actions (Creator Economy P1).
 *
 * A creator accepts or declines a vendor's discount offer. The vendor's reach
 * token was already DEBITED at send (escrow-at-send, migration 20270819350491
 * — closing the swallowed-consume leak, readiness verdict B1); both responses
 * merely SETTLE that spent token via `respond_creator_offer` (SECURITY DEFINER,
 * gated to the addressed creator inside the DB). Responding past the offer's
 * expires_at raises OFFER_EXPIRED — the expiry sweep refunds the vendor. On
 * accept, the creator may link a published chapter that credits the vendor as
 * the deliverable. No money moves here — Setnayan only records the collab; the
 * discount settles off-platform.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { emitNotification } from '@/lib/notification-emit';

const PANEL_PATH = '/dashboard/creator';

function readString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

function back(msg: string): never {
  redirect(`${PANEL_PATH}?error=${encodeURIComponent(msg)}`);
}

/** Map the DB RPC's RAISE codes to plain-language creator copy. */
function humanizeRespondError(message: string): string {
  if (message.includes('OFFER_EXPIRED'))
    return 'This offer expired before you responded — it can no longer be accepted or declined. The vendor’s token is returned automatically.';
  if (message.includes('FORBIDDEN')) return 'This offer isn’t addressed to your account.';
  if (message.includes('NOT_FOUND')) return 'That offer no longer exists.';
  return message;
}

async function ensureUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

async function respond(formData: FormData, response: 'accepted' | 'declined') {
  const { supabase } = await ensureUser();
  const offerId = readString(formData, 'offer_id');
  if (!offerId) back('Missing offer reference.');
  const chapterId = readString(formData, 'deliverable_chapter_id');

  const { data, error } = await supabase.rpc('respond_creator_offer', {
    p_offer_id: offerId,
    p_response: response,
    p_deliverable_chapter_id: response === 'accepted' && chapterId ? chapterId : null,
  });
  if (error) back(humanizeRespondError(error.message));

  // Tell the vendor their offer was answered (reuses the notification pipeline).
  // `tokens_settled` = what was ACTUALLY debited at send (escrow) — the RPC no
  // longer reports a charge that might not have happened.
  const result = data as {
    ok?: boolean;
    status?: string;
    vendor_id?: string;
    tokens_settled?: number;
  } | null;
  if (result?.ok && result.status === response) {
    // The vendor's recipient is the shop founder — notify by their user_id.
    const { data: vendor } = await supabase
      .from('vendor_profiles')
      .select('user_id')
      .eq('vendor_profile_id', result.vendor_id ?? '')
      .maybeSingle();
    const founderUserId = (vendor as { user_id?: string } | null)?.user_id;
    if (founderUserId) {
      await emitNotification({
        userId: founderUserId,
        type: 'creator_offer_responded',
        title:
          response === 'accepted'
            ? 'A creator accepted your discount offer'
            : 'A creator declined your discount offer',
        body:
          response === 'accepted'
            ? 'They’ll credit your shop in a published chapter. See it under My Shop → Creators.'
            : 'The reach token was spent on the outreach. See it under My Shop → Creators.',
        relatedUrl: '/vendor-dashboard/creators',
      });
    }
  }

  revalidatePath(PANEL_PATH);
  redirect(`${PANEL_PATH}?${response === 'accepted' ? 'accepted' : 'declined'}=1`);
}

export async function acceptCreatorOffer(formData: FormData) {
  return respond(formData, 'accepted');
}

export async function declineCreatorOffer(formData: FormData) {
  return respond(formData, 'declined');
}

/** Attach (or re-attach) a published chapter as the deliverable of an accepted
 *  offer — the creator may publish the crediting chapter after accepting.
 *  PR-C: the RPC now stamps `fulfilled_at` (linking the crediting chapter IS
 *  fulfillment — the whole outcome model, no clawback) and the vendor is told. */
export async function linkCreatorOfferDeliverable(formData: FormData) {
  const { supabase } = await ensureUser();
  const offerId = readString(formData, 'offer_id');
  const chapterId = readString(formData, 'deliverable_chapter_id');
  if (!offerId || !chapterId) back('Pick a published chapter to credit the vendor.');

  const { error } = await supabase.rpc('link_creator_offer_deliverable', {
    p_offer_id: offerId,
    p_chapter_id: chapterId,
  });
  if (error) back(error.message);

  // Tell the vendor the collab is FULFILLED (deliverable linked). Best-effort;
  // reuses the existing offer-lifecycle notification type.
  try {
    const { data: offer } = await supabase
      .from('vendor_creator_offers')
      .select('vendor_id')
      .eq('offer_id', offerId)
      .maybeSingle();
    const vendorId = (offer as { vendor_id?: string } | null)?.vendor_id;
    if (vendorId) {
      const { data: vendor } = await supabase
        .from('vendor_profiles')
        .select('user_id')
        .eq('vendor_profile_id', vendorId)
        .maybeSingle();
      const founderUserId = (vendor as { user_id?: string } | null)?.user_id;
      if (founderUserId) {
        await emitNotification({
          userId: founderUserId,
          type: 'creator_offer_responded',
          title: 'A creator fulfilled your collab',
          body: 'They linked the published chapter crediting your shop. See it under My Shop → Creators.',
          relatedUrl: '/vendor-dashboard/creators',
        });
      }
    }
  } catch {
    /* best-effort — the link already landed */
  }

  revalidatePath(PANEL_PATH);
  redirect(`${PANEL_PATH}?linked=1`);
}

/**
 * Creator "accept vendor offers" toggle (PR-C · RA-10173 must-plan — an
 * unsolicited offers inbox is the fastest way to make a user feel farmed).
 * Default ON; turning it OFF (a) hides the creator from the vendor Creators
 * browse and (b) makes offer_creator_reach_hold raise CREATOR_OFFERS_OFF —
 * the server-side floor. Self-update on the RLS client (same pattern as the
 * profile marketing_opt_in toggle).
 */
export async function setCreatorAcceptsOffers(formData: FormData) {
  const { supabase, user } = await ensureUser();
  const enabled = formData.get('accepts_offers') === 'on';

  const { error } = await supabase
    .from('users')
    .update({ creator_accepts_offers: enabled } as Record<string, unknown>)
    .eq('user_id', user.id);
  if (error) back('Couldn’t save that preference. Please try again.');

  revalidatePath(PANEL_PATH);
  redirect(`${PANEL_PATH}?${enabled ? 'offers_on' : 'offers_off'}=1`);
}
