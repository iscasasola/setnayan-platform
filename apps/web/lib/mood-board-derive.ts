/**
 * The bridge between the palette-style engine (`lib/palette-styles.ts`) and
 * the app's `RolePalette` shape (`lib/mood-board.ts`) — what section 02
 * actually renders for one role, given the majors, the palette style and
 * which roles the couple has touched.
 *
 * 🛑 NO OUTSIDE TOP-UP. `deriveRole`/`deriveBoard` already guarantee every
 * derived role meets its own internal band constraints; this layer's ONLY
 * post-processing is `.slice(0, max)` — dropping trailing colors a role's
 * `PALETTE_LIMITS` doesn't allow. It must NEVER pad a short derived role up
 * toward its `min` by repeating a major. That padding is exactly what broke
 * the six-rank monotonic invariant in the old UI (see
 * `mood-board-derive-slice-path-preserves-rank-order.test.ts`) — the
 * verified engine already decided how many colors a role gets, and repeating
 * its Dominant color to hit a minimum can hand the loudest major to the
 * guests, above the bride. A derived role that honestly has fewer colors
 * than its `min` SHOWS fewer.
 */

import {
  DERIVABLE_PALETTE_KEYS,
  PALETTE_LIMITS,
  type PaletteKey,
  type RolePalette,
} from './mood-board';
import {
  deriveBoard,
  VISIBILITY_RANK,
  IN_RANK_INDEX,
  type Board,
  type PaletteStyle,
} from './palette-styles';

/**
 * `PaletteKey` (mood-board.ts) and `RoleKey` (palette-styles.ts) are declared
 * separately — one is the app's persisted-JSONB vocabulary, the other is the
 * engine's pure-math vocabulary — but hold the EXACT same 16 string
 * literals, verified by `mood-board-derive-role-key-parity.test.ts`. That
 * test is what makes it safe to index `VISIBILITY_RANK`/`Board` with a
 * `PaletteKey` directly below, with no cast and no runtime mapping table
 * that could silently drift from either source.
 */

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/** The couple's majors — `palette.reception`, filled slots only. Never
 *  null-padded: an unfilled slot simply isn't a major yet. */
export function effectiveMajors(palette: RolePalette): string[] {
  return (palette.reception ?? []).filter((h) => HEX_RE.test(h));
}

/**
 * The whole derived board for the couple's current majors + style, or
 * `null` when no major has been chosen yet — the engine is never asked to
 * fabricate a board from nothing (`normalizeMajors` throws on an empty
 * array by design; this guard is what keeps section 02 from ever hitting
 * that throw).
 */
export function derivedBoardFor(majors: readonly string[], style: PaletteStyle): Board | null {
  if (majors.length === 0) return null;
  return deriveBoard(majors, style);
}

/**
 * What one role's swatches actually show in 02, given the current touched
 * set. A touched role always shows the couple's own stored colors,
 * regardless of majors or style. `officiants` is never derived at all — it
 * always shows the couple's own colors (there is nothing to release it back
 * to). Everything else falls back to an honest empty array when no majors
 * are chosen yet.
 */
export function displayColorsFor(
  key: PaletteKey,
  palette: RolePalette,
  touched: ReadonlySet<PaletteKey>,
  derived: Board | null,
): string[] {
  const max = PALETTE_LIMITS[key].max;
  if (key === 'officiants' || key === 'reception' || touched.has(key)) {
    return (palette[key] ?? []).slice(0, max);
  }
  if (!derived) return [];
  const raw = derived[key];
  return (raw ?? []).slice(0, max);
}

/**
 * The six-rank visibility ladder's own order, read from `VISIBILITY_RANK` /
 * `IN_RANK_INDEX` — never a hand-authored copy. Couple → family → principal
 * sponsors (+ Nikah principals) → best man & maid of honor / bridesmaids /
 * groomsmen / wedding party → secondary sponsors & bearers → guests.
 * `officiants` (rank `null`) sorts last — it follows the church's own
 * calendar, not the ladder. Ties break on `IN_RANK_INDEX`, then key name for
 * a total, stable order.
 */
export function roleDisplayOrder(keys: readonly PaletteKey[]): PaletteKey[] {
  const rankOf = (k: PaletteKey): number => VISIBILITY_RANK[k] ?? Infinity;
  const indexOf = (k: PaletteKey): number => IN_RANK_INDEX[k] ?? 0;
  return [...keys].sort((a, b) => {
    const r = rankOf(a) - rankOf(b);
    if (r !== 0) return r;
    const i = indexOf(a) - indexOf(b);
    if (i !== 0) return i;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/** Every touchable role key, in six-rank display order — the "Roles" group
 *  in section 02, before visibility filtering. */
export const DERIVABLE_ROLES_IN_RANK_ORDER: ReadonlyArray<PaletteKey> = roleDisplayOrder(
  DERIVABLE_PALETTE_KEYS.filter((k) => k !== 'ceremony' && k !== 'bride' && k !== 'groom'),
);

/** True when the engine had to waive a rank's wearability gates — the
 *  board's honest "your colors sit very close in tone" note. */
export function boardReduced(board: Board | null): boolean {
  return (board?.__meta.reduced.length ?? 0) > 0;
}
