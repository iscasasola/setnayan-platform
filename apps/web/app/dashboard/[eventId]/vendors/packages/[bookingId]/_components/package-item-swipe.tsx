'use client';

import { useState, type ReactNode } from 'react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { removeItemFromPackage } from '../../actions';

/**
 * 👈 AN ITEM OFF A BOOKED PACKAGE IS THE ROW'S SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST
 * ROW — NO VISIBLE ✕ ON ROWS"). The Included row carried a "Remove" form button; now the row is wrapped in THE ONE
 * SWIPE and the removal waits out the Undo window (`deleteWithUndo`) — the same `removeItemFromPackage` with the same
 * FormData (`event_id` · `booking_id` · `item_id`), so its refusals (a required line, a package not booked) and the
 * "Removed" section with its consumable credit are exactly as before. Undo inside the window writes nothing.
 */
export function PackageItemSwipe({
  eventId,
  bookingId,
  itemId,
  name,
  className,
  children,
}: {
  eventId: string;
  bookingId: string;
  itemId: string;
  /** What the row is — "Bridal bouquet" — for the button's name and the toast. */
  name: string;
  /** The row's own ground, border and corners. */
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
        label={`Remove ${name}`}
        word="Remove"
        radiusClass="rounded-lg"
        onDelete={() =>
          deleteWithUndo({
            label: `“${name}” removed from the package`,
            hide: () => setGone(true),
            restore: () => setGone(false),
            commit: () => {
              const fd = new FormData();
              fd.set('event_id', eventId);
              fd.set('booking_id', bookingId);
              fd.set('item_id', itemId);
              return removeItemFromPackage(fd);
            },
            failed: `Couldn’t remove “${name}”. It’s back — try again.`,
          })
        }
      >
        <div className={className}>{children}</div>
      </SwipeToDelete>
    </>
  );
}
