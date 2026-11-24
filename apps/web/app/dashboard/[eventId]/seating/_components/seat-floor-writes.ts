'use client';

import { createContext, useContext } from 'react';

/**
 * 🧪 THE FLOOR'S WRITES, AS THE LAB STANDS THEM IN (the Guests lab's own way — `GuestActionsContext`,
 * `app/dev/guests-lab/the-lab-cannot-reach-the-database.test.ts`). The seat-plan floor's first steps — make a table,
 * seat everyone, take either back, shift a row — are four server actions. The app NEVER provides this context, so
 * production runs the shipped actions; the dev lab provides local stand-ins, so the whole add-a-table walk can be
 * tapped through on fixture data with no sign-in and no database.
 *
 * 🔒 the-empty-floor-starts-in-one-tap.test.ts holds that nothing under `app/dashboard` provides it.
 */
export type SeatFloorWrites = {
  createTable: (fd: FormData) => Promise<{ tableId: string | null }>;
  buildSeatingDraft: (fd: FormData) => Promise<{ tables: number; seated: number }>;
  deleteTable: (fd: FormData) => Promise<unknown>;
  updateTablePosition: (fd: FormData) => Promise<unknown>;
};

export const SeatFloorWritesContext = createContext<SeatFloorWrites | null>(null);

/** The stand-ins, in the lab; null in the app. */
export function useSeatFloorWrites(): SeatFloorWrites | null {
  return useContext(SeatFloorWritesContext);
}
