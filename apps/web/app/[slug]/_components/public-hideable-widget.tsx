import type { EventWords } from '../_lib/event-words';
import { isChineseWedding } from '@/lib/chinese-wedding';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { isGuestNowTriggerEnabled } from '@/lib/guest-now-trigger';
import type { InvitationWidgetRow } from '@/lib/invitation-widgets';
import { CustomSectionWidget } from './custom-section-widget';
import { HubCanvasFrame } from './hub-canvas-frame';
import type { ScheduleBlockRow } from '@/lib/schedule';
import { eventNounOf } from '../_lib/event-noun';
import type { EventRow } from '../_lib/types';
import { CountdownWidget } from './countdown';
import { DressCodeWidget } from './dress-code-widget';
import { OurLoveStoryWidget } from './our-love-story-widget';
import { OurPhotosWidget } from './our-photos-widget';
import { PhotoMomentsWidget } from './photo-moments-widget';
import { ScheduleWidget } from './schedule-widget';
import { SpecialMessageWidget } from './special-message-widget';
import { TeaCeremonyCard } from './tea-ceremony-card';
import { TierComparisonWidget } from './tier-comparison-widget';
import { VenueWidget } from './venue-widget';
import { WhatToBringWidget } from './what-to-bring-widget';

/**
 * Per-widget renderer for the anonymous public landing path. Mirrors the
 * `HideableWidgetRender` dispatcher used by InvitationSite but only
 * handles the 6 widget types that don't need a guest object. The 4
 * always-on widgets (hero · greeting · qr_card · rsvp) plus the 2
 * guest-personalized hideable widgets (event_details · your_photos)
 * fall through to `null` because they require a guest session to be
 * meaningful.
 */
type PublicHideableWidgetProps = {
  widget: InvitationWidgetRow;
  event: EventRow;
  /** The event type's own words, resolved ONCE by the body and threaded here
   *  rather than re-resolved per widget. */
  words: EventWords;
  scheduleBlocks: ScheduleBlockRow[];
  isLive: boolean;
  /** RSVP-season "Estimated program" label on the schedule widget (owner
   *  directive 2026-07-23, NEXT_PUBLIC_GUEST_NOW_TRIGGER-gated upstream). */
  scheduleEstimated?: boolean;
  ourPhotoUrls: string[];
  /** ref → presigned URL for section backgrounds, resolved once by SiteBody. */
  canvasMediaUrls?: Readonly<Record<string, string>>;
};

/**
 * 🎨 THE ANONYMOUS PATH GETS THE COUPLE'S ARRANGEMENT TOO.
 *
 * 🔴 It did not, for one commit. The canvas frame was written inside the OTHER
 * dispatcher (`HideableWidgetRender`, the guest path), so a couple who arranged
 * their page saw it and a stranger following their link saw it unarranged —
 * with nothing red anywhere and no way to tell from the dashboard. One frame,
 * both doors; the reasoning lives in `hub-canvas-frame.tsx`.
 */
export function PublicHideableWidget(props: PublicHideableWidgetProps) {
  return <HubCanvasFrame widget={props.widget} mediaUrls={props.canvasMediaUrls}>{PublicHideableWidgetBody(props)}</HubCanvasFrame>;
}

function PublicHideableWidgetBody({
  words,
  widget,
  event,
  scheduleBlocks,
  isLive,
  scheduleEstimated = false,
  ourPhotoUrls,
  canvasMediaUrls,
}: PublicHideableWidgetProps) {
  switch (widget.widget_type) {
    case 'countdown':
      // Match InvitationSite's per-widget skip — no event date, no
      // countdown. The widget row stays "visible" in the editor; the
      // renderer just skips when the data isn't available. A solemn event
      // (the funeral) skips it unconditionally — the widget also guards
      // itself client-side, but this server gate holds even outside the
      // words provider.
      return event.event_date && !words.solemn ? (
        <CountdownWidget
          targetIso={event.event_date}
          timeZone={eventTimezoneFromCoords(event.venue_latitude, event.venue_longitude)}
        />
      ) : null;

    case 'schedule':
      // Match InvitationSite — no double-render during day-of mode (the
      // pinned schedule block already lives at the top of the article
      // on the authed path; the anonymous path doesn't have that pin,
      // but we still skip the standalone widget when isLive to match
      // the editor's "always-on pin replaces hideable" contract).
      return !isLive && scheduleBlocks.length > 0 ? (
        <>
          <ScheduleWidget
            blocks={scheduleBlocks}
            eventTz={eventTimezoneFromCoords(event.venue_latitude, event.venue_longitude)}
            nowTrigger={isGuestNowTriggerEnabled()}
            estimated={scheduleEstimated}
            eventType={event.event_type}
            compact
          />
          {isChineseWedding(event) ? <TeaCeremonyCard event={event} /> : null}
        </>
      ) : null;

    case 'venue_map':
      return <VenueWidget event={event} />;

    case 'dress_code':
      return <DressCodeWidget words={words} config={event.dress_code_config ?? null} ceremonyType={event.ceremony_type ?? null} genderSeparation={(event as { gender_separation?: string | null }).gender_separation ?? null} />;

    case 'photo_moments':
      return <PhotoMomentsWidget words={words} config={event.photo_moments_config} />;

    case 'special_message':
      return <SpecialMessageWidget text={event.special_message ?? null} />;

    case 'what_to_bring':
      return <WhatToBringWidget text={event.what_to_bring ?? null} />;

    case 'our_photos':
      // Couple-curated gallery (Increment A.4) — event-level, no PII, so it
      // renders on the anonymous path too. Resolved display URLs threaded in.
      return <OurPhotosWidget urls={ourPhotoUrls} />;

    // The couple's own sections. One case for all six: the words live in the
    // row's own `config_json`, so the slot number is only which SEAT it takes
    // in the order, never what it says. An empty one renders null.
    case 'custom_1':
    case 'custom_2':
    case 'custom_3':
    case 'custom_4':
    case 'custom_5':
    case 'custom_6':
      return <CustomSectionWidget config={widget.config_json} />;

    case 'our_love_story':
      return <OurLoveStoryWidget config={event.love_story} mediaUrls={canvasMediaUrls} />;

    case 'tier_comparison':
      // limited=false on the anonymous path — anonymous visitors are
      // never a "limited +1" by definition.
      return (
        <TierComparisonWidget
          limited={false}
          eventNoun={eventNounOf(event)}
          words={words}
        />
      );

    // Always-on + guest-personalized types are intentionally skipped
    // on the anonymous path. event_details needs guest.role + side;
    // your_photos needs the guest's tagged photos. Any future widget
    // type added to the catalog needs an explicit case here OR a
    // dedicated InvitationSite-only render.
    case 'hero':
    case 'greeting':
    case 'qr_card':
    case 'rsvp':
    case 'event_details':
    case 'your_photos':
      return null;
  }
}
