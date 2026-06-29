'use server';

/**
 * offerServiceInterest — vendor inverse cross-sell (owner-locked 2026-06-12
 * "multi-service inquiry mapping"). From their own thread view a vendor can
 * offer one of THEIR OWN active services back to the couple, recorded as a
 * thread_service_interests row with source='vendor_offered' /
 * added_by_role='vendor'. The couple then sees it in the shared "Inquiring
 * about" chip row. Metadata only — it never changes the token/accept flow.
 *
 * The gating now lives in offerServiceCore (lib/offer-service-core.ts) so the
 * native endpoint (api/vendor/chat/[threadId]/offer-service) shares it. This
 * action is the FormData + revalidate wrapper.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { offerServiceCore, type OfferServiceResult } from '@/lib/offer-service-core';

export type { OfferServiceResult };

export async function offerServiceInterest(formData: FormData): Promise<OfferServiceResult> {
  const threadId = formData.get('thread_id');
  const serviceId = formData.get('vendor_service_id');
  if (typeof threadId !== 'string' || typeof serviceId !== 'string') {
    return { status: 'error', message: 'Invalid input' };
  }

  const supabase = await createClient();
  const result = await offerServiceCore(supabase, {
    threadId,
    vendorServiceId: serviceId,
  });

  if (result.status === 'ok') {
    revalidatePath(`/vendor-dashboard/messages/${threadId}`);
  }
  return result;
}
