'use client';

import { useMaker } from '../../../launch/_components/maker-context';

/**
 * Where a save of the Love Story words lands: back on Love Story's PAGE when it
 * was made there (the Maker's Love Story tool), else the Story row it was made
 * in — so a save never moves the couple off the page they were writing on.
 * Same `return_to` every draft door honours (`resolveReturnTo`).
 */
export function WordsReturnTo({ eventId }: { eventId: string }) {
  const sel = useMaker()?.selection;
  const onPage = sel?.kind === 'tool' && sel.key === 'love-story';
  return (
    <input
      type="hidden"
      name="return_to"
      value={onPage ? `/dashboard/${eventId}/launch?tool=love-story` : `/dashboard/${eventId}/website/editor?open=story`}
    />
  );
}
