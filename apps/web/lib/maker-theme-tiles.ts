/**
 * lib/maker-theme-tiles.ts — the pure half of the Maker's theme gallery
 * (`app/dashboard/[eventId]/launch/_components/maker-theme-picker.tsx`): which
 * themes a couple is shown, how big an entry's page picture is, which live
 * page loads next, and the print previews' addresses. No I/O, no React — so
 * the rules are tested as functions.
 *
 * Since 2026-09-28 (owner, DECISION_LOG "THE THEME GALLERY SHOWS A CLEAN SAMPLE
 * EVENT HUB, NOT THE COUPLE'S OWN PAGE") each entry is the curated SAMPLE —
 * a still of its page (`lib/theme-sample-stills.ts`), or the live sample page
 * until a still is captured — with the sample's prints in that theme.
 */

export type ThemeTile = { id: string; name: string; tier: 'free' | 'pro' };

/** The width the page is drawn at inside a tile — a phone's. */
export const TILE_PAGE_W = 390;
/** One phone screen of it. */
export const TILE_PAGE_H = 760;
/** The page picture on screen, in a gallery entry. */
export const TILE_W = 132;
export const TILE_SCALE = TILE_W / TILE_PAGE_W;
export const TILE_H = Math.round(TILE_PAGE_H * TILE_SCALE);
/** A live page that never reports `load` stops holding the queue after this long. */
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
 * Which live page loads next: the first one, in the gallery's order, that is in
 * view and has no frame yet — and none while another is still loading.
 */
export function nextTileToLoad(
  order: readonly string[],
  input: { inView: ReadonlySet<string>; mounted: readonly string[]; loading: string | null },
): string | null {
  if (input.loading) return null;
  return order.find((id) => input.inView.has(id) && !input.mounted.includes(id)) ?? null;
}


/** The two cards a Details theme entry previews beside the page. */
export type ThemePrintPiece = 'invitation' | 'details';
export const THEME_PRINT_PIECES: readonly ThemePrintPiece[] = ['invitation', 'details'];

/**
 * A print preview IN A THEME — the same route and param Prints & Tickets uses
 * (`/api/hub-print/<piece>?mode=screen&theme=<id>`; the route draws it through
 * `printThemeFor(event, theme)`). The theme is ALWAYS named, even the couple's
 * own: a drafted pick is not the live column the route would fall back to.
 *
 * ⚡ `v` is the print inputs' hash (`printInputsVersion`) — with it the route
 * answers `immutable`, and because the theme is part of the address each
 * theme's picture caches on its own. No hash (the read failed): no `v`, and
 * the route keeps its 60 s — never a per-render stamp, which caches nothing.
 */
export function themePrintSrc(
  eventId: string,
  piece: ThemePrintPiece,
  theme: string,
  version: string | null,
): string {
  const v = version ? `&v=${encodeURIComponent(version)}` : '';
  return `/api/hub-print/${piece}?event=${encodeURIComponent(eventId)}&mode=screen&theme=${encodeURIComponent(theme)}${v}`;
}

/** The sample's prints an entry shows beside its page — the sample door serves exactly these. */
export const SAMPLE_PRINT_PIECES = ['invitation', 'details', 'pass'] as const;

/**
 * A SAMPLE print in a theme (`/api/hub-print/<piece>?sample=1`, the sample door
 * — `lib/print-sample-door.server.ts`): the same picture for every couple,
 * `public` and immutable by `v` (the sample's print-inputs hash).
 */
export function samplePrintSrc(piece: (typeof SAMPLE_PRINT_PIECES)[number], theme: string, version: string | null): string {
  return `/api/hub-print/${piece}?sample=1&mode=screen&theme=${encodeURIComponent(theme)}${version ? `&v=${encodeURIComponent(version)}` : ''}`;
}
