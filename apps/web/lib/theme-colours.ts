/**
 * lib/theme-colours.ts — THE ONE ANSWER TO "WHAT COLOURS DOES THIS THEME WEAR?"
 *
 * 🎨 Owner, 2026-10-05 (DECISION_LOG "THE MOOD BOARD PALETTE IS THE PRIORITY"),
 * verbatim: *"The priority palette will always be based on the mood board. If
 * the mood board does not have a palette, use our original theme and place it
 * on the moodboard's palette. If a moodboard has a color palette already then
 * all themes will adapt to the color palette of the moodboard."*
 *
 *   · THEME = layout, type and motion.  PALETTE = colour.
 *   · A Mood Board palette set → every theme, and every PICTURE of a theme (the
 *     guest page, the Maker's scene tiles, the theme gallery, the prints), is
 *     painted in the palette's colours.
 *   · No palette → the theme's own colours; picking a theme then writes them
 *     into the Mood Board palette (`themeSeedPalette`, through the hub draft —
 *     `maker-theme-picker.tsx`), so the palette is never empty after a pick.
 *
 * 🔑 ONE RESOLVER, TWO SHAPES OF ONE ANSWER:
 *   · `paletteColourVars` — the `--color-*` custom properties the guest page
 *     wears (`guestLookFrom`, `app/[slug]/_lib/loaders.ts`);
 *   · `themeColours` — the same answer as hexes, for every picture that cannot
 *     wear custom properties (the Maker's words-only scene tiles, the prints).
 * Both branch on the SAME three cases below, so a tile and the page it pictures
 * cannot disagree. `lib/a-theme-preview-wears-the-palette.test.ts` fails if a
 * theme preview reads `INVITE_THEMES[…].palette` for its colours around this.
 *
 * ── THE THREE CASES ─────────────────────────────────────────────────────────
 *   1. No palette            → the worn theme's own colours.
 *   2. A theme's SEED         → THAT theme's own colours (`seededTheme`). A
 *      palette written by a theme pick is the theme's colours exactly; the
 *      Mood Board's generic derivation (`buildSitePaletteVars`) cannot draw a
 *      dark page (its paper is always near-white), so a seed is read back as
 *      the very tokens the seeding theme's own page block is generated from
 *      (`hubThemePageTokens`) — Cyber Neon picked on an empty board stays dark,
 *      and every other theme then wears Cyber Neon's colours.
 *   3. Any other palette      → the Mood Board derivation the guest page has
 *      always worn (`buildSitePaletteVars`) — unchanged, byte for byte.
 *
 * Pure. No I/O. Client-safe (no `server-only`), but the Maker's client
 * components are handed its answers as props rather than importing it.
 */
import { HUB_THEMES, INVITE_THEMES, type InviteTheme, type InviteThemeId } from '@/lib/invite-themes';
import { buildSitePaletteVars, moodBoardSiteColours } from '@/lib/site-palette';
import { channels, hubThemePageTokens } from '@/lib/hub-theme-tokens';
import { compositeOver, contrastRatio, relativeLuminance } from '@/lib/hub-legibility';
import { PALETTE_ORDER, sanitizeRolePalette, type RolePalette } from '@/lib/mood-board';
import { boardIsTheCouples, paletteIsSet, seededTheme, themeSeedPalette } from '@/lib/mood-board-palette-set';

/** A theme's colours — the registry's palette shape (`INVITE_THEMES[id].palette`). */
export type ThemePaletteColours = InviteTheme['palette'];

export type ThemeColours = {
  /** Where the colours came from: the Mood Board palette, or the worn theme itself. */
  source: 'palette' | 'theme';
  colours: ThemePaletteColours;
};

const HEX = /^#[0-9a-f]{6}$/i;

/** The palette's colours, de-duplicated, upper-case, in the palette's key order. */
function swatchesOf(palette: unknown): string[] {
  const p = sanitizeRolePalette(palette) as Record<string, unknown>;
  const seen = new Set<string>();
  for (const key of PALETTE_ORDER) {
    const v = p[key];
    if (Array.isArray(v)) for (const c of v) if (typeof c === 'string' && HEX.test(c)) seen.add(c.toUpperCase());
  }
  return [...seen];
}

