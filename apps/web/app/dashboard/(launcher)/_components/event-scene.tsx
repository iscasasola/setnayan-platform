'use client';

import { useState } from 'react';
import Image from 'next/image';
import { eventTypePlaceholderGradient } from '../../(account)/create-event/_components/event-types';
import { eventCardTreatment } from '@/lib/event-card-art';

/**
 * EventScene — the hero band behind an EVENTS card
 * (prototype `User_Home_REDESIGN_2026-07-30.html` → `events()` `.top .scene`;
 * owner: "we want a better card for events… let them get to imagine what the
 * events are").
 *
 * PRECEDENCE, top of the list wins:
 *
 *   1. THE EVENT'S OWN HERO (`ownPhotoSrc`) — `events.landing_page_hero_image_url`,
 *      the couple's own guest-site photo, presigned on the server. When they
 *      have one it IS the card, untouched: no tint, no crop shift, no mirror.
 *      Nobody's own wedding photo gets a filter applied to it.
 *   2. THE TYPE STOCK PHOTO under a per-EVENT treatment. The admin-uploaded
 *      `hero_photo_url` from `event_type_vocab`, else the repo asset
 *      `/event-types/<key>.webp` — the SAME hero the create-event picker uses,
 *      in the same precedence.
 *   3. The deterministic branded gradient `eventTypePlaceholderGradient(key)`
 *      when neither exists (e.g. a freshly admin-created type). Never a
 *      stand-in photo of somebody else's event type.
 *
 * ⚠ WHY 2 CARRIES A TREATMENT AT ALL. The stock hero is per-TYPE, so before
 * 2026-08-01 every wedding on the platform rendered the identical photograph —
 * the owner opened his own phone and found two of his weddings showing the
 * same couple, the same fence, the same sky. `eventCardTreatment(event_id)`
 * gives each event its own framing (crop · mirror · zoom) and colour grade, so
 * the photo still says WEDDING while the two cards stop reading as duplicates.
 * The wash is painted UNDER the legibility scrim, never over it — see
 * lib/event-card-art.ts for the contrast proof the treatment is bounded by.
 *
 * The type gradient is painted UNDER everything rather than instead of it, so
 * a 404 (`onError`) reveals an on-brand tile with no layout shift and no
 * flash — the same client-side fallback idiom as `event-type-carousel.tsx`,
 * which is why this is a client island: `onError` has no server equivalent.
 *
 * Purely decorative (`aria-hidden`): every fact the band carries — type badge,
 * name, place — is rendered as real text by the card on top of it.
 */
export function EventScene({
  eventId,
  eventType,
  photoSrc,
  ownPhotoSrc = null,
  /** Dim the whole band for a finished event, matching the card's opacity. */
  muted = false,
}: {
  /** Drives the per-event treatment. Stable → the card never reshuffles. */
  eventId: string;
  eventType: string;
  /** Resolved TYPE hero: admin upload → repo asset. Falls back to the gradient. */
  photoSrc: string;
  /**
   * The event's OWN hero, already presigned + guarded by the server. When set
   * it replaces the type photo outright and suppresses the treatment.
   */
  ownPhotoSrc?: string | null;
  muted?: boolean;
}) {
  const [ownFailed, setOwnFailed] = useState(false);
  const [typeFailed, setTypeFailed] = useState(false);

  const showOwn = !!ownPhotoSrc && !ownFailed;
  const art = eventCardTreatment(eventId);
  const dim = muted ? 'grayscale-[0.35]' : '';

  return (
    <span
      aria-hidden
      className="absolute inset-0 block overflow-hidden"
      style={{ background: eventTypePlaceholderGradient(eventType) }}
    >
      {showOwn ? (
        // A presigned R2 URL — a plain <img>, not next/image, because the
        // signing host is not in the next/image remotePatterns allowlist.
        // Same idiom as library/_components/editorials-tab.tsx.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ownPhotoSrc}
          alt=""
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] ${dim}`}
          onError={() => setOwnFailed(true)}
        />
      ) : typeFailed ? null : (
        // The mirror + zoom live on a WRAPPER, never on the image: the image
        // carries `group-hover:scale-[1.04]`, and a Tailwind scale utility
        // rewrites --tw-scale-x, so a mirror set there would flip back on
        // hover. Two elements' transforms compose instead of colliding.
        <span
          className="absolute inset-0 block"
          style={{ transform: art.photoTransform }}
        >
          <Image
            src={photoSrc}
            alt=""
            fill
            sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
            style={{ objectPosition: art.objectPosition }}
            className={`object-cover transition-transform duration-500 group-hover:scale-[1.04] ${dim}`}
            onError={() => setTypeFailed(true)}
          />
        </span>
      )}
      {/* The per-event colour grade. Only over the TYPE art — an event with its
          own photo needs no help telling itself apart, and tinting a couple's
          own hero would be vandalism. */}
      {showOwn ? null : (
        <span className="absolute inset-0 block" style={{ background: art.wash }} />
      )}
      {/* Legibility scrim — dark at the bottom where the name sits, clearer at
          the top so the photo still reads as a photo. ⚠ ALWAYS LAST: every
          contrast guarantee in lib/event-card-art.ts assumes the wash is
          beneath this, not above it. */}
      <span className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/45 to-ink/10" />
    </span>
  );
}
