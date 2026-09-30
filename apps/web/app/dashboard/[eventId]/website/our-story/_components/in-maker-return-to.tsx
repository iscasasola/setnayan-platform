'use client';

import { useMaker } from '../../../launch/_components/maker-context';

/**
 * Inside the Event Hub Maker, a Love Story save lands back on Love Story's page
 * IN the Maker — not on the standalone scrapbook address (owner 2026-09-25: the
 * made-once items are pages in the Maker's body, never a trip away from it).
 *
 * Renders the `return_to` every draft door already honours
 * (`draftEventsAndReturn` → `resolveReturnTo`); outside the Maker it renders
 * nothing and the scrapbook keeps its own address.
 */
export function InMakerReturnTo() {
  const maker = useMaker();
  if (!maker) return null;
  return <input type="hidden" name="return_to" value={`/dashboard/${maker.eventId}/launch?tool=love-story`} />;
}

/**
 * ⚡ In the Event Hub Maker the scrapbook is the INSTANT one (`love-story-live.tsx`),
 * handed down by the Maker (`liveLoveStoryBook`, loaded with Details) and drawn
 * with the same props the page gives the server-drawn book; anywhere else — or
 * before the Maker has it — the page's own `LoveStoryBook` (`children`).
 */
export function InMakerLiveBook({ book, children }: { book: Record<string, unknown>; children: React.ReactNode }) {
  const Live = useMaker()?.liveLoveStoryBook;
  return Live ? <Live {...book} /> : <>{children}</>;
}
