'use client';

import { useCallback, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * 🪑 THE SEAT PLAN'S THREE PARTS MEET HERE (DECISION_LOG 2026-09-28 "THE SEAT
 * PLAN MOVES INTO DETAILS AND WEARS THE THREE COLUMNS"). The seating editor is
 * ONE component with ONE state — its plan fills Details' middle, and it draws
 * its own lists into the two other columns: the place's elements into the
 * navigator (`place`) and the guests into the right column (`guests`).
 *
 * Why not part 3's `InSlot`: it finds its target once, by id, when it mounts.
 * The navigator draws an item's pieces only while that item is picked, so the
 * `place` slot is a NEW element every time the couple comes back to Seat plan —
 * a target found once would be a detached node the second time. This store
 * follows the slot element itself (a callback ref), so the editor always draws
 * into the one that is on the page, and draws nothing while none is.
 */
export type SeatPlanSlotName = 'place' | 'guests';

const slots = new Map<SeatPlanSlotName, HTMLElement>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** A column's slot — rendered by Details (`maker-details.tsx`) where that column is. */
export function SeatPlanSlot({ name, className = '' }: { name: SeatPlanSlotName; className?: string }) {
  /* React 19's callback-ref cleanup: the slot leaves the store with the very
     element it put there (a newer slot of the same name is never evicted). */
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      slots.set(name, el);
      notify();
      return () => {
        if (slots.get(name) === el) {
          slots.delete(name);
          notify();
        }
      };
    },
    [name],
  );
  return <div ref={ref} data-seat-plan-slot={name} className={className} />;
}

export function useSeatPlanSlot(name: SeatPlanSlotName, on: boolean): HTMLElement | null {
  return useSyncExternalStore(
    subscribe,
    () => (on ? slots.get(name) ?? null : null),
    () => null,
  );
}

/** Draw `children` into a column's slot — nothing while that column is not on the page. */
export function SeatPlanPortal({ name, on, children }: { name: SeatPlanSlotName; on: boolean; children: ReactNode }) {
  const el = useSeatPlanSlot(name, on);
  return el ? createPortal(children, el) : null;
}
