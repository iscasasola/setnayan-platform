'use server';

/**
 * Creator dashboard · discount-offer inbox actions (Creator Economy P1).
 *
 * A creator accepts or declines a vendor's discount offer. SENDING IS FREE
 * since 2026-08-07 (token retirement) — an offer costs the vendor nothing, so
 * there is no charge to settle or refund. `respond_creator_offer` still records
 * the response (SECURITY DEFINER, gated to the addressed creator inside the DB)
 * and its legacy-settle branch is inert, because it only fires on
 * `reach_tokens_held > 0` and new offers are written with 0. Responding past the
 * offer's expires_at raises OFFER_EXPIRED — the sweep just marks it expired. On
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
    return 'This offer expired before you responded — it can no longer be accepted or declined.';
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
  // `tokens_settled` is always 0 now — kept in the shape so a caller reading it
  // gets a truthful zero rather than a missing key.
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
            : 'No charge — sending an offer is free. See it under My Shop → Creators.',
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
 * 🛑 `setCreatorAcceptsOffers` WAS DELETED HERE — owner 2026-08-20: *"accept
 * vendor offers will forever be on. so no need to toggle since all users can be
 * deemed content creators."*
 *
 * `users.creator_accepts_offers` still exists and is still READ — the vendor
 * Creators browse filters on it and `offer_creator_reach_hold` raises
 * CREATOR_OFFERS_OFF from it. It defaults TRUE and now has no writer, so every
 * account accepts offers. The column is kept, not dropped, because it is the
 * whole mechanism for an opt-out and a privacy review may ask for one back; a
 * dropped column would have to be rebuilt from nothing.
 */
