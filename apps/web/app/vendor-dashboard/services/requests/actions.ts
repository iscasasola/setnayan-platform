'use server';

/**
 * The supplier's two writes on a service request (owner rulings 2026-11-13):
 *
 *   · putCardUnderRequest — a card the shop made joins its waiting request, so it shows under
 *     "<category> › Others" and moves with the decision. The card is the shop's own (session
 *     client, row policy) and the request is the shop's own and still waiting (session read).
 *
 * (Opening a decided request clears the notice — `markRequestSeen` in lib/service-requests.server.ts,
 * deliberately NOT a server action: an exported action is callable from any browser with any id.)
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { SERVICE_REQUESTS_HREF } from '@/lib/service-requests';

async function ownShop() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, vendorProfileId: profile.vendor_profile_id as string };
}

export async function putCardUnderRequest(formData: FormData) {
  const { supabase, vendorProfileId } = await ownShop();
  const requestId = String(formData.get('request_id') ?? '').trim();
  const cardId = String(formData.get('vendor_service_id') ?? '').trim();
  const here = `${SERVICE_REQUESTS_HREF}/${encodeURIComponent(requestId)}`;
  if (!requestId || !cardId) return redirect(`${here}?error=${encodeURIComponent('Pick a card first.')}`);

  // The request must be this shop's own AND still waiting — a decided request has already moved its cards.
  const { data: req, error: reqErr } = await supabase
    .from('taxonomy_category_requests')
    .select('request_id, status')
    .eq('request_id', requestId)
    .eq('proposed_by_vendor_id', vendorProfileId)
    .maybeSingle();
  if (reqErr) return redirect(`${here}?error=${encodeURIComponent('We couldn’t read that request. Try again.')}`);
  if (!req) return redirect(`${SERVICE_REQUESTS_HREF}?error=${encodeURIComponent('That request is gone.')}`);
  if ((req as { status: string }).status !== 'pending') {
    return redirect(`${here}?error=${encodeURIComponent('We already decided on this one — your cards moved with it.')}`);
  }

  const { data: moved, error } = await supabase
    .from('vendor_services')
    .update({ category_request_id: requestId, updated_at: new Date().toISOString() })
    .eq('vendor_service_id', cardId)
    .eq('vendor_profile_id', vendorProfileId)
    .select('vendor_service_id')
    .maybeSingle();
  if (error) return redirect(`${here}?error=${encodeURIComponent(error.message)}`);
  // A zero-row update is not a success: the card is not this shop's.
  if (!moved) return redirect(`${here}?error=${encodeURIComponent('That card is not in your shop.')}`);

  revalidatePath(here);
  revalidatePath(SERVICE_REQUESTS_HREF);
  revalidatePath('/vendor-dashboard/shop');
  redirect(`${here}?placed=1`);
}
