'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { removeSponsor } from '../actions';

/**
 * 👈 A SPONSOR'S REMOVE IS THE CARD'S SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO
 * VISIBLE ✕ ON ROWS"). The card carried a small trash form (`<form action={removeSponsor}>`); now the card is wrapped in
 * THE ONE SWIPE and the removal waits out the Undo window (`deleteWithUndo`) — the same `removeSponsor`, the same
 * FormData (`event_id` · `sponsor_id`). Removing takes the sponsor's invitation and answer with it, which is exactly why
 * it keeps an Undo. The action answers by redirecting (`?removed=1` → "Sponsor removed." · `?error=…`); a refused
 * remove lands on `?error=…`, and the card is drawn again.
 */
export function SponsorSwipe({
  eventId,
  sponsorId,
  name,
  children,
}: {
  eventId: string;
  sponsorId: string;
  name: string;
  children: ReactNode;
}) {
  const [gone, setGone] = useState(false);
  /* A refused remove redirects to `?error=…` (the page's banner says why): the card comes back with it. */
  const refused = useSearchParams()?.get('error') ?? null;
  useEffect(() => {
    if (refused) setGone(false);
  }, [refused]);
  if (gone) return <div hidden data-swipe-gone="" />;
  return (
    <>
      <UndoToastHost />
      <SwipeToDelete
        label={`Remove ${name}`}
        word="Remove"
        /* The card is `.sn-row` — opaque in both themes, its own corners. */
        surfaceClass=""
        radiusClass="rounded-[var(--m-r-md)]"
        onDelete={() =>
          deleteWithUndo({
            label: `${name} removed`,
            hide: () => setGone(true),
            restore: () => setGone(false),
            commit: () => {
              const fd = new FormData();
              fd.set('event_id', eventId);
              fd.set('sponsor_id', sponsorId);
              return removeSponsor(fd);
            },
            failed: `Couldn’t remove ${name}. They’re back — try again.`,
          })
        }
      >
        {children}
      </SwipeToDelete>
    </>
  );
}
