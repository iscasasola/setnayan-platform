'use client';

/**
 * minute-media.tsx — the photographs and the living moments of ONE minute.
 *
 * 🔑 IT REUSES THE SHIPPED CLIP PLAYER, IT DOES NOT WRITE A SECOND ONE.
 * `living-moments.tsx` already owns the rules that make a page of autoplaying
 * clips bearable: at most three playing at once, at most ONE audible, play only
 * while half in view, and a poster with no autoplay when motion is unwelcome.
 * Those rules are enforced in a MODULE-LEVEL registry — a second player would
 * not share it, so two independent "only one audible" implementations would
 * talk over each other on the same page.
 */

import { type ReactElement } from 'react';
import { ClipFrame, useReducedMotion } from '../editorial/living-moments';
import type { ChapterMedia } from '../editorial/data';

export function MinuteMedia({
  media,
  names,
}: {
  media: readonly ChapterMedia[];
  names: string;
}): ReactElement | null {
  const reducedMotion = useReducedMotion();
  if (media.length === 0) return null;

  // One / two / three across, the way the prototype lays a minute's media out:
  // a single frame runs the column, two split it 3:2, three sit as thirds. On a
  // phone they stack, because three portrait frames at 130px each is a filmstrip
  // of thumbnails, not a photograph.
  const cols =
    media.length >= 3
      ? 'grid-cols-1 sm:grid-cols-3'
      : media.length === 2
        ? 'grid-cols-1 sm:grid-cols-[1.5fr_1fr]'
        : 'grid-cols-1';

  return (
    <div className={`mt-4 grid gap-2 ${cols}`}>
      {media.slice(0, 3).map((m, i) =>
        m.type === 'clip' ? (
          <ClipFrame
            key={`${m.id ?? m.url}-${i}`}
            media={m}
            names={names}
            reducedMotion={reducedMotion}
            className="overflow-hidden rounded-md"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${m.id ?? m.url}-${i}`}
            src={m.url}
            alt=""
            loading="lazy"
            decoding="async"
            className="aspect-[4/5] w-full rounded-md object-cover sm:aspect-[16/10]"
          />
        ),
      )}
    </div>
  );
}
