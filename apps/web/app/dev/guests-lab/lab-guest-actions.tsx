'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { GuestRemovalActionsContext, type GuestRemovalActions } from '@/app/dashboard/[eventId]/guests/_components/guest-delete';
import { LAB_GUEST_ACTIONS, LAB_NAVIGATE_EVENT, LAB_SETUP_REFUSALS } from './lab-stand-ins';
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
 *   · Guests › Setup's three writes (2026-10-09): the asks and how guests get in (`hubDraftAction`, the Maker's draft door),
 *     Reply by (`updatePaxSettings`) and Finalize / Reopen (`setGuestListFinalized`); with `?refuse=1` they refuse with the
 *     DATABASE'S OWN WORDS, on purpose, so a guard can prove the host never reads them.
 *
 *   · the guest CARD (step 4A): its three forms post the lab's inline stand-ins (`page.tsx` → `GuestCardBody actions`) and its ⋯
 *     (New QR · Unlink) takes `releaseGuestClaim` from this context; with `?refuse=1` they refuse with the database's own words.
 *
 * NOT stubbed here (still real): the one-by-one run's `SendInviteActions` (its Mark as sent — `send-invite.tsx` is in the Maker's
 * first load and so must not pull this context in); the card's ticket picture and Save ticket (GET reads of
 * `/api/guest/pass-card`); Write to NFC (a browser API, no database); the card's Access line (a link to Event Details). The
 * Setup rows' two doors ("Send to N", "Pick who") are stand-ins too: they stay in the lab (`setupDoorHref`).
 */
export function LabGuestActions({ refuse = false, children }: { refuse?: boolean; children: ReactNode }) {
  /* A stand-in that must change what the page DRAWS (Finalize → the locked row) moves a search param the fixture reads, with
     `router.replace` — which refetches the page — never `replaceState` + `refresh()`, which Next does not follow. */
  const router = useRouter();
  const path = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    const go = (e: Event) => {
      const set = (e as CustomEvent<{ set: Record<string, string> }>).detail?.set ?? {};
      const next = new URLSearchParams(search.toString());
      for (const [k, v] of Object.entries(set)) next.set(k, v);
      router.replace(`${path}?${next.toString()}`, { scroll: false });
    };
    window.addEventListener(LAB_NAVIGATE_EVENT, go);
    return () => window.removeEventListener(LAB_NAVIGATE_EVENT, go);
  }, [router, path, search]);
  const stand: GuestRemovalActions = {
    bulkSoftDeleteGuestsForUndo: async (_eventId, ids) =>
      refuse
        ? { ok: false, error: 'invalid input syntax for type uuid (the lab refuses this on purpose)' }
        : { ok: true, removedIds: [...ids], releasedSeats: [] },
    restoreDeletedGuests: async () => ({ ok: true }),
  };
  return (
    <GuestRemovalActionsContext.Provider value={stand}>
      <GuestActionsProvider actions={refuse ? { ...LAB_GUEST_ACTIONS, ...LAB_SETUP_REFUSALS } : LAB_GUEST_ACTIONS}>{children}</GuestActionsProvider>
    </GuestRemovalActionsContext.Provider>
  );
}
