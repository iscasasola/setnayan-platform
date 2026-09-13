/**
 * Does the invite link's first door open with the couple's cinematic reveal?
 *
 * The owner, 2026-09-10: *"our cinematic reveal is also integrated as one whole
 * concept design"* — a Pro invite theme opens the way the Event Hub opens. So
 * this is NOT a second opinion about when a reveal plays. It asks the Event
 * Hub's own rule (`cinematicRevealPlays`, lib/site-body-plan.ts) with the SAME
 * inputs app/[slug]/page.tsx hands it:
 *
 *   · phases on: the env override OR the profile's 'website' surface;
 *   · the stage from `getLifecyclePhase` on the VENUE's clock, then
 *     `solemnAdjustedPhase` (a wake never has a save-the-date);
 *   · the event type's wedding-only parts — the fence that keeps a wake, and
 *     every type without the Save-the-Date film, from ever seeing a veil.
 *
 * So the invite door inherits both owner exclusions: nothing on the day itself
 * (a veil between a guest and their table is a toll gate) or during the story
 * afterwards, and nothing for a wake. Whether a THEME asks for a reveal at all
 * (House never does) is the caller's half; this is only "may one play now".
 *
 * Pure — the profile and the zone are resolved by the page (the zone lookup is
 * server-only), so the test can hand it real profiles and a fixed "now".
 */
import { surfaceEnabled, type EventTypeProfile } from './event-type-profile';
import { getLifecyclePhase, isWebsitePhasesEnabled } from './invitation-widgets';
import { resolveWeddingOnlyParts } from './wedding-only-parts';
import { cinematicRevealPlays } from './site-body-plan';
import { solemnAdjustedPhase } from '@/app/[slug]/_lib/event-words';

export function inviteRevealPlays(input: {
  profile: EventTypeProfile;
  eventDate: string | null;
  eventEndDate: string | null;
  /** `eventTimezoneFromCoords(venue_latitude, venue_longitude)` — as the Event Hub page. */
  venueTz: string;
  nowMs?: number;
}): boolean {
  const { profile } = input;
  return cinematicRevealPlays({
    phasesEnabled: isWebsitePhasesEnabled() || surfaceEnabled(profile, 'website'),
    lifecyclePhase: solemnAdjustedPhase(
      getLifecyclePhase(input.eventDate, input.venueTz, input.eventEndDate, input.nowMs),
      profile.terminology.register === 'solemn',
    ),
    weddingOnlyParts: resolveWeddingOnlyParts(profile),
  });
}
