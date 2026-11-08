'use client';

/**
 * 🗂 Switch the picked client's page from inside it (a ⚙ row, a "See the quote →" in Details) without a request —
 * the same `replaceState` switch the menu uses. Outside a `PickedClientShell` (the flag-off card) it is null and the
 * caller falls back to a plain link.
 */
import { createContext, useContext } from 'react';
import type { PickedClientPage } from './picked-client-menu';

export type PickedNav = { select: (page: PickedClientPage) => void; page: PickedClientPage };

export const PickedNavContext = createContext<PickedNav | null>(null);

export function usePickedNav(): PickedNav | null {
  return useContext(PickedNavContext);
}
