'use client';

import { createContext, useContext } from 'react';
import type * as SeatingActions from '../actions';
import type { guestSeatView } from '../../guests/seat-view-actions';
import type { saveEntrance } from '../../studio/indoor-blueprint/actions';
import type { PlanTableShape } from '@/lib/seat-plan-engine';

/**
 * 🪑 THE SEAT PLAN'S WRITES, IN ONE PLACE (seat plan PR2, option B — DECISION_LOG d1fafcd5: the couple's editor is the
 * ONE seat-plan engine; a supplier's Spaces use it in a venue mode). Every save the editor makes comes from
 * `useSeatingWrites()` (`seating-writes.ts`): a venue host provides its own store that maps the same calls onto the
 * Spaces writes; an event provides none, so it runs the shipped server actions exactly as before. Nothing under
 * `app/dashboard` provides this context.
 *
 * Adds no server action: it only names the ones that exist (server actions are capped).
 * 🔒 the-seat-plan-is-one-editor.test.ts
 */
export const SEATING_STORE_ACTIONS = [
  'addSeatingConstraint',
  'assignGroup',
  'assignGuest',
  'swapSeats',
  'autoArrange',
  'buildSeatingDraft',
  'createTable',
  'deleteTable',
  'lockAndFill',
  'removeSeatingConstraint',
  'toggleSeatLock',
  'publishSeating',
  'unpublishSeating',
  'stampTableSigns',
  'saveBooths',
  'saveFloorPlan',
  'savePriorityOrder',
  'commitWeld',
  'saveSigns',
  'saveVenuePhotoVisibility',
  'seatRoleAtTable',
  'setGuestSeatingPriority',
  'setTableSeat',
  'unassignGuest',
  'linkTables',
  'unlinkTable',
  'updateTableLabel',
  'updateTablePosition',
  'updateTableRotation',
  'updateTableType',
  'swapTableOccupants',
  'setGhostBoothsEnabled',
] as const;

export type SeatingStore = Pick<typeof SeatingActions, (typeof SEATING_STORE_ACTIONS)[number]> & {
  guestSeatView: typeof guestSeatView;
  saveEntrance: typeof saveEntrance;
  /** 🏛 A venue's own table: its shape, its ONE chair count and its end chairs, saved together (Spaces `updateTable`).
   *  An event has no such call — its tables change shape through `updateTableType` and chairs through `setTableSeat`. */
  venueTable?: (row: { id: string; name: string; shape: PlanTableShape; chairs: number; ends: boolean }) => Promise<{ ok: boolean; error?: string }>;
};

/** Every write the editor makes, resolved once (a venue's store, else the event's action) — `venueTable` stays the
 *  store's own optional call. */
export type SeatingWrites = Omit<SeatingStore, 'venueTable'>;

/** Whose plan the one editor draws: an event's (the default) or a venue's own hall in Spaces. */
export type SeatingSource = { kind: 'event' } | { kind: 'venue'; spaceId: string; floorPlanOpen: boolean };

export const SeatingStoreContext = createContext<SeatingStore | null>(null);

/** A venue host's store, or null (an event: the editor uses its shipped actions). */
export function useSeatingStore(): SeatingStore | null {
  return useContext(SeatingStoreContext);
}
