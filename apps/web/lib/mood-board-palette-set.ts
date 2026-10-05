/**
 * lib/mood-board-palette-set.ts — "DOES THE MOOD BOARD HAVE A PALETTE?", the one
 * question the theme pick, the hub draft and the colour resolver all ask
 * (owner 2026-10-05, DECISION_LOG "THE MOOD BOARD PALETTE IS THE PRIORITY":
 * *"If the mood board does not have a palette, use our original theme and place
 * it on the moodboard's palette"*).
 *
 * Its own tiny module, importing nothing: `lib/hub-draft.ts` rides in the
 * Maker's first-load bundle, and the answer must not bring the Mood Board's
 * whole vocabulary with it. `lib/theme-colours.ts` re-exports it.
 */

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * A palette holds a colour when any of its role lists holds a `#rrggbb` — an
 * empty object, NULL, or a board with only its room dressing / touched-role
 * bookkeeping is "no palette".
 */
export function paletteIsSet(palette: unknown): boolean {
  if (!palette || typeof palette !== 'object' || Array.isArray(palette)) return false;
  return Object.values(palette as Record<string, unknown>).some(
    (v) => Array.isArray(v) && v.some((c) => typeof c === 'string' && HEX.test(c)),
  );
}

/** The most colours a theme writes into an empty board — the board's five main colours. */
export const SEED_PALETTE_MAX = 5;

/**
 * The only palette the hub draft accepts: a theme's colours as the board's
 * main colours (`{ reception: [#…] }`, `themeSeedPalette`). Anything else —
 * another key, a non-hex, too many — is refused (`undefined`); the Mood Board
 * page stays the only place a couple paints their own.
 */
export function sanitizeSeedPalette(raw: unknown): { reception: string[] } | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const keys = Object.keys(raw as Record<string, unknown>);
  if (keys.length !== 1 || keys[0] !== 'reception') return undefined;
  const list = (raw as { reception: unknown }).reception;
  if (!Array.isArray(list) || list.length === 0 || list.length > SEED_PALETTE_MAX) return undefined;
  if (!list.every((c) => typeof c === 'string' && HEX.test(c))) return undefined;
  return { reception: (list as string[]).map((c) => c.toUpperCase()) };
}
