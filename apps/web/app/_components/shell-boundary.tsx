'use client';

/**
 * shell-boundary — WHERE THIS SURFACE STOPS BEING A PHONE.
 *
 * Owner 2026-10-19, DECISION_LOG "APPROVED — COUPLE DASHBOARD DESKTOP + TABLET
 * (AREA 2)": the couple's event dashboard becomes the desktop system at its
 * width from **701 px** — the rail's 72-px icon strip, no bottom bar, every
 * sheet the 440-px right panel. Prototype:
 * `prototypes/couple_dashboard_desktop_tablet_2026-10-19.html` (0f7e3858).
 *
 * 🔑 ONE ANSWER PER SURFACE, NOT ONE PER COMPONENT. The shell, the bottom dock
 * and the sheet must all answer "is this a phone?" with the same number, or a
 * tablet shows phone chrome under a desktop drawer (the 2026-08-28 defect
 * `sheet-agrees-with-the-nav.test.ts` exists for). So the boundary is decided
 * ONCE, by the tree that mounts the shell, and read here by everything inside.
 *
 *   'lg'  — 1024. The default. The front door and the admin console are NOT
 *           designed for 701–1023 yet, so they keep exactly what ships.
 *   'tab' — 701. The couple's event tree (`dashboard/[eventId]/layout.tsx`),
 *           the supplier dashboard (2026-10-23), and the launcher + account
 *           spokes (`dashboard/(launcher)` · `dashboard/(account)`, plan D5
 *           "Account/launcher onto the 701 line", owner-approved 2026-11-13).
 *           `the-tablet-band-is-the-strip.test.ts` holds the list.
 *
 * The stylesheet half of the same switch is `data-boundary="tab"` on `.fd`
 * (front-door.css, the 701–1023 band) — one attribute, written by the shell
 * from the same prop that feeds this context.
 */
import { createContext, useContext } from 'react';

export type ShellBoundary = 'lg' | 'tab';

const ShellBoundaryContext = createContext<ShellBoundary>('lg');

export const ShellBoundaryProvider = ShellBoundaryContext.Provider;

/** The width at which this surface's phone chrome gives way to the desktop system. */
export function useShellBoundary(): ShellBoundary {
  return useContext(ShellBoundaryContext);
}
