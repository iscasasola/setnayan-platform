'use client';

import { createPortal } from 'react-dom';
import { GoLive } from '@/app/_components/signature/go-live';
import { useEventCoverWords } from '../../_components/event-cover-words';
import { useHydrated } from '@/lib/use-hydrated';

/**
 * 🕯 GO LIVE in the Maker (motion standard § 9 ③): Apply answered "live" — the Event Hub's preview lifts, glows and gets
 * its "Live" chip, over the canvas, then leaves by itself (the shipped `sn-toast-fades`, as the "Live now" line does).
 * It never takes a tap. The first publish on this device plays the whole moment; after that only the chip.
 */
export function MakerGoLive({ eventId }: { eventId: string }) {
  const cover = useEventCoverWords();
  // The portal waits for hydration (🔒 lib/a-portal-waits-for-hydration.test.ts), so the first pass draws what the server drew.
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return createPortal(
    <div className="sn-sig-over sn-toast-fades" data-maker-go-live="">
      <GoLive eventId={eventId} name={cover?.words.name ?? 'Your Event Hub'} line={cover?.words.shortDate ?? null} />
    </div>,
    document.body,
  );
}
