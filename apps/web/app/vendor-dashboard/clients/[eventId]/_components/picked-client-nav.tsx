'use client';

/**
 * 🗂 Switch the picked client's page from inside it (a ⚙ row, a "See the quote →" in Details) without a request —
 * the same `replaceState` switch the menu uses. Outside a `PickedClientShell` (the flag-off card) it is null and the
 * caller falls back to a plain link. The context itself is the ONE picked shell's (`app/_components/picked/picked-nav.ts`,
 * Supplier Build 3 · Lane A); this file narrows it to the client's page ids.
 */
import { useContext } from 'react';
import { PickedNavContext } from '@/app/_components/picked/picked-nav';
import type { PickedClientPage } from './picked-client-menu';

export { PickedNavContext };

export type PickedNav = { select: (page: PickedClientPage) => void; page: PickedClientPage };

export function usePickedNav(): PickedNav | null {
  return useContext(PickedNavContext) as PickedNav | null;
}
