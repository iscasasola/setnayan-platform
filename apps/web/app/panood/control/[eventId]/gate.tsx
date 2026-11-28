import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isLiveStudioSetupHost } from '@/lib/panood-control-room-access';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import { HERO_MONOGRAM_COLUMNS } from '@/lib/hero-monogram-data';
import { getIapGate } from '@/lib/request-platform';
import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { resolveBroadcastWindow } from '@/lib/live-studio-window-server';

/**
 * Every answer the Live Watch controller gives that is not the controller — the flag off (404), sign in, "not your
 * event" (404), not a host, and in the iPhone app an event that does not own Live Watch (both sent to the event) —
 * decided by `./layout.tsx` BEFORE `./loading.tsx` streams, so none of them is sent as a 200, a skeleton and a client
 * hop. `cache()`: one set of reads per request; the page asks again and gets the same answer.
 * 🔒 app/_components/a-route-decides-before-it-streams.test.ts
 */
export const gateControlRoom = cache(async (eventId: string) => {
  // Flag-dark: the whole surface is gated. notFound() (not redirect) so a direct hit
  // while the flag is off behaves as if the route doesn't exist.
  if (!liveStudioRoamEnabled()) notFound();

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // RLS is the gate, so `{ data: null, error: null }` is the designed 404 —
  // "not your event". A REJECTED query also lands on null, and answering that
  // with the same 404 tells a host mid-event that their own control room does
  // not exist. The two are distinguishable; they are now distinguished.
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(`event_id, slug, event_date, ${HERO_MONOGRAM_COLUMNS}, logo_wanted`)
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventError) {
    console.error('[panood/control] event read refused', eventError);
    return { refused: true as const };
  }
  if (!event) notFound();

  // ── WAVE 4 · HOST GATE, and it is now load-bearing.
  //
  // Until Wave 4 this page leaned entirely on RLS: it read only the host's own
  // zones, so a non-host simply saw nothing. Wave 4 reads camera SEAT rows through
  // the SERVICE-ROLE client — `panood_camera_operators` RLS is control-room-only
  // and does not cover a moderator, who is a legitimate host here — and those rows
  // carry `claim_qr_token`, a seat-hijack credential. So this check is the only
  // thing standing in front of that read, and it is the SAME predicate the server
  // actions use (isLiveStudioSetupHost) so the two cannot drift.
  if (!(await isLiveStudioSetupHost(eventId, user.id))) redirect(`/dashboard/${eventId}`);

  /* 🍎 THE iPHONE APP, WHERE APPLE SELLS (version 1.1 — `IAP_OPENED_ROUTE` in lib/store-shell.ts; middleware opens
     this controller there ONLY then). There it is the "Go live" door of a Live Watch the event owns — bought in the app
     or on the web (guideline 3.1.3(b)). It never reads the web price, its Exit goes Home, and an event that does not
     own Live Watch is sent Home, where Activate is Apple's sheet. False everywhere else — and then nothing here
     changes. Held by `lib/the-app-opens-what-apple-sells.test.ts`. */
  const appleIap = (await getIapGate()).iap;
  // 🍎 In the app the controller is the door of an OWNED Live Watch only — every unlock surface links to the
  // web's buy page with its price, and the app's one buy is Apple's sheet on Home (`IapLiveWatchSheet`). The window is
  // the same resolver the page reads (it reuses this one); only the app needs it this early.
  const broadcastWindow = appleIap ? await resolveBroadcastWindow(await eventEntitlementClient(eventId), eventId) : null;
  if (appleIap && !broadcastWindow?.multiCam) redirect(`/dashboard/${eventId}`);

  return { refused: false as const, supabase, user, event, appleIap, broadcastWindow };
});

/** A refused event read — never a 404: a host mid-event must not be told their control room does not exist. */
export function ControlRoomUnreadable() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-ink">We couldn&rsquo;t open the control room</h1>
      <p className="mt-3 text-sm text-ink/70">
        Something went wrong reading your event — this is <strong>not</strong> a sign it
        was deleted or that you have lost access. If you are already on air, you are
        still on air. Reload in a moment.
      </p>
    </main>
  );
}