export { boardIsTheCouples, paletteIsSet, seededTheme, themeSeedPalette };

/** Every theme's seed, keyed by id — handed to the Maker's picker as plain data. */
export function themeSeedPalettes(): Record<string, RolePalette> {
  return Object.fromEntries(HUB_THEMES.map((t) => [t.id, themeSeedPalette(t.id)]));
}

/** The colour half of a theme's generated page block (`globals.css` "THE TEN THEMES ON THE PAGE"). */
function themeBlockVars(t: InviteTheme): Record<string, string> {
  const p = t.palette;
  const k = hubThemePageTokens(t);
  return {
    '--hub-canvas': p.canvas,
    '--hub-surface': p.surface,
    '--hub-ink': p.ink,
    '--hub-muted': p.muted,
    '--hub-accent': p.accent,
    '--hub-accent-ink': p.accentInk,
    '--hub-heading': p.heading,
    '--color-cream': channels(p.canvas),
    '--color-paper': channels(p.canvas),
    '--color-veil': channels(p.canvas),
    '--color-paper-deep': channels(p.surface),
    '--color-ink': channels(k.ink),
    '--color-ink-on-plate': channels(k.ink),
    '--color-gild': channels(k.gild),
    // A theme's gild already reads as text (`hubThemePageTokens`) — its words use it as is.
    '--color-gild-text': channels(k.gild),
    '--color-terracotta': channels(k.eyebrow),
    '--color-terracotta-600': channels(k.eyebrow),
    '--color-terracotta-700': channels(k.eyebrow),
    '--color-mulberry': channels(k.cta),
    '--color-mulberry-600': channels(k.cta),
    '--color-mulberry-700': channels(k.cta),
  };
}

/**
 * 🎨 THE GUEST PAGE'S COLOURS — the `--color-*` vars the worn theme is painted
 * with, or null when the theme paints its own (no palette, or the palette is
 * this very theme's seed — the page is then byte-identical to the theme alone).
 */
export function paletteColourVars(palette: unknown, worn: InviteThemeId): Record<string, string> | null {
  if (!paletteIsSet(palette)) return null;
  const seed = seededTheme(palette);
  if (seed) return seed === worn ? null : themeBlockVars(INVITE_THEMES[seed]);
  const vars = buildSitePaletteVars(sanitizeRolePalette(palette));
  if (!vars) return null;
  /* The theme's own `--hub-*` hexes (its material, its plates, its accent
     text) would otherwise still speak the theme's colours under the board's
     paper — they take the board's, from the same derivation the tiles read. */
  const c = boardColours(vars, INVITE_THEMES[worn] ?? INVITE_THEMES.house);
  return {
    ...vars,
    '--hub-canvas': c.canvas,
    '--hub-surface': c.surface,
    '--hub-ink': c.ink,
    '--hub-muted': c.muted,
    '--hub-accent': c.accent,
    '--hub-accent-ink': c.accentInk,
    '--hub-heading': c.heading,
  };
}

const hexOf = (ch: string | undefined, fallback: string): string => {
  const parts = (ch ?? '').trim().split(/\s+/).map(Number);
  if (parts.length !== 3 || !parts.every((n) => Number.isFinite(n))) return fallback;
  return `#${parts.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')}`;
};

/**
 * 🎨 THE SAME ANSWER AS HEXES — for a picture of the theme that is not the
 * page: the Maker's words-only scene tiles, the prints. The palette case reads
 * the very vars the guest page wears (`buildSitePaletteVars`), so a tile shows
 * the paper, ink and accent the page paints.
 */
export function themeColours(themeId: InviteThemeId, palette: unknown): ThemeColours {
  const worn = INVITE_THEMES[themeId] ?? INVITE_THEMES.house;
  if (!paletteIsSet(palette)) return { source: 'theme', colours: worn.palette };
  const seed = seededTheme(palette);
  if (seed) return { source: seed === worn.id ? 'theme' : 'palette', colours: INVITE_THEMES[seed].palette };
  const vars = buildSitePaletteVars(sanitizeRolePalette(palette));
  if (!vars) return { source: 'theme', colours: worn.palette };
  return { source: 'palette', colours: boardColours(vars, worn) };
}

