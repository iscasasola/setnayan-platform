/**
 * The lab's stand-ins for the Booked body (`/dev/suppliers-lab` has no session
 * and no database): when a function is given here the body calls it INSTEAD of
 * the server action. The real page provides nothing, so every verb goes to its
 * shipped action. Its own file so the row and the Pay sheet can both read it.
 */
import { createContext } from 'react';
import type { LoadPaySheetResult } from '@/lib/pay-sheet';
import type { SelfAddedSupplierPrefill } from '../actions';

export type BookedStandIns = {
  nudge?: (vendorId: string) => Promise<{ ok: boolean; message?: string }>;
  loadRecord?: (vendorId: string) => Promise<SelfAddedSupplierPrefill | null>;
  /** "Ask them" for a room size — the canned chat line. */
  askRoom?: (threadId: string) => Promise<void>;
  /** The Pay sheet's one request. */
  loadPay?: (vendorId: string) => Promise<LoadPaySheetResult>;
};
export const BookedStandInCtx = createContext<BookedStandIns>({});
