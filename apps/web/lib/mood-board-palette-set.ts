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

/**
 * The colours a theme writes into an empty Mood Board — its page colours in the
 * board's FIVE MAIN SLOTS (`MAIN_SLOT`, lib/site-palette.ts — "THE 5 MAIN
 * COLOURS, ONE JOB EACH"): Dominant = its heading, Supporting = its surface,
 * Accent = its accent, Neutral = its canvas, Accent 2 = its muted. Positions are
 * kept (a repeated colour stays in both slots), so the board reads by slot.
 */
function seedHexes(t: InviteTheme): string[] {
  const p = t.palette;
  return [p.heading, p.surface, p.accent, p.canvas, p.muted].map((h) => h.toUpperCase()).slice(0, SEED_PALETTE_MAX);
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

/** The palette's colour lists (`#rrggbb` arrays), by key — its other keys (room dressing, bookkeeping) aside. */
function colourLists(palette: unknown): Record<string, string[]> {
  if (!palette || typeof palette !== 'object' || Array.isArray(palette)) return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(palette as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue;
    const hexes = v.filter((c): c is string => typeof c === 'string' && HEX.test(c));
    if (hexes.length > 0) out[k] = hexes.map((c) => c.toUpperCase());
  }
  return out;
}

/**
 * The theme whose COLOURS this palette is — its only colour list is the main
 * colours (`reception`), and they are exactly that theme's seed — or null.
 * Read for COLOUR: the board's other, non-colour keys do not change what it
 * paints. (Whether a pick may WRITE it is `boardIsTheCouples`, stricter.)
 */
export function seededTheme(palette: unknown): InviteThemeId | null {
  const lists = colourLists(palette);
  const keys = Object.keys(lists);
  if (keys.length !== 1 || keys[0] !== 'reception') return null;
  const key = colourSetKey(lists.reception!);
  return HUB_THEMES.find((t) => colourSetKey(seedHexes(t)) === key)?.id ?? null;
}

/**
 * 🌱 THEME-WRITTEN, STRUCTURALLY: the board is a non-empty `reception` equal to
 * a theme's seed and NOTHING else — no room dressing, no custom roles, no
 * touched roles, no other list. Only such a board is refilled by the next pick
 * (owner 2026-10-05: *"New theme refills them"*).
 */
export function themeWroteBoard(palette: unknown): boolean {
  if (!palette || typeof palette !== 'object' || Array.isArray(palette)) return false;
  const keys = Object.keys(palette as Record<string, unknown>);
  return keys.length === 1 && keys[0] === 'reception' && seededTheme(palette) !== null;
}

/**
 * 🔒 THE COUPLE MADE THIS BOARD — it has colours and it is not, structurally,
 * a theme's fill. A pick then never writes it: not overlaid, counted or applied.
 * An empty board or a theme-written one is (re-)filled by the next pick.
 */
export function boardIsTheCouples(palette: unknown): boolean {
  return paletteIsSet(palette) && !themeWroteBoard(palette);
}

/**
 * What a pick's fill makes of the board it lands on: the board AS IT IS, with
 * its main colours (`reception`) replaced by the theme's — never the column
 * replaced (an empty board's room dressing and bookkeeping are kept). Null when
 * the board is the couple's: then nothing is written.
 */
export function boardWithFill(board: unknown, seed: { reception: string[] }): Record<string, unknown> | null {
  if (boardIsTheCouples(board)) return null;
  const base = board && typeof board === 'object' && !Array.isArray(board) ? (board as Record<string, unknown>) : {};
  return { ...base, reception: [...seed.reception] };
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
