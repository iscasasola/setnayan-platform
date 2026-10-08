'use client';

import type { ReactNode } from 'react';
import { GuestRemovalActionsContext, type GuestRemovalActions } from '@/app/dashboard/[eventId]/guests/_components/guest-delete';
import { LAB_GUEST_ACTIONS } from './lab-stand-ins';
import { GuestActionsProvider } from '@/app/dashboard/[eventId]/guests/_components/guest-actions-context';

/**
 * The lab's stand-ins for the guest list's writes: they succeed LOCALLY — the row hides, the Undo toast shows, Undo brings
 * it back, a quick add answers with the guest it was given — and NEVER reach the database. A lab press must not be able to
 * reach production data (controller, 2026-10-09: the lab's Delete had called the real action).
 *
 *   · the removal's two writes (`GuestRemovalActionsContext`) — `?refuse=1` makes the delete refuse with a RAW-LOOKING
 *     string, on purpose, so `a-host-never-reads-database-words.test.ts` can prove it never reaches the screen;
 *   · every other write a plain press reaches on the Guests screen (`GuestActionsProvider`): Set… ▾ (bulk), New group, the
 *     + sheet's name box, Quick add (guest · group · role), Add from your people (read + add), Mark as sent.
 *
 * NOT stubbed here (still real): the Setup view's own writes (RSVP asks · reply-by · get-in · finalize · pax — they ride the
 * Maker's save and `hubDraftAction`), the guest CARD (autosave `updateGuest`, release claim, invite by e-mail — the card is a
 * route the lab does not draw) and the one-by-one run (`SendInviteActions`, which the Maker's first load imports and so must
 * not pull this context in).
 */
export function LabGuestActions({ refuse = false, children }: { refuse?: boolean; children: ReactNode }) {
  const stand: GuestRemovalActions = {
    bulkSoftDeleteGuestsForUndo: async (_eventId, ids) =>
      refuse
        ? { ok: false, error: 'invalid input syntax for type uuid (the lab refuses this on purpose)' }
        : { ok: true, removedIds: [...ids], releasedSeats: [] },
    restoreDeletedGuests: async () => ({ ok: true }),
  };
  return (
    <GuestRemovalActionsContext.Provider value={stand}>
      <GuestActionsProvider actions={LAB_GUEST_ACTIONS}>{children}</GuestActionsProvider>
    </GuestRemovalActionsContext.Provider>
  );
}
