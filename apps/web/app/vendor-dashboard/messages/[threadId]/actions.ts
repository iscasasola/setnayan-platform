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

  revalidatePath(`/vendor-dashboard/messages/${threadId}`);
  return { status: 'ok' };
}
