'use client';

import {
  addSeatingConstraint,
  assignGroup,
  assignGuest,
  swapSeats,
  autoArrange,
  buildSeatingDraft,
  createTable,
  deleteTable,
  lockAndFill,
  removeSeatingConstraint,
  toggleSeatLock,
  publishSeating,
  unpublishSeating,
  stampTableSigns,
  saveBooths,
  saveFloorPlan,
  savePriorityOrder,
  commitWeld,
  saveSigns,
  saveVenuePhotoVisibility,
  seatRoleAtTable,
  setGuestSeatingPriority,
  setTableSeat,
  unassignGuest,
  linkTables,
  unlinkTable,
  updateTableLabel,
  updateTablePosition,
  updateTableRotation,
  updateTableType,
  swapTableOccupants,
  setGhostBoothsEnabled,
} from '../actions';
import { guestSeatView } from '../../guests/seat-view-actions';
import { saveEntrance } from '../../studio/indoor-blueprint/actions';
import { useSeatingStore, type SeatingWrites } from './seating-store';

/**
 * 🪑 WHERE THE EDITOR'S WRITES GO: the ONE resolver. A venue host's store (`SeatingStoreContext`, Spaces) when there
 * is one, else an event's shipped server actions, exactly as before. The editor (and its Add table panel) take every
 * write from here by the call's own name, so the rule "store, else action" is written once, not once per call.
 *
 * Its own file, not `seating-store.ts`: Spaces imports the store eagerly, and only the (lazy) editor needs these.
 * Adds no server action: it only names the ones that exist (server actions are capped).
 * 🔒 the-seat-plan-is-one-editor.test.ts
 */
const EVENT_WRITES: SeatingWrites = {
  addSeatingConstraint,
  assignGroup,
  assignGuest,
  swapSeats,
  autoArrange,
  buildSeatingDraft,
  createTable,
  deleteTable,
  lockAndFill,
  removeSeatingConstraint,
  toggleSeatLock,
  publishSeating,
  unpublishSeating,
  stampTableSigns,
  saveBooths,
  saveFloorPlan,
  savePriorityOrder,
  commitWeld,
  saveSigns,
  saveVenuePhotoVisibility,
  seatRoleAtTable,
  setGuestSeatingPriority,
  setTableSeat,
  unassignGuest,
  linkTables,
  unlinkTable,
  updateTableLabel,
  updateTablePosition,
  updateTableRotation,
  updateTableType,
  swapTableOccupants,
  setGhostBoothsEnabled,
  guestSeatView,
  saveEntrance,
};

/** The editor's writes: the venue's store, or the event's actions. */
export function useSeatingWrites(): SeatingWrites {
  return useSeatingStore() ?? EVENT_WRITES;
}
