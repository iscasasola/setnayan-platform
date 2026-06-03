'use client';

/**
 * Shared guest-selection store (iteration 0001, 2026-06-03).
 *
 * Owner directive 2026-06-03: the mobile "Customize" carousel panel becomes
 * a select-and-assign surface — tap "Select", checkboxes appear on each
 * guest, a select-all checkbox + live count surface in the carousel, and an
 * "Assign" button opens a bottom sheet (Side / Role / Group + create-new).
 *
 * The checkboxes live in `GuestListMultiselect` (the scrolling list) while
 * the count / select-all / Assign live in `MobileGuestCarousel` (the fixed
 * lower-third). Those are sibling components with no common React ancestor
 * we want to thread state through, so selection is a tiny module-level
 * external store both subscribe to via `useSyncExternalStore`. Desktop's
 * floating SelectionBar reads the same store, so all three surfaces stay in
 * lockstep with a single source of truth.
 *
 * `selectMode` gates whether the MOBILE cards show their checkbox (clean by
 * default; checkboxes appear only after "Select"). The desktop table keeps
 * its always-on checkbox column and ignores `selectMode`.
 */

import { useSyncExternalStore } from 'react';

export type GuestSelectionState = {
  selectMode: boolean;
  ids: string[];
  set: Set<string>;
};

let state: GuestSelectionState = {
  selectMode: false,
  ids: [],
  set: new Set(),
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

// Replace `state` with a fresh object so useSyncExternalStore sees a new
// reference and re-renders subscribers. `set` is rebuilt from `ids` for
// O(1) membership checks in row components.
function commit(next: { selectMode?: boolean; ids?: string[] }) {
  const ids = next.ids ?? state.ids;
  state = {
    selectMode: next.selectMode ?? state.selectMode,
    ids,
    set: new Set(ids),
  };
  emit();
}

export const guestSelection = {
  enter() {
    if (!state.selectMode) commit({ selectMode: true });
  },
  // Exit select mode AND drop the selection — the mobile "Done" affordance.
  exit() {
    commit({ selectMode: false, ids: [] });
  },
  toggle(id: string) {
    const ids = state.set.has(id)
      ? state.ids.filter((x) => x !== id)
      : [...state.ids, id];
    commit({ ids });
  },
  setAll(ids: string[]) {
    commit({ ids: [...ids] });
  },
  // Drop the selection but stay in select mode (desktop "Clear selection").
  clear() {
    commit({ ids: [] });
  },
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return state;
}

export function useGuestSelection(): GuestSelectionState {
  // Server snapshot === client initial snapshot (empty, not in select mode)
  // so there's no hydration mismatch — selection is a pure client concern.
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
