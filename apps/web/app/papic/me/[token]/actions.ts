'use server';

// Guest Stories (FREE tier) — server action that turns a guest's personal QR
// token into a client-side render plan: their tagged photos (presigned), a
// Stories template, and a Setnayan-owned music track (source + beat grid).
//
// The token IS the capability (same credential the camera + gallery use), so
// we re-resolve the guest from it server-side rather than trusting the client
// with an event/guest id. No entitlement gate — this is the free viral loop.

import { createAdminClient } from '@/lib/supabase/admin';
import { buildGuestStoryPlan, type GuestStoryPlan } from '@/lib/guest-stories';

export async function prepareGuestStory(token: string): Promise<GuestStoryPlan> {
  const cleanToken = token?.trim();
  const empty: GuestStoryPlan = {
    taggedPhotoCount: 0,
    canRender: false,
    photos: [],
    media: [],
    template: {
      slug: 'golden-hour-stories-30',
      name: 'Golden Hour',
      palette: ['#FAF7F2', '#C9A14B', '#E2B873', '#3A2A1C'],
      beatsPerCut: 2,
      durationSec: 30,
    },
    music: null,
    musicOptions: [],
  };
  if (!cleanToken) return empty;

  const admin = createAdminClient();
  const { data } = await admin
    .from('guests')
    .select('guest_id, event_id')
    .eq('qr_token', cleanToken)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return empty;

  return await buildGuestStoryPlan(data.event_id as string, data.guest_id as string);
}
