/**
 * lib/theme-sample-stills.ts — the Details theme gallery's PICTURES of the
 * sample Event Hub, one per theme (owner 2026-09-28, DECISION_LOG "THE THEME
 * GALLERY SHOWS A CLEAN SAMPLE EVENT HUB, NOT THE COUPLE'S OWN PAGE").
 *
 * The sample page is the same for every couple, so each theme's tile is a
 * STILL — photographed once from `/maria-and-jose?theme=<id>` by
 * `pnpm capture:theme-samples` into `public/theme-samples/<id>.webp` — rather
 * than ten whole live pages loading on a phone. A theme with no still (not
 * captured yet) falls back to the live, lazy tile of the same address.
 *
 * ── A STILL CANNOT ROT SILENTLY ────────────────────────────────────────────
 * Beside each still the manifest (`theme-sample-stills.manifest.json`) stores `look`: the hash of what shapes that
 * theme's picture in CODE — its `INVITE_THEMES` definition and its door's CSS
 * module (`themeLookHash`, `theme-sample-stills-hash.ts` — kept out of this
 * client-safe file). `theme-sample-stills-are-current.test.ts` recomputes it; a theme
 * whose definition changed without a re-capture goes RED and names the
 * command. `sample` is the sample event's content hash at capture time (the
 * script reads it from the page); it is recorded for the next capture to
 * compare, since a unit test cannot read the database.
 */
import type { InviteThemeId } from '@/lib/invite-themes';
import manifest from './theme-sample-stills.manifest.json';

export type ThemeStillEntry = { look: string; sample: string | null; capturedAt: string };
export type ThemeStillManifest = Partial<Record<InviteThemeId, ThemeStillEntry>>;

export const THEME_STILLS: ThemeStillManifest = manifest as ThemeStillManifest;
export const THEME_STILL_CAPTURE_COMMAND = 'pnpm capture:theme-samples';
/** The sample page the stills are photographed from — never a couple's. */
export const SAMPLE_HUB_PATH = '/maria-and-jose';

/** The still's address (its look hash in `v`, so a re-capture is a new address), or null. */
export function themeStillSrc(id: string): string | null {
  const entry = THEME_STILLS[id as InviteThemeId];
  return entry ? `/theme-samples/${id}.webp?v=${entry.look}` : null;
}

/** The live fallback: the sample page itself in that theme (`[slug]` honours `theme=` on the sample row only). */
export function sampleHubTileSrc(
  id: string,
  /** 🎨 The couple's palette as `samplePaletteParam` wrote it (`none` = no palette); absent = the sample's own. */
  palette: string | null = null,
): string {
  return `${SAMPLE_HUB_PATH}?theme=${encodeURIComponent(id)}${palette ? `&palette=${encodeURIComponent(palette)}` : ''}`;
}
