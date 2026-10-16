'use client';

/**
 * guest-list-copy.ts — 📋 THE GUEST LIST KEPT ON THE PHONE (owner 2026-10-16: *"wouldnt it be better for
 * someone to just have a excel file for their guests that loads fast instead of always waiting for that
 * 2.5 sec load everytime?"*).
 *
 * The SAME last-seen store the five host pages already use (`lib/last-seen/store.ts`, DECISION_LOG
 * "LAST-SEEN DATA SHOWS INSTANTLY, THEN REFRESHES"), keyed by account + event + page, wiped at sign-out and
 * whenever another account opens the phone. What changes for the Guest list is WHAT is kept: not a picture
 * of the page (inert html) but the rows its own screen draws (`lib/guest-list-rows.ts`
 * `GUEST_COPY_ROW_FIELDS`), so the next open draws the REAL list at once — scroll, fold, search — under
 * "Showing your last copy · updating…", and the fresh list replaces it moments later.
 *
 * Both halves load the store LAZILY, through the one `import()` the five pages already share
 * (`@/lib/last-seen/client`) — never a new `import()` target (each one is an entry in the webpack runtime
 * every page downloads; the shared bundle has ~0.3 KB of room).
 *
 *   · `useKeepGuestList` — the fresh, MEASURED list keeps itself on idle, and again whenever it changes
 *     (an add, a removal, an RSVP — each server action revalidates the page, so the copy follows the
 *     list). A refused read is never kept.
 *   · `useKeptGuestList` — reads it back for this account + event, on the list's own address only.
 */

import { useEffect, useState } from 'react';
import { useLastSeenScope } from '@/app/_components/last-seen/last-seen-scope';
import { lastSeenPath } from '@/app/_components/last-seen/last-seen-mark';
import { guestListCopyOf, guestListFromCopy, type GuestListFromCopy, type GuestListRow } from '@/lib/guest-list-rows';
import type { RoleNames } from '@/lib/role-names';

/** Where the list on screen came from, when it is NOT the fresh list. */
export type GuestsCopyState = {
  /** `updating`: the fresh list is on its way · `failed`: it did not come (or the read was refused). */
  phase: 'updating' | 'failed';
  savedAt: number;
};

export type KeptGuestList = { list: GuestListFromCopy; savedAt: number };

/** Only the list as it opens from the menu — a filtered or deep-linked view is a different screen. */
function onListAddress(eventId: string): boolean {
  return window.location.pathname === lastSeenPath(eventId, 'guests') && !window.location.search;
}

/**
 * The kept list for the signed-in host and this event — `null` while reading, when there is none, or when
 * `when` is false. Another account's copy is never returned (the store wipes itself instead).
 */
export function useKeptGuestList(when: boolean): KeptGuestList | null {
  const scope = useLastSeenScope();
  const [kept, setKept] = useState<KeptGuestList | null>(null);
  useEffect(() => {
    if (!when || !scope) return;
    if (!onListAddress(scope.eventId)) return;
    let live = true;
    void import('@/lib/last-seen/client')
      .then(({ deviceStorage, readLastSeenData }) => {
        if (!live) return;
        const hit = readLastSeenData(deviceStorage(), {
          userId: scope.userId,
          eventId: scope.eventId,
          page: 'guests',
          url: lastSeenPath(scope.eventId, 'guests'),
        });
        const list = hit ? guestListFromCopy(hit.data, hit.savedAt) : null;
        if (hit && list) setKept({ list, savedAt: hit.savedAt });
      })
      .catch(() => {
        /* the store could not load — the screen stays as it is */
      });
    return () => {
      live = false;
    };
  }, [when, scope]);
  return when ? kept : null;
}

export type KeepInput = {
  guests: readonly GuestListRow[];
  hasSides: boolean;
  groupsByGuest: Record<string, string[]>;
  tableByGuest: Record<string, string>;
  faceByGuest: Record<string, string>;
  requests: number;
  rootLabel: string;
  roleNames: RoleNames;
};

/**
 * Keeps the list on the phone once the screen has settled (1.2 s with no change, then an idle moment) and
 * again after every change. `enabled` is false for anything that is not the fresh, measured List at its own
 * address — a copy on screen, a refused read, the Map, a search or Select arriving from a link.
 */
export function useKeepGuestList(input: KeepInput, enabled: boolean): void {
  const scope = useLastSeenScope();
  const { guests, hasSides, groupsByGuest, tableByGuest, faceByGuest, requests, rootLabel, roleNames } = input;
  useEffect(() => {
    if (!enabled || !scope) return;
    let alive = true;
    const take = () => {
      if (!alive || !onListAddress(scope.eventId)) return;
      void import('@/lib/last-seen/client')
        .then(({ deviceStorage, saveLastSeenData }) => {
          if (!alive || !onListAddress(scope.eventId)) return;
          saveLastSeenData(deviceStorage(), {
            userId: scope.userId,
            eventId: scope.eventId,
            page: 'guests',
            url: lastSeenPath(scope.eventId, 'guests'),
            data: guestListCopyOf({ guests, hasSides, groupsByGuest, tableByGuest, faceByGuest, requests, rootLabel, roleNames }),
          });
        })
        .catch(() => {
          /* nothing kept this time; the next change tries again */
        });
    };
    const timer = window.setTimeout(() => {
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      if (w.requestIdleCallback) w.requestIdleCallback(take, { timeout: 3000 });
      else take();
    }, 1200);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [enabled, scope, guests, hasSides, groupsByGuest, tableByGuest, faceByGuest, requests, rootLabel, roleNames]);
}
