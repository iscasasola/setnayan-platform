'use server';

/**
 * /vendor-dashboard/creators · vendor-scoped server actions (Creator Economy P1).
 *
 * A vendor spends a REACH TOKEN to send a discount OFFER to a creator. The token
 * spend REUSES the existing per-voucher burn via the hold-and-release RPC
 * `offer_creator_reach_hold` (SECURITY DEFINER + answering-member gated inside the
 * DB, exactly like unlock_vendor_event_hold) — no fork of the token economy. The
 * send RESERVES the token (offer.status='pending'); the creator's accept/decline
 * CONSUMES it; an unanswered offer past expires_at RELEASES it (the cron-free
 * sweep). The vendor_profile_id is resolved server-side from the authed user,
 * never trusted from the form.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { emitNotification } from '@/lib/notification-emit';

const PANEL_PATH = '/vendor-dashboard/creators';

async function ensureProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, vendorProfileId: profile.vendor_profile_id };
}

function readString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

function back(msg: string): never {
  redirect(`${PANEL_PATH}?error=${encodeURIComponent(msg)}`);
}

/** Map the DB RPC's RAISE codes to plain-language vendor copy. */
function humanizeOfferError(message: string): string {
  if (message.includes('TIER_FREE_NO_REACH'))
    return 'Free vendors can’t spend reach tokens. Upgrade your plan to offer discounts to creators.';
  if (message.includes('INSUFFICIENT_WALLET_BALANCES'))
    return 'Not enough reach tokens available (some may already be held). Top up your tokens and try again.';
  if (message.includes('OFFER_PENDING'))
    return 'You already have an outstanding offer to this creator — wait for them to respond.';
  if (message.includes('NOT_A_CREATOR'))
    return 'That account isn’t an eligible creator (no published chapter on a public profile).';
  if (message.includes('SELF_OFFER'))
    return 'You can’t send a discount offer to your own creator profile.';
  if (message.includes('MISSING_TERMS'))
    return 'Add the creator-rate discount you’re offering.';
  if (message.includes('FORBIDDEN'))
    return 'You don’t have permission to send offers for this shop.';
  return message;
}

export async function sendCreatorOffer(formData: FormData) {
  const { supabase, vendorProfileId } = await ensureProfile();

  const creatorUserId = readString(formData, 'creator_user_id');
  const creatorRate = readString(formData, 'creator_rate_terms');
  const audienceRate = readString(formData, 'audience_rate_terms');

  if (!creatorUserId) back('Pick a creator to offer to.');
  if (!creatorRate) back('Add the creator-rate discount you’re offering.');

  // Token-gated send — RESERVES a reach token via the reused hold path. The RPC
  // is SECURITY DEFINER + answering-member gated, so it runs on the RLS client.
  const { data, error } = await supabase.rpc('offer_creator_reach_hold', {
    p_vendor_profile_id: vendorProfileId,
    p_creator_user_id: creatorUserId,
    p_creator_rate_terms: creatorRate,
    p_audience_rate_terms: audienceRate || null,
  });

  if (error) back(humanizeOfferError(error.message));

  // Notify the creator (reuses the notification pipeline). Best-effort.
  const result = data as { ok?: boolean; offer_id?: string } | null;
  if (result?.ok) {
    await emitNotification({
      userId: creatorUserId,
      type: 'creator_offer_received',
      title: 'A vendor sent you a discount offer',
      body: 'Open your Creator dashboard to review the creator + audience rates and accept or decline.',
      relatedUrl: '/dashboard/creator?tab=offers',
    });
  }

  revalidatePath(PANEL_PATH);
  redirect(`${PANEL_PATH}?sent=1`);
}
