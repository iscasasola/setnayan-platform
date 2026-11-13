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
import { sharePhotoCore } from '@/lib/share-photo-core';

export type { OfferServiceResult };

export async function offerServiceInterest(formData: FormData): Promise<OfferServiceResult> {
  const threadId = formData.get('thread_id');
  // 💬 PORTFOLIO › SEND TO A CHAT (ruling 5951) — a photo, not a card, from the same "post into a client chat" door:
  // `via=photo` re-checks the chat exactly as the card share does, then posts the photo through the shipped chat send
  // (`sharePhotoCore`). Reused, not a new export: every exported server action is a Vercel route and the budget is at
  // its ceiling (scripts/lint-server-action-budget.mjs).
  if (formData.get('via') === 'photo') {
    if (typeof threadId !== 'string') return { status: 'error', message: 'Invalid input' };
    const photo = formData.get('photo');
    const note = formData.get('note');
    const supabase = await createClient();
    const result = await sharePhotoCore(supabase, {
      threadId,
      photo: photo instanceof File ? photo : null,
      note: typeof note === 'string' ? note : '',
    });
    if (result.status === 'ok') revalidatePath(`/vendor-dashboard/messages/${threadId}`);
    return result;
  }
  const serviceId = formData.get('vendor_service_id');
  if (typeof threadId !== 'string' || typeof serviceId !== 'string') {
    return { status: 'error', message: 'Invalid input' };
  }

  // 🔗 THE SHARE ICON ON SHOP › SERVICES IS THIS SAME OFFER FROM ANOTHER DOOR (owner 2026-11-11: "Share … is share to
  // an client event. To enter to a chat. That is notified so the client can see."). `via=share` asks the core to
  // re-check the chat is open and to tell the client IN THE APP ONLY (`service_card_shared`, never an email). Reused,
  // not a new export: every exported server action is a Vercel route (scripts/lint-server-action-budget.mjs).
  const via = formData.get('via') === 'share' ? 'share' : 'chat';
  const supabase = await createClient();
  const result = await offerServiceCore(supabase, {
    threadId,
    vendorServiceId: serviceId,
    notice: via === 'share' ? 'shared' : 'chat',
  });

  if (result.status === 'ok') {
    revalidatePath(`/vendor-dashboard/messages/${threadId}`);
  }
  return result;
}
