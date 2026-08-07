'use server';

/**
 * /vendor-dashboard/creators · vendor-scoped server actions (Creator Economy P1).
 *
 * A vendor sends a discount OFFER to a creator. SENDING IS FREE.
 *
 * ⚠ It used to cost a reach token, escrowed at send and refunded if unanswered
 * (migration 20270819350491). That was removed 2026-08-07 with the token
 * retirement (owner: "tokens are already retired") — with packs gone there was
 * no way to acquire one, so the first Pro vendor to press Send would have been
 * told to "top up your tokens" at a shop that no longer exists.
 * `offer_creator_reach_hold` keeps its name and signature (PostgREST resolves
 * an RPC by its exact set of NAMED arguments) and keeps every gate — member,
 * tier, eligibility, opt-out, one-outstanding. Only the debit is gone.
 *
 * The vendor_profile_id is resolved server-side from the authed user, never
 * trusted from the form.
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
    return 'Creator collabs are a Pro-and-up feature. Upgrade your plan to offer discounts to storytellers.';
  // INSUFFICIENT_WALLET_BALANCES can no longer be raised — sending is free
  // since 2026-08-07. Kept only for a stale-deploy window where the previous
  // token-charging RPC is still live, and worded without naming a currency the
  // vendor cannot buy.
  if (message.includes('INSUFFICIENT_WALLET_BALANCES'))
    return 'That offer could not be sent right now. Please try again.';
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

  // FREE send. The RPC is SECURITY DEFINER + answering-member gated, so it runs
  // on the RLS client and still enforces tier, eligibility, opt-out and the
  // one-outstanding-offer rule — those raise and roll the offer back.
  const { data, error } = await supabase.rpc('offer_creator_reach_hold', {
    p_vendor_profile_id: vendorProfileId,
    p_creator_user_id: creatorUserId,
    p_creator_rate_terms: creatorRate,
    p_audience_rate_terms: audienceRate || null,
  });

  if (error) back(humanizeOfferError(error.message));

  // Notify the creator (reuses the notification pipeline). Best-effort.
  // `escrowed` is now always false and `tokens_charged` always 0 — both are kept
  // in the RPC's return shape so a caller reading them gets a truthful zero
  // rather than a missing key.
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
