/**
 * lib/maker-theme-tiles.ts — the pure half of the Maker's theme picker
 * (`app/dashboard/[eventId]/launch/_components/maker-theme-picker.tsx`): which
 * tiles a couple is shown, how big a tile is, and which tile's frame loads
 * next. No I/O, no React — so the rules are tested as functions.
 */

export type ThemeTile = { id: string; name: string; tier: 'free' | 'pro' };

/** The width the page is drawn at inside a tile — a phone's. */
export const TILE_PAGE_W = 390;
/** One phone screen of it. */
export const TILE_PAGE_H = 760;
/** The tile on screen. */
export const TILE_W = 112;
export const TILE_SCALE = TILE_W / TILE_PAGE_W;
export const TILE_H = Math.round(TILE_PAGE_H * TILE_SCALE);
/** A tile that never reports `load` stops holding the queue after this long. */
export const TILE_GIVE_UP_MS = 12_000;

/** The themes this couple is shown — the store shell hides the locked doors. */
export function tilesShown(
  themes: readonly ThemeTile[],
  input: { ownsPro: boolean; storeShell: boolean; current: string },
): ThemeTile[] {
  return themes.filter(
    (t) => !input.storeShell || t.tier === 'free' || (input.ownsPro && t.id === input.current),
  );
}

/**
 * Which tile loads next: the first one, in the rail's order, that is in view
 * and has no frame yet — and none while another is still loading.
 */
export function nextTileToLoad(
  order: readonly string[],
  input: { inView: ReadonlySet<string>; mounted: readonly string[]; loading: string | null },
): string | null {
  if (input.loading) return null;
  return order.find((id) => input.inView.has(id) && !input.mounted.includes(id)) ?? null;
}

