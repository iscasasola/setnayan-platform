/**
 * lib/mood-board-palette-set.ts — "DOES THE MOOD BOARD HAVE A PALETTE, AND WHOSE
 * IS IT?", the questions the theme pick, the hub draft and the colour resolver
 * all ask (owner 2026-10-05, DECISION_LOG "THE MOOD BOARD PALETTE IS THE
 * PRIORITY": *"If the mood board does not have a palette, use our original
 * theme and place it on the moodboard's palette"*).
 *
 * 🌱 A THEME-WRITTEN palette stays the theme's: picking another theme re-seeds
 * it, until the couple paints the board themselves — then it is theirs, and a
 * pick never touches it again (`boardIsTheCouples`).
 *
 * Its own small module, importing only the theme registry (which
 * `lib/hub-draft.ts` already imports): the draft rides in the Maker's
 * first-load bundle, and these answers must not bring the Mood Board's whole
 * vocabulary with them. `lib/theme-colours.ts` re-exports them.
 */
import { HUB_THEMES, INVITE_THEMES, type InviteTheme, type InviteThemeId } from '@/lib/invite-themes';

const HEX = /^#[0-9a-f]{6}$/i;

/** Every `#rrggbb` the board's role lists hold, upper-case, de-duplicated, in key order. */
export function boardSwatches(palette: unknown): string[] {
  if (!palette || typeof palette !== 'object' || Array.isArray(palette)) return [];
  const seen = new Set<string>();
  for (const v of Object.values(palette as Record<string, unknown>)) {
    if (Array.isArray(v)) for (const c of v) if (typeof c === 'string' && HEX.test(c)) seen.add(c.toUpperCase());
  }
  return [...seen];
}

/**
 * A palette holds a colour when any of its role lists holds a `#rrggbb` — an
 * empty object, NULL, or a board with only its room dressing / touched-role
 * bookkeeping is "no palette".
 */
export function paletteIsSet(palette: unknown): boolean {
  return boardSwatches(palette).length > 0;
}

/** The most colours a theme writes into an empty board — the board's five main colours. */
export const SEED_PALETTE_MAX = 5;

/** The colours a theme writes into an empty Mood Board — its five page colours. */
function seedHexes(t: InviteTheme): string[] {
  const p = t.palette;
  return [...new Set([p.canvas, p.surface, p.ink, p.accent, p.heading].map((h) => h.toUpperCase()))].slice(0, SEED_PALETTE_MAX);
}

/**
 * 🌱 A THEME'S COLOURS AS A MOOD BOARD PALETTE — what a pick writes when the
 * board is not the couple's. The five go into `reception` (the board's five
 * "main colours"), so the Mood Board shows them as the couple's majors and
 * every role derives from them as it would from any pick.
 */
export function themeSeedPalette(id: InviteThemeId): { reception: string[] } {
  return { reception: seedHexes(INVITE_THEMES[id]) };
}

/** A set of colours as one comparable key — order never matters. */
function colourSetKey(hexes: readonly string[]): string {
  return [...hexes].sort().join(',');
}

/** The theme whose seed this palette IS (the same colours, nothing else), or null. */
export function seededTheme(palette: unknown): InviteThemeId | null {
  const have = boardSwatches(palette);
  if (have.length === 0) return null;
  const key = colourSetKey(have);
  return HUB_THEMES.find((t) => colourSetKey(seedHexes(t)) === key)?.id ?? null;
}

/**
 * 🔒 THE COUPLE HAS PAINTED THE BOARD THEMSELVES — it has colours and they are
 * not a theme's seed. Only then is a pick forbidden to write it; an empty board
 * or a theme-written one is (re-)seeded by the next pick.
 */
export function boardIsTheCouples(palette: unknown): boolean {
  return paletteIsSet(palette) && seededTheme(palette) === null;
}

/**
 * The only palette the hub draft accepts: a REAL theme's seed
 * (`themeSeedPalette`, exactly — `{ reception: [#…] }`). Anything else —
 * another key, a non-hex, colours no theme writes — is refused (`undefined`);
 * the Mood Board page stays the only place a couple paints their own.
 */
export function sanitizeSeedPalette(raw: unknown): { reception: string[] } | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const keys = Object.keys(raw as Record<string, unknown>);
  if (keys.length !== 1 || keys[0] !== 'reception') return undefined;
  const list = (raw as { reception: unknown }).reception;
  if (!Array.isArray(list) || list.length === 0 || list.length > SEED_PALETTE_MAX) return undefined;
  if (!list.every((c) => typeof c === 'string' && HEX.test(c))) return undefined;
  const id = seededTheme({ reception: list });
  return id ? themeSeedPalette(id) : undefined;
}
