'use client';

/**
 * SuppliersModeContext — what a body of the one-screen Suppliers page may know
 * about the shell around it (`services-takeover.tsx`).
 *
 * The bodies are SLOTS: the server page renders them and the shell only places
 * them, so the shell cannot hand them props. A body that owns something
 * OUTSIDE its own box — Find's floating thumb row is drawn into <body> — still
 * has to know when it is the body on screen, and when the couple is leaving it:
 *
 *   mode     the body on screen. A body that is kept mounted but hidden must
 *            take its floating row down.
 *   leaving  true for the ~300 ms between asking for another body and the
 *            swap, so the row slides DOWN first (BUTTON_RULE rule 5).
 *   thumbUp  the row says whether it is up; the shell waits for the slide only
 *            when there is a row to wait for.
 *
 * Outside the shell (a test, any other mount) the default is "Find, on screen,
 * not leaving" — a body renders exactly as it would alone.
 */
import { createContext, useContext, type MutableRefObject } from 'react';
import type { SuppliersMode } from '@/lib/suppliers-shell';

export type SuppliersModeState = {
  mode: SuppliersMode;
  leaving: boolean;
  thumbUp: MutableRefObject<boolean>;
};

/** How long the thumb row takes to slide, up and down ("≈ 300 ms"). */
export const THUMB_SLIDE_MS = 300;

export const SuppliersModeContext = createContext<SuppliersModeState>({
  mode: 'find',
  leaving: false,
  thumbUp: { current: false },
});

export function useSuppliersMode(): SuppliersModeState {
  return useContext(SuppliersModeContext);
}

/**
 * 📌 THE ROW'S COUNT, SAID BY THE SCREEN THAT HOLDS THE NUMBERS (owner 2026-10-31: *"Booked has the 3 drop down Team,
 * Budget, and Schedule"*, one row). The shell's one row is `[Booked · Schedule ▾] · 7 moments · ⚙`; the count after
 * the ▾ belongs to the part on screen — the Booked body counts its team, the Budget page its money, the Schedule page
 * its moments — and each is a server-drawn page the shell only places. So the row hands down WHERE its count goes,
 * and the part's `BookedPartRow` draws its line there (`createPortal`). `claim` says a part is drawing it, so the
 * row's own count (the one it can count itself) steps aside rather than say it twice.
 *
 * Outside the shell (a test, any other mount) there is no row: `el` is null and nothing is drawn.
 */
export type SuppliersRowCount = { el: HTMLElement | null; claim: (on: boolean) => void };

export const SuppliersRowCountContext = createContext<SuppliersRowCount>({ el: null, claim: () => {} });

export function useSuppliersRowCount(): SuppliersRowCount {
  return useContext(SuppliersRowCountContext);
}
