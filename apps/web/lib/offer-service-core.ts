import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchThreadById } from '@/lib/chat';
import { recordThreadInterests } from '@/lib/thread-interests';

/**
 * Shared CORE for offerServiceInterest (vendor inverse cross-sell) — a vendor
 * offers one of THEIR OWN active services back to the couple in a thread,
 * recorded as a thread_service_interests row (source='vendor_offered'). Split
 * out of the collocated server action so the SAME ownership + active-service
 * gating runs under both the web action and the native endpoint
 * (api/vendor/chat/[threadId]/offer-service). Metadata only — never touches the
 * token/accept flow. The caller passes its OWN RLS-scoped client.
 */
export type OfferServiceResult =
  | { status: 'ok' }
  | { status: 'not_signed_in' }
  | { status: 'not_owner' }
  | { status: 'invalid_service' }
  | { status: 'error'; message: string };

export async function offerServiceCore(
  supabase: SupabaseClient,
  input: { threadId: string; vendorServiceId: string },
): Promise<OfferServiceResult> {
  const { threadId, vendorServiceId } = input;
  if (!threadId || !vendorServiceId) {
    return { status: 'error', message: 'Invalid input' };
  }

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
    .eq('vendor_service_id', vendorServiceId)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .eq('is_active', true)
    .maybeSingle();
  if (!svc) return { status: 'invalid_service' };

  await recordThreadInterests(supabase, {
    threadId,
    addedByRole: 'vendor',
    seeds: [
      {
        vendorServiceId,
        categoryKey: (svc as { category: string | null }).category ?? null,
        source: 'vendor_offered',
      },
    ],
  });

  // Notify every couple member that the vendor offered one of their services
  // in-thread (best-effort — the interest row already landed; a failed notify
  // must not affect the offer). Fanned out over couple-type event_members via
  // the admin client, mirroring the vendor→couple chat_message path.
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
    console.error('[offerServiceCore] couple notify failed:', e);
  }

  return { status: 'ok' };
}
