/**
 * The lab's stand-ins for the Booked body (`/dev/suppliers-lab` has no session
 * and no database): when a function is given here the body calls it INSTEAD of
 * the server action. The real page provides nothing, so every verb goes to its
 * shipped action. Its own file so the row and the Pay sheet can both read it.
 */
import { createContext } from 'react';
import type { LoadPaySheetResult } from '@/lib/pay-sheet';
import type { SelfAddedSupplierPrefill } from '../actions';
import type { SetWhereResult } from '@/lib/supplier-where';

export type BookedStandIns = {
  nudge?: (vendorId: string) => Promise<{ ok: boolean; message?: string }>;
  loadRecord?: (vendorId: string) => Promise<SelfAddedSupplierPrefill | null>;
  /** "Ask them" for a room size — the canned chat line. */
  askRoom?: (threadId: string) => Promise<void>;
  /** The Pay sheet's one request. */
  loadPay?: (vendorId: string) => Promise<LoadPaySheetResult>;
  /** 📍 Where — a tick in the Where dropdown (the lab answers in place of `set_supplier_where`). */
  setWhere?: (args: {
    eventId: string;
    vendorId: string;
    blockIds: string[];
    coveredGroup: string | null;
    coveredLabel: string | null;
  }) => Promise<SetWhereResult>;
  /** 🧮 "Who they count" — Done (the lab answers in place of `saveCountRule`). */
  saveRule?: (args: { eventId: string; serviceId: string; mode: string; keys: string[] }) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** The lab's day (Manila 'YYYY-MM-DD') — the Pay sheet's "Was due" reads the SAME day as the row beside it. */
  today?: string;
};
export const BookedStandInCtx = createContext<BookedStandIns>({});
