'use client';

import { useState, type ReactNode } from 'react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { deleteWorkingNoteAction } from '../actions';

/**
 * 👈 YOUR NOTE'S DELETE IS ITS SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO
 * VISIBLE ✕ ON ROWS"). A note in a supplier's working folder carried a small trash form ("Remove your note"); now the
 * note is wrapped in THE ONE SWIPE and the delete waits out the Undo window (`deleteWithUndo`). Same write, same
 * FormData (`event_id` · `vendor_id` · `note_id`); only the note's author gets it (`canDeleteWorkingNote`, the page).
 */
export function WorkingNoteSwipe({
  eventId,
  vendorId,
  noteId,
  className,
  children,
}: {
  eventId: string;
  vendorId: string;
  noteId: string;
  /** The note card's own ground and corners (it is opaque-ish; the swipe's front takes the page's cream under it). */
  className: string;
  children: ReactNode;
}) {
  const [gone, setGone] = useState(false);
  if (gone) return <li hidden data-swipe-gone="" />;
  return (
    <>
      <UndoToastHost />
      <SwipeToDelete
        as="li"
        label="Remove your note"
        word="Remove"
        radiusClass="rounded-lg"
        onDelete={() =>
          deleteWithUndo({
            label: 'Your note was removed',
            hide: () => setGone(true),
            restore: () => setGone(false),
            commit: () => {
              const fd = new FormData();
              fd.set('event_id', eventId);
              fd.set('vendor_id', vendorId);
              fd.set('note_id', noteId);
              return deleteWorkingNoteAction(fd);
            },
            failed: 'Couldn’t remove your note. It’s back — try again.',
          })
        }
      >
        <div className={className}>{children}</div>
      </SwipeToDelete>
    </>
  );
}
