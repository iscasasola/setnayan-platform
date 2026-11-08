'use client';

/**
 * 🗂 Switch a picked page from inside it (a ⚙ row, a "See the quote →") without a request — the same `replaceState`
 * switch the menu uses. Provided by the ONE `PickedShell` (`./picked-shell.tsx`) on both sides; outside it the value is
 * null and the caller falls back to a plain link. Each side narrows the page ids (`picked-client-nav.tsx` on the
 * supplier's).
 */
import { createContext } from 'react';

export type PickedShellNav = { select: (page: string) => void; page: string };

export const PickedNavContext = createContext<PickedShellNav | null>(null);
