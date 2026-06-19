'use server';

/**
 * offerServiceInterest — vendor inverse cross-sell (owner-locked 2026-06-12
 * "multi-service inquiry mapping"). From their own thread view a vendor can
 * offer one of THEIR OWN active services back to the couple, recorded as a
 * thread_service_interests row with source='vendor_offered' /
 * added_by_role='vendor'. The couple then sees it in the shared "Inquiring
 * about" chip row. Metadata only — it never changes the token/accept flow.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchThreadById } from '@/lib/chat';
import { recordThreadInterests } from '@/lib/thread-interests';

export type OfferServiceResult =
  | { status: 'ok' }
  | { status: 'not_signed_in' }
  | { status: 'not_owner' }
  | { status: 'invalid_service' }
  | { status: 'error'; message: string };

export async function offerServiceInterest(formData: FormData): Promise<OfferServiceResult> {
  const threadId = formData.get('thread_id');
  const serviceId = formData.get('vendor_service_id');
  if (typeof threadId !== 'string' || typeof serviceId !== 'string') {
    return { status: 'error', message: 'Invalid input' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'not_signed_in' };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { status: 'not_owner' };

  // The thread must belong to this vendor (defense-in-depth atop RLS).
  const thread = await fetchThreadById(supabase, threadId);
  if (!thread || thread.vendor_profile_id !== profile.vendor_profile_id) {
    return { status: 'not_owner' };
  }

  // The offered service must be one of this vendor's own active services.
  const admin = createAdminClient();
  const { data: svc } = await admin
    .from('vendor_services')
    .select('vendor_service_id, category')
    .eq('vendor_service_id', serviceId)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .eq('is_active', true)
    .maybeSingle();
  if (!svc) return { status: 'invalid_service' };

  await recordThreadInterests(supabase, {
    threadId,
    addedByRole: 'vendor',
    seeds: [
      {
        vendorServiceId: serviceId,
        categoryKey: (svc as { category: string | null }).category ?? null,
        source: 'vendor_offered',
      },
    ],
  });

  // Notify every couple member that the vendor offered one of their services
  // in-thread (best-effort — the interest row already landed; a failed notify
  // must not affect the offer). Without this the offered-service chip appears
  // on the couple's shared "Inquiring about" row with no signal. Fanned out
  // over couple-type event_members via the admin client, mirroring the
  // vendor→couple chat_message path in lib/chat-actions.ts.
  try {
    const { data: vendor } = await admin
      .from('vendor_profiles')
      .select('business_name')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    const vendorName = vendor?.business_name?.trim() || 'a vendor';
    const { data: members } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', thread.event_id)
      .eq('member_type', 'couple');
    for (const m of members ?? []) {
      if (!m.user_id) continue;
      await emitNotification({
        userId: m.user_id,
        type: 'chat_message',
        title: `${vendorName} offered a service`,
        body: 'They suggested one of their services in your conversation.',
        relatedUrl: `/dashboard/${thread.event_id}/messages/${threadId}`,
      });
    }
  } catch (e) {
    console.error('[offerServiceInterest] couple notify failed:', e);
  }

  revalidatePath(`/vendor-dashboard/messages/${threadId}`);
  return { status: 'ok' };
}
