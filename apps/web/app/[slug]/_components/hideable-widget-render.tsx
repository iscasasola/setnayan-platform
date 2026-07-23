import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { formatEventDate } from '@/lib/events';
import { isGuestNowTriggerEnabled } from '@/lib/guest-now-trigger';
import { ROLE_LABELS } from '@/lib/guests';
import type { InvitationWidgetRow } from '@/lib/invitation-widgets';
import type { ScheduleBlockRow } from '@/lib/schedule';
import { eventNounOf } from '../_lib/event-noun';
import type { EventRow, GuestRow } from '../_lib/types';
import { CountdownWidget } from './countdown';
import { DressCodeWidget } from './dress-code-widget';
import { OurLoveStoryWidget } from './our-love-story-widget';
import { OurPhotosWidget } from './our-photos-widget';
import { PhotoMomentsWidget } from './photo-moments-widget';
import { ScheduleWidget } from './schedule-widget';
import { SpecialMessageWidget } from './special-message-widget';
import { TierComparisonWidget } from './tier-comparison-widget';
import { VenueWidget } from './venue-widget';
import { WhatToBringWidget } from './what-to-bring-widget';
import { YourPhotosWidget } from './your-photos-widget';

/**
 * Dispatch on widget_type to render the right widget. Owns the per-widget
 * conditional skips (Countdown hides itself when event has no date;
 * Schedule hides when no public blocks AND not live, etc.) so the
 * call-site stays a clean .map() over the editor's display_order.
 *
 * Widgets that are show/hide-only (no field-level config) get their
 * content from existing events.* columns or from the guest record. The
 * widget editor's job is the layer ABOVE this — which widgets render
 * + in what order — NOT the per-widget content (which lives in
 * sibling editors at /website/dress-code, /website/photo-moments, etc.).
 */
export function HideableWidgetRender({
  widget,
  event,
  guest,
  sideLabel,
  scheduleBlocks,
  isLive,
  scheduleEstimated = false,
  isLimitedPlusOne,
  ourPhotoUrls,
}: {
  widget: InvitationWidgetRow;
  event: EventRow;
  guest: GuestRow;
  sideLabel: string;
  scheduleBlocks: ScheduleBlockRow[];
  isLive: boolean;
  /** RSVP-season "Estimated program" label on the schedule widget (owner
   *  directive 2026-07-23, NEXT_PUBLIC_GUEST_NOW_TRIGGER-gated upstream). */
  scheduleEstimated?: boolean;
  isLimitedPlusOne: boolean;
  ourPhotoUrls: string[];
}) {
  // The is_always_on widgets render in fixed positions in the parent
  // function. This dispatcher only renders hideable widgets; receiving
  // an always-on widget here is a defensive no-op (would only happen
  // via a DB-side row that bypassed the editor's is_always_on flag).
  if (widget.is_always_on) return null;

  switch (widget.widget_type) {
    case 'event_details':
      return (
        <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Event details
          </p>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Detail label="Date" value={formatEventDate(event.event_date) || '—'} />
            <Detail label="Venue" value={event.venue_name ?? '—'} />
            {event.venue_address ? (
              <Detail label="Address" value={event.venue_address} className="sm:col-span-2" />
            ) : null}
            <Detail label="Your role" value={ROLE_LABELS[guest.role]} />
            <Detail label="Side" value={sideLabel} />
          </dl>
        </section>
      );

    case 'countdown':
      // Per-widget skip: no event date → no countdown. The widget row
      // is still "visible" in the editor; the renderer just skips when
      // the data isn't available yet.
      return event.event_date ? <CountdownWidget targetIso={event.event_date} /> : null;

    case 'schedule':
      // Per-widget skip: when live, the schedule is already pinned at
      // the top of the article (Task #13 day-of-mode safety belt).
      // Don't render the same blocks twice. When NOT live, render the
      // standard widget only when there are public blocks to show.
      // (The tea-ceremony card is rendered once in the identified-guest
      // article body — NOT here too, or a Chinese event with visible
      // schedule blocks would show the card twice.)
      return !isLive && scheduleBlocks.length > 0 ? (
        <ScheduleWidget
          blocks={scheduleBlocks}
          eventTz={eventTimezoneFromCoords(event.venue_latitude, event.venue_longitude)}
          nowTrigger={isGuestNowTriggerEnabled()}
          estimated={scheduleEstimated}
        />
      ) : null;

    case 'venue_map':
      return <VenueWidget event={event} />;

    case 'dress_code':
      return <DressCodeWidget config={event.dress_code_config ?? null} ceremonyType={event.ceremony_type ?? null} genderSeparation={(event as { gender_separation?: string | null }).gender_separation ?? null} />;

    case 'photo_moments':
      return <PhotoMomentsWidget config={event.photo_moments_config} />;

    case 'your_photos':
      return (
        <YourPhotosWidget
          limited={isLimitedPlusOne}
          eventId={event.event_id}
          eventPublicId={event.public_id}
          eventNoun={eventNounOf(event)}
        />
      );

    case 'special_message':
      return <SpecialMessageWidget text={event.special_message ?? null} />;

    case 'what_to_bring':
      return <WhatToBringWidget text={event.what_to_bring ?? null} />;

    case 'our_photos':
      return <OurPhotosWidget urls={ourPhotoUrls} />;

    case 'our_love_story':
      return <OurLoveStoryWidget config={event.love_story} />;

    case 'tier_comparison':
      return <TierComparisonWidget limited={isLimitedPlusOne} eventNoun={eventNounOf(event)} />;

    // Always-on widgets (hero, greeting, qr_card, rsvp) are not reachable
    // here — they render in fixed positions in the parent function. The
    // `widget.is_always_on` guard above also short-circuits these. Any
    // future widget_type added to the catalog needs a branch here OR a
    // dedicated fixed-position render in the parent.
    case 'hero':
    case 'greeting':
    case 'qr_card':
    case 'rsvp':
      return null;
  }
}

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="font-mono text-xs uppercase tracking-[0.15em] text-ink/50">
        {label}
      </dt>
      <dd className="mt-0.5 text-base text-ink">{value}</dd>
    </div>
  );
}
