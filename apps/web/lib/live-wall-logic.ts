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
 * Papic Live Photo Wall tile layouts (owner 2026-07-08 · D5). 'mosaic' is the
 * original masonry look and the default — existing walls are unchanged.
 */
export type WallTileLayout = 'grid' | 'mosaic' | 'hero' | 'polaroid';
export const WALL_TILE_LAYOUTS: readonly WallTileLayout[] = ['mosaic', 'grid', 'hero', 'polaroid'];
export const DEFAULT_WALL_TILE_LAYOUT: WallTileLayout = 'mosaic';
export const DEFAULT_WALL_PHOTO_COUNT = 40;

/** Narrow an arbitrary DB string to a known layout (falls back to the default). */
export function asWallTileLayout(value: string | null | undefined): WallTileLayout {
  return value && (WALL_TILE_LAYOUTS as readonly string[]).includes(value)
    ? (value as WallTileLayout)
    : DEFAULT_WALL_TILE_LAYOUT;
}

/** Clamp the couple's chosen photo count to the DB-enforced 6–60 band. */
export function clampWallPhotoCount(n: number | null | undefined): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return DEFAULT_WALL_PHOTO_COUNT;
  return Math.min(60, Math.max(6, v));
}

// ───────────────────────────────────────────────────────────────────────────
// THE GUEST PHONE MIRROR — events.live_photo_wall_visibility.
//
// The ₱2,500 SKU is called "Live VENUE Photo Wall" and the couple's card only
// ever described a venue projection and screen codes. The same screened feed is
// ALSO mirrored onto every invited guest's phone for the whole live window
// (owner 2026-06-12). A couple who revoked every venue screen code would
// reasonably believe the wall was off — it was still running in every guest's
// hand, because the guest surfaces gated on SKU ownership alone. This column
// existed for exactly that choice and had ZERO readers and ZERO writers for
// nine months: the third "gate with no handle" in this project.
//
// The venue projection does NOT consult this. It projects regardless
// (owner-locked 2026-06-11) behind its own single-use screen code.
// ───────────────────────────────────────────────────────────────────────────

/**
 * The stored vocabulary, matching the DB CHECK constraint exactly.
 *
 * ⚠ 'tagged_only' is LEGAL BUT UNIMPLEMENTED. Nothing anywhere filters the
 * mirror down to the photos a guest actually appears in. It is kept because the
 * per-guest filter is a real future build, and it resolves to "show everything"
 * below — deliberately, and under test. The app WRITER must never emit it (see
 * `storedWallGuestMirror`), because storing a promise the product does not keep
 * is how `sponsored_included` misled two independent readers.
 */
export type WallGuestVisibility = 'tagged_only' | 'all_with_consent' | 'off';
export const WALL_GUEST_VISIBILITIES: readonly WallGuestVisibility[] = [
  'tagged_only',
  'all_with_consent',
  'off',
];
/** What every event created from this migration forward stores. */
export const DEFAULT_WALL_GUEST_VISIBILITY: WallGuestVisibility = 'all_with_consent';

/**
 * Narrow an arbitrary DB string to a known visibility.
 *
 * FAILS OPEN, on purpose and against the usual instinct. An unreadable or
 * pre-migration value must land on the behaviour the product has always had
 * (the mirror on) rather than silently removing a feature the couple paid
 * ₱2,500 for. Turning the mirror off is a decision only the couple makes, and
 * `'off'` is the only value that means it — a typo, a NULL or a future enum
 * member never speaks for them in either direction.
 */
export function asWallGuestVisibility(
  value: string | null | undefined,
): WallGuestVisibility {
  return value && (WALL_GUEST_VISIBILITIES as readonly string[]).includes(value)
    ? (value as WallGuestVisibility)
    : DEFAULT_WALL_GUEST_VISIBILITY;
}

/**
 * THE decision every guest-facing wall surface needs: does the wall mirror onto
 * guests' phones at all?
 *
 * Only `'off'` closes it. `'tagged_only'` returns true — i.e. shows everything —
 * because no filter exists; that is the honest reading of a column nothing has
 * ever implemented, not an oversight. When the per-guest filter is built, this
 * is the function that stops being a boolean.
 */
export function wallGuestMirrorOn(value: string | null | undefined): boolean {
  return asWallGuestVisibility(value) !== 'off';
}

/**
 * The couple's switch, in the only two values the app is allowed to write.
 * `true` → the mirror is on; `false` → venue screens only.
 */
export function storedWallGuestMirror(on: boolean): WallGuestVisibility {
  return on ? 'all_with_consent' : 'off';
}

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
