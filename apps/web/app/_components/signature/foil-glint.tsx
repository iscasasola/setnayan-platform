'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { armFoil, deviceStore, foilPlays } from '@/lib/signature-moments';
import { useMoment } from './use-moment';

/**
 * ② FOIL GLINT (motion standard § 9; prototype Part I "Foil glint") — one line of light crosses the event's monogram.
 * TWICE IN AN EVENT'S LIFE: when it is created (the first open after the create-event screen), and the morning of the
 * event day — each once on this device.
 * Reduced motion: no glint; the monogram simply shows. It wraps the mark it is given and adds nothing at rest.
 */
export function FoilGlint({ eventId, eventDate, shape = 'round', children }: { eventId: string; eventDate: string | null; shape?: 'round' | 'square'; children: ReactNode }) {
  const reason = useMoment(() => foilPlays(deviceStore('local'), deviceStore('session'), eventId, { eventDate, now: new Date() }));
  return (
    <FoilStage play={reason !== null} shape={shape}>
      {children}
    </FoilStage>
  );
}

/**
 * Mounted on the create-event screen: marks this visit as "an event is being created", so the event the couple lands
 * on next glints once (`foilPlays`). Renders nothing; writes only to this tab's session storage.
 */
export function FoilArm() {
  useEffect(() => armFoil(deviceStore('session')), []);
  return null;
}

export function FoilStage({ play, shape = 'round', children }: { play: boolean; shape?: 'round' | 'square'; children: ReactNode }) {
  return (
    <span className="sn-sig sn-sig-foil" data-sig="foil" data-sig-shape={shape} data-sig-play={play ? '' : undefined}>
      {children}
      {play ? <i className="sn-sig-foil-light" aria-hidden /> : null}
    </span>
  );
}
