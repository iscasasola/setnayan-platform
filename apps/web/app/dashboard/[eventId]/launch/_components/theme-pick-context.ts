'use client';

import { createContext, useContext } from 'react';

/**
 * The theme picker's ONE pick (`maker-theme-picker.tsx` `ThemePickProvider`),
 * in a module of its own so the page frames that wear it
 * (`details-look-pages.tsx`) pull in no draft action — nothing heavier than
 * React rides with them.
 */
export type ThemePick = {
  picked: string;
  pending: boolean;
  error: string | null;
  pick: (id: string) => void;
  /**
   * 🎨 The board the theme samples wear (`sampleBoardQuery`): `palette=none`
   * (each theme in its own colours), `board=<event>&bv=…` (the couple's own
   * board, read on the server for its host), or null where the provider was
   * not told (the sample's own board).
   */
  samplePalette: string | null;
};

export const ThemePickContext = createContext<ThemePick | null>(null);

/**
 * The theme being picked RIGHT NOW (the tap, before its save lands) — null
 * outside the picker's provider. The page behind the Look and the guided steps
 * wears it (`theme=`), so a pick shows at the tap (owner 2026-10-05: the
 * dropdown said Cyber Neon while the page still drew Classic).
 */
export function usePickedTheme(): string | null {
  return useContext(ThemePickContext)?.picked ?? null;
}
