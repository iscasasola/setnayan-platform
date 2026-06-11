/**
 * apps/web/lib/live-wall-logic.ts
 *
 * Pure, environment-free logic for the Salamisim Live Photo Wall projection —
 * split from lib/live-wall.ts (server I/O) so the merge/reconcile/mode rules
 * are unit-testable with zero browser or Supabase dependencies.
 * Suite: scripts/test-live-wall.ts.
 */

export interface WallTile {
  feedId: string;
  url: string;
  widthPx: number | null;
  heightPx: number | null;
  sortAt: string; // ISO — the cursor
}

export type WallMode = 'coming_soon' | 'pre_event' | 'live' | 'recap' | 'archive';

/**
 * Merge incremental tiles into the existing list: dedupe by feedId (existing
 * object identity wins — keeps React keys stable), append in sort order.
 */
export function mergeTiles(existing: WallTile[], incoming: WallTile[]): WallTile[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((t) => t.feedId));
  const fresh = incoming.filter((t) => !seen.has(t.feedId));
  if (fresh.length === 0) return existing;
  return [...existing, ...fresh].sort((a, b) => a.sortAt.localeCompare(b.sortAt));
}

/**
 * Reconcile against a FULL visible set (the 60s sweep): drops retracted tiles,
 * adds anything missed, preserves object identity for unchanged tiles so the
 * collage doesn't re-animate. Returns the same array instance when nothing
 * changed (cheap React bail-out).
 */
export function reconcileTiles(
  existing: WallTile[],
  fullSet: WallTile[],
): { tiles: WallTile[]; removed: number; added: number } {
  const byId = new Map(existing.map((t) => [t.feedId, t]));
  const next = fullSet
    .map((t) => byId.get(t.feedId) ?? t)
    .sort((a, b) => a.sortAt.localeCompare(b.sortAt));
  const removed = existing.length - next.filter((t) => byId.has(t.feedId)).length;
  const added = next.filter((t) => !byId.has(t.feedId)).length;
  if (removed === 0 && added === 0 && next.length === existing.length) {
    return { tiles: existing, removed: 0, added: 0 };
  }
  return { tiles: next, removed, added };
}

/** The newest cursor across a tile list (or the fallback). */
export function latestCursor(tiles: WallTile[], fallback: string): string {
  let max = fallback;
  for (const t of tiles) if (t.sortAt > max) max = t.sortAt;
  return max;
}

/**
 * Resolve the wall's lifecycle mode: the couple's manual override always wins
 * (events.live_mode_override); otherwise map the shipped 4-phase day-of
 * helper onto the wall's vocabulary. The 5-mode T-7d split (coming_soon vs
 * pre_event) arrives with the 0031 machine — until then 'pre' reads as
 * pre_event and 'inactive' as coming_soon.
 */
export function resolveWallMode(
  override: WallMode | null | undefined,
  dayOfPhase: 'pre' | 'live' | 'post' | 'inactive',
): WallMode {
  if (override) return override;
  switch (dayOfPhase) {
    case 'live':
      return 'live';
    case 'post':
      return 'recap';
    case 'pre':
      return 'pre_event';
    case 'inactive':
    default:
      return 'coming_soon';
  }
}

/**
 * Display-code alphabet: Crockford-style — no I, L, O, U (and no 0/1
 * lookalikes) so a venue AV person can type it off a phone screen without
 * ambiguity. 28 symbols ^ 6 chars ≈ 480M codes per event.
 */
export const DISPLAY_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWX';
export const DISPLAY_CODE_LENGTH = 6;

/** Generate a display code from injected randomness (testable). */
export function displayCodeFrom(randomBytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < DISPLAY_CODE_LENGTH; i++) {
    out += DISPLAY_CODE_ALPHABET[(randomBytes[i] ?? 0) % DISPLAY_CODE_ALPHABET.length];
  }
  return out;
}
