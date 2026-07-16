'use server';

/**
 * Creator dashboard · discount-offer inbox actions (Creator Economy P1).
 *
 * A creator accepts or declines a vendor's discount offer. Both responses
 * CONSUME the vendor's held reach token (they paid to reach out) via the reused
 * hold-and-release RPC `respond_creator_offer` (SECURITY DEFINER, gated to the
 * addressed creator inside the DB). On accept, the creator may link a published
 * chapter that credits the vendor as the deliverable. No money moves here —
 * Setnayan only records the collab; the discount settles off-platform.
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
  if (error) back(error.message);

  // Tell the vendor their offer was answered (reuses the notification pipeline).
  const result = data as { ok?: boolean; status?: string; vendor_id?: string } | null;
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
 *  offer — the creator may publish the crediting chapter after accepting. */
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

  revalidatePath(PANEL_PATH);
  redirect(`${PANEL_PATH}?linked=1`);
}