/** A couple's own board, as hexes in the theme palette's shape — read from the page's own vars. */
function boardColours(vars: Record<string, string>, worn: InviteTheme): ThemePaletteColours {
  const canvas = hexOf(vars['--color-cream'], worn.palette.canvas);
  const ink = hexOf(vars['--color-ink'], worn.palette.ink);
  const accent = hexOf(vars['--color-terracotta'], worn.palette.accent);
  const heading = HEX.test(vars['--hub-heading'] ?? '') ? vars['--hub-heading']! : accent;
  const cta = hexOf(vars['--color-mulberry'], accent);
  const [lightInk, darkInk] = relativeLuminance(canvas) >= relativeLuminance(ink) ? [canvas, ink] : [ink, canvas];
  return {
    canvas,
    surface: hexOf(vars['--color-paper-deep'], canvas),
    ink,
    // The page's muted words are `text-ink/60` — the same blend, as a colour.
    muted: compositeOver(ink, 0.6, canvas),
    accent,
    // A word set on the accent: whichever of the page's two inks reads on it.
    accentInk: contrastRatio(lightInk, cta) >= contrastRatio(darkInk, cta) ? lightInk : darkInk,
    heading,
    lightInk,
    darkInk,
  };
}

/**
 * 🎨 THE COLORS PANEL'S "MOOD BOARD" CHOICE — the page background and button
 * colour the board gives, plus its swatches; null = no board. A theme-filled
 * board answers that theme's own page (its paper, its button), the same as
 * the page wears it — never the near-white the generic derivation draws.
 */
export function boardSiteColours(
  palette: unknown,
): { background: string; buttons: string; swatches: string[] } | null {
  if (!paletteIsSet(palette)) return null;
  const seed = seededTheme(palette);
  if (seed) {
    const t = INVITE_THEMES[seed];
    return {
      background: t.palette.canvas,
      buttons: hubThemePageTokens(t).cta,
      swatches: themeSeedPalette(seed).reception.map((h) => h.toLowerCase()),
    };
  }
  return moodBoardSiteColours(sanitizeRolePalette(palette));
}

/**
 * 🎨 THE THEME AS THE BOARD DRESSES IT — the registry entry with its palette
 * swapped for `themeColours`' answer: layout, type, motion and media stay the
 * theme's, colour is the board's. Every function that measures a theme
 * (`hubLegibility`, `resolveAdaptiveTheme`, `hubThemePageTokens`) is handed
 * THIS, never `INVITE_THEMES[id]`, wherever it paints a picture of the page.
 */
export function dressedTheme(themeId: InviteThemeId, palette: unknown): InviteTheme {
  const t = INVITE_THEMES[themeId] ?? INVITE_THEMES.house;
  const { source, colours } = themeColours(t.id, palette);
  return source === 'theme' && colours === t.palette ? t : { ...t, palette: colours };
}

/** The button-colour choices offered when the board holds no swatches — the page's own four. */
export function buttonFallback(c: ThemePaletteColours): string[] {
  return [c.accent, c.heading, c.ink, c.muted];
}

/* ── THE SAMPLE GALLERY'S PALETTE ────────────────────────────────────────────
   The Details theme gallery shows the curated SAMPLE Event Hub in each theme
   (`lib/theme-sample-stills.ts`). By the rule above it must show each theme in
   the COUPLE's colours. The sample page and the sample print door are public,
   so the address never carries colours: it names one of a small fixed set
   (`lib/sample-board.server.ts` reads it) — `palette=none` (each theme in its
   own colours: an empty or theme-filled board, which the next pick refills),
   or `board=<the couple's event>` (that board, for its signed-in host only),
   with `bv=` a hash of the board so an edit is a new address (no stale
   picture in any cache). */

/** A short, stable hash of the board's colours — the sample address's version. */
function boardVersion(palette: unknown): string {
  let h = 0x811c9dc5;
  for (const ch of [...swatchesOf(palette)].sort().join(',')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** The sample's query: `palette=none`, or `board=<eventId>&bv=<hash>` for a board the couple made. */
export function sampleBoardQuery(palette: unknown, eventId: string): string {
  return boardIsTheCouples(palette)
    ? `board=${encodeURIComponent(eventId)}&bv=${boardVersion(palette)}`
    : 'palette=none';
}
