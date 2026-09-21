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
  /**
   * ⚖ Owner 2026-09-21, on select-all: *"there are so many that showed. do not
   * show this when we click on the select all. just put a check."* True when
   * the selection STARTED from select-all — the bar then shows the count, not
   * a wall of name chips. It stays true while the host unticks a few (78 chips
   * is the same wall), and resets when the selection empties.
   */
  viaAll: boolean;
};

let state: GuestSelectionState = {
  selectMode: false,
  ids: [],
  set: new Set(),
  viaAll: false,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

// Replace `state` with a fresh object so useSyncExternalStore sees a new
// reference and re-renders subscribers. `set` is rebuilt from `ids` for
// O(1) membership checks in row components.
function commit(next: { selectMode?: boolean; ids?: string[]; viaAll?: boolean }) {
  const ids = next.ids ?? state.ids;
  state = {
    selectMode: next.selectMode ?? state.selectMode,
    ids,
    set: new Set(ids),
    // An empty selection has no origin; the next pick decides again.
    viaAll: ids.length === 0 ? false : (next.viaAll ?? state.viaAll),
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
  /** Replace the ids, keeping where the selection came from (used to prune
   *  the selection after a delete). */
  setAll(ids: string[]) {
    commit({ ids: [...ids] });
  },
  /** The select-all checkbox: every guest in view, marked as select-all. */
  selectAllInView(ids: string[]) {
    commit({ ids: [...ids], viaAll: true });
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

/** The current selection, outside React — for tests and non-hook callers. */
export function readGuestSelection(): GuestSelectionState {
  return state;
}

export function useGuestSelection(): GuestSelectionState {
  // Server snapshot === client initial snapshot (empty, not in select mode)
  // so there's no hydration mismatch — selection is a pure client concern.
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
