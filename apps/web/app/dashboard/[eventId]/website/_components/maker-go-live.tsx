'use client';

import { createPortal } from 'react-dom';
import { GoLive } from '@/app/_components/signature/go-live';
import { useEventCoverWords } from '../../_components/home-loading-cover';

/**
 * 🕯 GO LIVE in the Maker (motion standard § 9 ③): Apply answered "live" — the Event Hub's preview lifts, glows and gets
 * its "Live" chip, over the canvas, then leaves by itself (the shipped `sn-toast-fades`, as the "Live now" line does).
 * It never takes a tap. The first publish on this device plays the whole moment; after that only the chip.
 */
export function MakerGoLive({ eventId }: { eventId: string }) {
  const cover = useEventCoverWords();
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="sn-sig-over sn-toast-fades" data-maker-go-live="">
      <GoLive eventId={eventId} name={cover?.words.name ?? 'Your Event Hub'} line={cover?.words.shortDate ?? null} />
    </div>,
    document.body,
  );
}
