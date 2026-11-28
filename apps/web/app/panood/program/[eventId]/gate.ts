import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isLiveStudioSetupHost, requirePanoodControlRoomMember } from '@/lib/panood-control-room-access';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import { HERO_MONOGRAM_COLUMNS } from '@/lib/hero-monogram-data';

/**
 * Every answer the program window gives that is not the picture — sign in, no such event, not a control-room
 * member — decided by `./layout.tsx` BEFORE `./loading.tsx` streams, so a 307 / 404 is never a 200 + client hop.
 * `cache()`: one set of reads per request; the page asks again and gets the same answer.
 * 🔒 app/_components/a-route-decides-before-it-streams.test.ts
 */
export const gateProgramOutput = cache(async (eventId: string) => {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select(`event_id, slug, ${HERO_MONOGRAM_COLUMNS}, logo_wanted`)
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  // WAVE 5: the unified controller opens this window, and its own host gate accepts
  // one membership shape more than the legacy control room's does — a legacy
  // `event_members.member_type = 'coordinator'`, who can already read and write the
  // channels under their own RLS. A pop-out stricter than the screen that opened it
  // would bounce a coordinator off the surface their own controller just launched, so
  // this accepts EITHER predicate, and the wider one only while the flag is on.
  const isMember =
    (await requirePanoodControlRoomMember(eventId, user.id)) ||
    (liveStudioRoamEnabled() && (await isLiveStudioSetupHost(eventId, user.id)));
  if (!isMember) redirect(`/dashboard/${eventId}`);
  return { supabase, user, event };
});
