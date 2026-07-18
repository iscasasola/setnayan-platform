'use server';

/**
 * /vendor-dashboard/creators · vendor-scoped server actions (Creator Economy P1).
 *
 * A vendor spends a REACH TOKEN to send a discount OFFER to a creator. The token
 * spend REUSES the existing per-voucher burn via `offer_creator_reach_hold`
 * (SECURITY DEFINER + answering-member gated inside the DB, exactly like
 * unlock_vendor_event_hold) — no fork of the token economy. ESCROW AT SEND
 * (migration 20270819350491, closing the readiness-verdict B1–B3 money bugs):
 * the send DEBITS the token immediately (tagged spend_source='creator_offer'
 * on the burn ledger); the creator's accept OR decline settles the spend; only
 * an unanswered offer past expires_at is REFUNDED (as purchased tokens) by the
 * cron-free sweep. The vendor_profile_id is resolved server-side from the
 * authed user, never trusted from the form.
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
  // PR-C: the RPC gate tightened to PRO-AND-UP (owner ratification decision #4,
  // 2026-07-16). The old TIER_FREE_NO_REACH mapping is kept for a stale-deploy
  // window where the previous RPC is still live.
  if (message.includes('TIER_BELOW_PRO_NO_REACH'))
    return 'Creator collabs are a Pro-and-up feature. Upgrade your plan to offer discounts to storytellers.';
  if (message.includes('CREATOR_OFFERS_OFF'))
    return 'This creator isn’t accepting vendor offers right now.';
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

  // Token-gated send — DEBITS (escrows) a reach token up front. The RPC is
  // SECURITY DEFINER + answering-member gated, so it runs on the RLS client.
  // On any debit failure the RPC raises and the offer is rolled back — an offer
  // can never exist unpaid.
  const { data, error } = await supabase.rpc('offer_creator_reach_hold', {
    p_vendor_profile_id: vendorProfileId,
    p_creator_user_id: creatorUserId,
    p_creator_rate_terms: creatorRate,
    p_audience_rate_terms: audienceRate || null,
  });

  if (error) back(humanizeOfferError(error.message));

  // Notify the creator (reuses the notification pipeline). Best-effort.
  // `tokens_charged` = what was ACTUALLY debited at send; refunded only if the
  // offer expires unanswered.
  const result = data as {
    ok?: boolean;
    escrowed?: boolean;
    offer_id?: string;
    tokens_charged?: number;
  } | null;
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
