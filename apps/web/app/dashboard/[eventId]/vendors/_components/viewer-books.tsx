'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * 🔒 DOES THIS VIEWER BOOK AND PAY? (owner 2026-11-21, *"no booking, no paying"* — DECISION_LOG "BOOKED COORDINATOR ON
 * BUILD: FIND + RECOMMEND + SHORTLIST, NO BOOKING, NO PAYING"). True for a host; false for the booked coordinator (and
 * any helper). The Suppliers page sets it from `fetchEventViewer` (`isCouple`); a card under it drops its Book and Pay
 * buttons. This is the SCREEN half — the server half is `coordinatorMoneyScopeAllowed` in every book and pay action,
 * which refuses a non-host whatever the screen drew.
 *
 * Default TRUE, so every card drawn outside the Suppliers page (labs, the hosts' own sheets) is unchanged.
 */
const ViewerBooksCtx = createContext<boolean>(true);

export function ViewerBooksProvider({ books, children }: { books: boolean; children: ReactNode }) {
  return <ViewerBooksCtx.Provider value={books}>{children}</ViewerBooksCtx.Provider>;
}

export function useViewerBooks(): boolean {
  return useContext(ViewerBooksCtx);
}

/** The verbs only a host has — never drawn for the coordinator. */
export const HOST_ONLY_VERBS: ReadonlySet<string> = new Set(['book', 'pay']);
