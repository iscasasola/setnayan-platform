'use client';

/**
 * phone-column-channel.ts — the phone's "Show ▾" lives behind the title's ⋯.
 *
 * ⚖ The approved simple phone app, frame 2 (owner 2026-10-01, DECISION_LOG "THE
 * SIMPLE PHONE APP — APPROVED"): Sort · **Show ▾** · Import · Share … live behind
 * ⋯, never as a strip above the rows. The pick itself is E's (`useRosterColumns`,
 * remembered per device, owned by `GuestListMultiselect`); this only lets the ⋯
 * sheet — mounted in the page's title, far from the list — draw the SAME pick.
 *
 * A module-level store with one publisher (the list) and any number of readers,
 * the shape `undo-toast.tsx` already uses on this page. Null when no list is
 * mounted: the ⋯ then simply has no Show row.
 */

import { useSyncExternalStore } from 'react';
import type { RosterColumn } from '@/lib/roster-columns';

export type PhoneColumnState = {
  column: RosterColumn;
  available: readonly RosterColumn[];
  pick: (column: RosterColumn) => void;
} | null;

let current: PhoneColumnState = null;
const listeners = new Set<() => void>();

export function publishPhoneColumn(next: PhoneColumnState): void {
  current = next;
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function usePhoneColumn(): PhoneColumnState {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
