'use client';

import { useState } from 'react';
import Image from 'next/image';
import { eventTypePlaceholderGradient } from '../../(account)/create-event/_components/event-types';

/**
 * EventScene — the per-event-type hero band behind an EVENTS card
 * (prototype `User_Home_REDESIGN_2026-07-30.html` → `events()` `.top .scene`;
 * owner: "we want a better card for events… let them get to imagine what the
 * events are").
 *
 * It renders the SAME hero the create-event picker already uses, in the SAME
 * precedence: the admin-uploaded `hero_photo_url` from `event_type_vocab`, else
 * the repo asset `/event-types/<key>.webp`, else — when neither exists (e.g.
 * `date`, `hangout`, or any freshly admin-created type) — the deterministic
 * branded gradient `eventTypePlaceholderGradient(key)`. Never a stand-in photo
 * of somebody else's event type.
 *
 * The gradient is painted UNDER the photo rather than instead of it, so a 404
 * (`onError`) reveals an on-brand tile with no layout shift and no flash — the
 * same client-side fallback idiom as `event-type-carousel.tsx`, which is why
 * this is a client island: `onError` has no server equivalent.
 *
 * Purely decorative (`aria-hidden`): every fact the band carries — type badge,
 * name, place — is rendered as real text by the card on top of it.
 */
export function EventScene({
  eventType,
  photoSrc,
  /** Dim the whole band for a finished event, matching the card's opacity. */
  muted = false,
}: {
  eventType: string;
  /** Resolved hero: admin upload → repo asset. Falls back to the gradient. */
  photoSrc: string;
  muted?: boolean;
}) {
  const [noPhoto, setNoPhoto] = useState(false);

  return (
    <span
      aria-hidden
      className="absolute inset-0 block overflow-hidden"
      style={{ background: eventTypePlaceholderGradient(eventType) }}
    >
      {noPhoto ? null : (
        <Image
          src={photoSrc}
          alt=""
          fill
          sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
          className={`object-cover transition-transform duration-500 group-hover:scale-[1.04] ${
            muted ? 'grayscale-[0.35]' : ''
          }`}
          onError={() => setNoPhoto(true)}
        />
      )}
      {/* Legibility scrim — dark at the bottom where the name sits, clearer at
          the top so the photo still reads as a photo. */}
      <span className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/45 to-ink/10" />
    </span>
  );
}
