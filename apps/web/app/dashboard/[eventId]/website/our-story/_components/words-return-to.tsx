'use client';

import { useMaker } from '../../../launch/_components/maker-context';

/**
 * Where a save of the Love Story words lands: back in the Event Hub Maker when
 * it was made there (Details › Love Story, or the story tapped on a stage), else
 * the Story row it was made in — so a save never moves the couple off the page
 * they were writing on.
 * Same `return_to` every draft door honours (`resolveReturnTo`).
 */
export function WordsReturnTo({ eventId }: { eventId: string }) {
  /* 📦 Inside the Maker these words are Details › Love Story's editor (and a
     tapped story's, on a stage) — a save always lands back in the Maker, which
     then keeps the couple exactly where they are (`maker-stay.ts`). */
  const inMaker = Boolean(useMaker());
  return (
    <input
      type="hidden"
      name="return_to"
      value={inMaker ? `/dashboard/${eventId}/launch?tool=love-story` : `/dashboard/${eventId}/website/editor?open=story`}
    />
  );
}
