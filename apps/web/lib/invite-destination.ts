/**
 * WHAT DOES THE LAST DOOR ACTUALLY OPEN?
 *
 * Door 03 of the invite arrival (`[slug]/invite/enter/page.tsx`) hands the guest
 * into the Event Hub at `/{slug}`. That destination is CORRECT and is not in
 * question here — `lib/invite-arrival.ts` says so in as many words, and
 * `/[slug]/hub` is a different thing (the fullscreen event-DAY hub).
 *
 * 🔑 THE WORDS WERE THE FAULT. The door said "Your invitation is ready — your
 * seat, your QR and everything shared with guests are waiting on it" over a
 * button reading "Open your invitation". But the Event Hub wears a face chosen
 * by how far off the day is, and far out that face is the SAVE THE DATE:
 * `WIDGET_PHASES` puts `qr_card` in `['rsvp', 'event']` only, so in the
 * save-the-date phase the QR the door promised is gated out of the page it
 * sends them to. Owner, 2026-09-11, having walked it: *"it went back to save the
 * date"*.
 *
 * ⚠ THE TRAP THAT MAKES THIS EASY TO MIS-VERIFY. An event crosses the threshold
 * on its own, and the old copy then becomes true FOR THAT EVENT while staying
 * wrong for every couple further out — which is most of them at the moment they
 * share the link. So never spot-check this against one event, and never restate
 * the threshold: this module asks `getLifecyclePhase`, the same resolver
 * `app/[slug]/page.tsx` asks, and no number appears anywhere below.
 *
 * Pure. The profile and the venue zone are resolved by the page (the zone lookup
 * is server-only), exactly as `lib/invite-reveal.ts` does it — this is the same
 * composition, asked for a different answer.
 */
import { surfaceEnabled, type EventTypeProfile } from './event-type-profile';
import { getLifecyclePhase, isWebsitePhasesEnabled, type LifecyclePhase } from './invitation-widgets';
import { solemnAdjustedPhase } from '@/app/[slug]/_lib/event-words';

/** The face the Event Hub will be wearing when this guest arrives on it. */
export type ArrivalDestination = 'save_the_date' | 'invitation' | 'day_of' | 'story';

/**
 * The phase → destination map, split out so it can be exercised directly.
 *
 * 🔒 `phasesEnabled` FALSE IS NOT "no phase" — it is the ordinary body, the one
 * that renders the hero, the details and the reply card together. That IS the
 * invitation, so it maps there rather than to some fifth word.
 */
export function arrivalDestination(input: {
  phasesEnabled: boolean;
  /** Already solemn-adjusted, exactly as `app/[slug]/page.tsx` computes it. */
  lifecyclePhase: LifecyclePhase;
}): ArrivalDestination {
  if (!input.phasesEnabled) return 'invitation';
  switch (input.lifecyclePhase) {
    case 'save_the_date':
      return 'save_the_date';
    case 'event':
      return 'day_of';
    case 'editorial':
      return 'story';
    case 'rsvp':
    default:
      return 'invitation';
  }
}

/**
 * The same composition `app/[slug]/page.tsx` runs to pick its own face — asked
 * here so the door and the page can never disagree about which one it is.
 */
export function arrivalDestinationFor(input: {
  profile: EventTypeProfile;
  eventDate: string | null;
  eventEndDate: string | null;
  /** `eventTimezoneFromCoords(venue_latitude, venue_longitude)` — as the Event Hub page. */
  venueTz: string;
  nowMs?: number;
}): ArrivalDestination {
  const { profile } = input;
  return arrivalDestination({
    phasesEnabled: isWebsitePhasesEnabled() || surfaceEnabled(profile, 'website'),
    lifecyclePhase: solemnAdjustedPhase(
      getLifecyclePhase(input.eventDate, input.venueTz, input.eventEndDate, input.nowMs),
      profile.terminology.register === 'solemn',
    ),
  });
}

/**
 * What the last door says, and what its button says.
 *
 * 🔒 THE `invitation` ARM IS THE SHIPPED SENTENCE, BYTE FOR BYTE. It was never
 * wrong — it was only ever said in the wrong places. Every other arm is written
 * to what that face actually carries and no further:
 *
 *   · save_the_date — the body IS the save-the-date (site-body-plan.ts), and
 *     `qr_card` is not in phase. So no QR is claimed, and the invitation is
 *     described as still to come rather than as ready.
 *   · day_of        — `qr_card` IS in phase for 'event'.
 *   · story         — `showEditorial` replaces the body outright. It claims the
 *     story and nothing about photographs, because which widgets a couple kept
 *     is theirs to decide and this door cannot see it.
 *
 * ⚠ A guest reaches this door having just replied, so none of these may imply
 * the reply did not land — the notice above them already says that it did.
 */
export function arrivalDestinationWords(
  destination: ArrivalDestination,
): { blurb: string; cta: string } {
  switch (destination) {
    case 'save_the_date':
      return {
        blurb:
          'The day is still a way off, so what opens now is the save the date — the day to hold. Your seat is kept, and the full invitation follows closer to the time.',
        cta: 'Open the save the date',
      };
    case 'day_of':
      return {
        blurb:
          'It is happening today — your seat, your QR and everything shared with guests are waiting on the page.',
        cta: 'Open the day',
      };
    case 'story':
      return {
        blurb: 'The day has been and gone, and the page has turned into the story of it.',
        cta: 'Open the story',
      };
    case 'invitation':
    default:
      return {
        blurb:
          'Your invitation is ready — your seat, your QR and everything shared with guests are waiting on it.',
        cta: 'Open your invitation',
      };
  }
}
