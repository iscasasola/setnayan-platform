'use client';

/**
 * A snippet on an arranged sheet. It plays through the SHIPPED clip player — the same one the
 * day's minutes use (`minute-media.tsx`) — because the page-wide rules (at most three playing, at
 * most one audible, still frames when motion is unwelcome) live in that player's module registry,
 * and a second player would not share it.
 */

import { type ReactElement } from 'react';
import { ClipFrame, useReducedMotion } from '../editorial/living-moments';

export function SheetClip({
  src,
  posterUrl,
  id,
  names,
}: {
  src: string;
  posterUrl: string | null;
  id: string;
  names: string;
}): ReactElement {
  const reducedMotion = useReducedMotion();
  return (
    <ClipFrame
      media={{ type: 'clip', url: src, posterUrl, id }}
      names={names}
      reducedMotion={reducedMotion}
      className="h-full"
    />
  );
}
