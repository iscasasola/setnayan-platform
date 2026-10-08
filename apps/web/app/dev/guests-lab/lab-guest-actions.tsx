'use client';

import type { ReactNode } from 'react';
import { GuestRemovalActionsContext, type GuestRemovalActions } from '@/app/dashboard/[eventId]/guests/_components/guest-delete';

/**
 * The lab's stand-ins for the removal's two writes (`bulkSoftDeleteGuestsForUndo`, `restoreDeletedGuests`): they
 * succeed LOCALLY — the row hides, the Undo toast shows, Undo brings the row back — and never reach the database.
 * A lab press must not be able to reach production data (controller, 2026-10-09: the lab's Delete had called the real
 * action). `?refuse=1` makes the stand-in refuse the way the real one does, so the red "Could not delete" toast and the
 * sheet returning to "Delete" can be seen too.
 */
export function LabGuestActions({ refuse = false, children }: { refuse?: boolean; children: ReactNode }) {
  const stand: GuestRemovalActions = {
    bulkSoftDeleteGuestsForUndo: async (_eventId, ids) =>
      refuse
        ? { ok: false, error: 'invalid input syntax for type uuid (the lab refuses this on purpose)' }
        : { ok: true, removedIds: [...ids], releasedSeats: [] },
    restoreDeletedGuests: async () => ({ ok: true }),
  };
  return <GuestRemovalActionsContext.Provider value={stand}>{children}</GuestRemovalActionsContext.Provider>;
}
