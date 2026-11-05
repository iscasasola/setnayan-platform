'use client';

import { useState, type ReactNode } from 'react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '../../guests/_components/undo-toast';
import { deleteScheduleBlock } from '../actions';

/**
 * 👈 A BLOCK'S DELETE IS ITS SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO
 * VISIBLE ✕ ON ROWS"). The block list's card (`BlockCard`, schedule/page.tsx) carried a small trash button at its foot
 * (a `<form action={deleteScheduleBlock}>`); now the card is wrapped in THE ONE SWIPE
 * (`app/_components/swipe-to-delete.tsx`) and the delete waits out the Undo window (`deleteWithUndo`): the card goes at
 * once, Undo brings it back with nothing written, a refusal brings it back and says so. Same write, same FormData
 * (`event_id` · `block_id`) — its children still go with it (ON DELETE CASCADE) and its suppliers are still told.
 */
export function BlockSwipe({ eventId, blockId, label, children }: { eventId: string; blockId: string; label: string; children: ReactNode }) {
  const [gone, setGone] = useState(false);
  if (gone) return <div hidden data-swipe-gone="" />;
  return (
    <>
      <UndoToastHost />
      <SwipeToDelete
        label={`Delete ${label}`}
        /* The card is `.sn-row` — opaque in both themes, its own corners — so the front adds no ground of its own and
           the clip takes the card's radius (the Delete behind it never shows at a corner). */
        surfaceClass=""
        radiusClass="rounded-[var(--m-r-md)]"
        onDelete={() =>
          deleteWithUndo({
            label: `“${label}” deleted`,
            hide: () => setGone(true),
            restore: () => setGone(false),
            commit: () => {
              const fd = new FormData();
              fd.set('event_id', eventId);
              fd.set('block_id', blockId);
              return deleteScheduleBlock(fd);
            },
            failed: `Couldn’t delete “${label}”. It’s back — try again.`,
          })
        }
      >
        {children}
      </SwipeToDelete>
    </>
  );
}
