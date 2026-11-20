/**
 * /[slug]/hub — THE ADDRESS STAYS; THE SECOND BAR IS GONE.
 *
 * 🧭 ONE BAR PER STAGE (controller under owner delegation, 20 Nov 2026 —
 * DECISION_LOG "EVENT HUB MAKER — ONE TOOLBAR, FULL SCREEN, APPROVED", its last
 * sentence): *"The Day keeps ONE bar (Live · Home · Camera · Memories · Me), the
 * /hub second bar goes and Watch lives inside Live."*
 *
 * This route used to draw its own fullscreen screen with its own bottom bar —
 * Live · Watch · Camera · Memories · Me · More (Schedule · Directions) — beside
 * the event page's bar (DECISION_LOG 2026-06-28, the event-day guest hub). Since
 * 2026-09-30 the event page on The Day IS that hub, each tab its own page
 * (`hub-tabs.ts`), so a guest on the day met two bars for one moment. Every tab
 * of the old bar has a home on the event page (`HUB_TAB_HOME`, `_lib/day-hub.ts`):
 * Live carries the programme, the broadcast and the directions; Memories the
 * wall; Me the pass, the code and the seat; the bar's Camera the camera.
 *
 * 🔑 THE ADDRESS IS KEPT, NOT RETIRED. Printed passes, an installed home-screen
 * tile (`/redeem?…&to=hub`, `manifest.webmanifest`), the footer's "Happening
 * now" and every link shared before today still carry `/hub`. They land on the
 * event page's matching tab — never a 404, never a second bar.
 *
 * WHAT IS KEPT FROM THE OLD PAGE, to the letter: the stage is the one the event's
 * own page composes (a host's `?phase=` preview, else the couple's pin, else the
 * venue's clock — `the-day-hub-follows-the-stage.test.ts`), and a signed-in host
 * before the day still rehearses The Day (`dayHubDoor`). The visibility gate is
 * the destination's own: this route only ever sends a visitor to `/[slug]`,
 * which applies it, so it reads nothing private and shows nothing at all.
 */

import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { guestRead } from '@/lib/guest-read';
import { RESERVED_SLUGS } from '@/lib/reserved-slugs';
import { resolveProfile, surfaceEnabled } from '@/lib/event-type-profile';
import { solemnAdjustedPhase } from '../_lib/event-words';
import { dayHubDoor, dayHubLanding, dayHubOpens } from '../_lib/day-hub';
import { isSignedInEventHost } from '@/lib/slug-access';
import { getLifecyclePhase, manualLaunchPhase, type LifecyclePhase } from '@/lib/invitation-widgets';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/** A doorway, never a page: nothing here is a crawl target. */
export const metadata: Metadata = {
  title: 'Live hub',
  robots: { index: false, follow: false },
};

export default async function EventHubPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;
  if (!slug || RESERVED_SLUGS.has(slug)) notFound();

  const admin = createAdminClient();
  // 🔌 A FAILED READ IS NOT A MISSING EVENT (lib/guest-read.ts): retried through a blip and THROWN if it still failed.
  const event = await guestRead('hub (event)', () =>
    admin
      .from('events')
      .select(
        `event_id, slug, display_name, event_type, event_date, event_end_date, venue_latitude, venue_longitude, launch_mode, manual_phase, std_invitation_launch_date`,
      )
      .ilike('slug', slug)
      .maybeSingle(),
  );
  if (!event) notFound();

  // Same surface gate as /[slug]: a profile with no Event Hub has no `/hub` either.
  const eventTypeProfile = await resolveProfile(event.event_type);
  if (!surfaceEnabled(eventTypeProfile, 'website')) notFound();

  // A host's (or a demo event's) `?phase=` preview — the same one /[slug] honours, kept on the way through.
  const isDemoEvent =
    event.slug?.toLowerCase().startsWith('test-') === true ||
    (event.display_name ?? '').toUpperCase().includes('[TEST]');
  const phaseParam = typeof search.phase === 'string' ? search.phase.toLowerCase() : '';
  const isValidPhaseParam =
    phaseParam === 'event' || phaseParam === 'editorial' || phaseParam === 'rsvp';
  // The ONE shared host definition (`isSignedInEventHost`) — a guest member is not a host.
  const isHost =
    isValidPhaseParam && !isDemoEvent ? await isSignedInEventHost(event.event_id) : false;
  const phaseOverride: LifecyclePhase | null =
    isValidPhaseParam && (isDemoEvent || isHost) ? (phaseParam as LifecyclePhase) : null;

  /*
    🧭 THE STAGE IS THE PAGE'S — ONE ANSWER, NOT TWO (2026-10-11). A host's
    `?phase=` preview, else the couple's pin, else the venue's clock — exactly
    what `app/[slug]/page.tsx` composes. Left literal, as at every site that
    picks the Event Hub's face (`manualLaunchPhase`'s own docblock).
  */
  const pinnedPhase: LifecyclePhase | null = manualLaunchPhase(event.launch_mode, event.manual_phase);
  const venueTz = eventTimezoneFromCoords(event.venue_latitude, event.venue_longitude);
  const pageStage: LifecyclePhase = solemnAdjustedPhase(
    phaseOverride ??
      pinnedPhase ??
      getLifecyclePhase(event.event_date, venueTz, event.event_end_date ?? null, undefined, (event as { std_invitation_launch_date?: string | null }).std_invitation_launch_date ?? null),
    eventTypeProfile.terminology.register === 'solemn',
  );

  // Before the day a signed-in HOST rehearses The Day (`dayHubDoor`); a guest or a stranger leaves for the stage's page.
  const door = dayHubDoor(
    pageStage,
    !dayHubOpens(pageStage) && !phaseOverride ? await isSignedInEventHost(event.event_id) : false,
  );

  redirect(
    dayHubLanding({
      slug: event.slug ?? slug,
      door,
      stage: pageStage,
      tab: search.tab,
      phaseOverride,
    }),
  );
}
