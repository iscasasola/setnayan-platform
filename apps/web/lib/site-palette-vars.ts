/**
 * 🎨 THE MOOD BOARD'S PAGE COLOURS — `buildSitePaletteVars` (the `--color-*`
 * overrides the couple site wears) and `moodBoardSiteColours` (the same answer
 * as hexes), with the helpers only they use.
 *
 * MOVED OUT OF `lib/site-palette.ts` (2026-10-10), code unchanged. That file is
 * on the Maker's FIRST load (`lib/hub-legibility.ts` takes `readableTextOn`
 * from it); these two are used only by `lib/theme-colours.ts` (lazy and server
 * code), `app/[slug]/_lib/icon-source.ts` and tests — so they live here and
 * must never be imported from a first-load module. (Not `theme-colours.ts`
 * itself: it already has a different `channels` from `hub-theme-tokens`.)
 * The colour maths they share with the rest stays in `site-palette.ts`.
 */

import type { RolePalette } from './mood-board';
import {
  blend,
  channels,
  chroma,
  contrast,
  darken,
  DEFAULTS,
  hexToRgb,
  lighten,
  luminance,
  MAIN_SLOT,
  paletteSwatches,
  PLATE_MIN_CONTRAST_BAR,
  PLATE_MUTED_ALPHA_BAR,
  type RGB,
  toHex,
  veilColorFromPalette,
  WHITE,
} from './site-palette';


/** The board's colours that may dress the Event Hub — main first, then the ceremony's. Never attire. */
function hubPool(palette: RolePalette): RGB[] {
  const seen = new Set<string>();
  const pool: RGB[] = [];
  for (const key of ['reception', 'ceremony'] as const) {
    for (const hex of palette[key] ?? []) {
      const up = hex.toUpperCase();
      const rgb = hexToRgb(up);
      if (rgb && !seen.has(up)) {
        seen.add(up);
        pool.push(rgb);
      }
    }
  }
  return pool;
}



/**
 * Build the `--color-*` overrides for the couple-site subtree, or null when the
 * palette can't safely theme the page.
 */
export function buildSitePaletteVars(
  palette: RolePalette | null | undefined,
): Record<string, string> | null {
  if (!palette) return null;
  const pool = hubPool(palette);
  if (pool.length === 0) return null;
  const main = (palette.reception ?? []).map((h) => hexToRgb(h));
  const slot = (i: number): RGB | null => main[i] ?? null;

  // Neutral → paper. Missing: a genuinely near-white main/ceremony colour, else alabaster.
  const lightest = [...pool].sort((a, b) => luminance(b) - luminance(a))[0]!;
  const paper = slot(MAIN_SLOT.neutral) ?? (luminance(lightest) >= 0.82 ? lightest : DEFAULTS.paper);
  // ⚠ BEST-EFFORT ON A MID-GREY PAPER (about #777–#999): neither a dark nor a
  // light ink clears 4.5 at the faint `ink/65` step there; the strongest ink is
  // used and every role is moved as far as it goes. Light and dark papers always clear.

  /* Every colour is measured as it will be WRITTEN — rounded to whole
     channels (`channels()`), so a role that clears 4.5 here clears it on the
     page (no 4.47 after rounding). */
  const whole = (c: RGB): RGB => ({ r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) });

  /* 📏 THE BAR EVERY WORD CLEARS — the repo's own (`plateInkReads`,
     `app/[slug]/_lib/pro-site-vars.ts`): AA 4.5 at the FAINTEST step the guest
     pages set words (`text-ink/65`), on the paper AND on the cards. */
  const readsMuted = (ink: RGB, bg: RGB) => contrast(whole(blend(bg, ink, PLATE_MUTED_ALPHA_BAR)), bg) >= PLATE_MIN_CONTRAST_BAR;
  // Supporting → the cards and sections (the plates).
  const supporting = slot(MAIN_SLOT.supporting);
  // Ink is computed, never a slot: the first candidate that reads muted on the
  // paper AND on the Supporting as chosen (so a light Supporting stays exact);
  // else the first that reads on the paper.
  const inkCandidates: RGB[] = [DEFAULTS.ink, { r: 0, g: 0, b: 0 }, { r: 250, g: 250, b: 248 }, WHITE];
  const ink =
    inkCandidates.find((c) => readsMuted(c, paper) && (!supporting || readsMuted(c, supporting))) ??
    inkCandidates.find((c) => readsMuted(c, paper)) ??
    inkCandidates.reduce((best, c) => (contrast(c, paper) > contrast(best, paper) ? c : best));

  // The plates are moved toward the paper until that ink reads on them at the
  // same bar — a Supporting that already reads is used as it is; a dark or mid
  // one is softened to a tint of itself.
  let plate = whole(supporting ?? darken(paper, 0.04));
  const from = plate;
  for (let t = 0.05; t <= 1.0001 && !readsMuted(ink, plate); t += 0.05) plate = whole(blend(from, paper, t));

  /* Every COLOURED word reads on BOTH grounds it meets — the paper and the
     cards — moved away from them (darker on a light page, lighter on a dark
     one), so no card needs a second token. */
  const lightPage = luminance(paper) > 0.18;
  const readableOnBoth = (c: RGB, target: number): RGB => {
    let out = whole(c);
    for (let i = 0; i < 40 && Math.min(contrast(out, paper), contrast(out, plate)) < target; i++) {
      out = whole(lightPage ? darken(out, 0.06) : lighten(out, 0.08));
    }
    return out;
  };

  // Accent → links (text) and buttons (the label is the paper) — both AA.
  const colorful = [...pool].filter((c) => chroma(c) >= 0.12).sort((a, b) => chroma(b) - chroma(a));
  const accentBase = slot(MAIN_SLOT.accent) ?? colorful[0] ?? DEFAULTS.accent;
  const accent = readableOnBoth(accentBase, 4.5);
  const deepColorful = colorful.filter((c) => contrast(c, WHITE) >= 3).sort((a, b) => luminance(a) - luminance(b));
  const ctaBase = slot(MAIN_SLOT.accent) ?? deepColorful[0] ?? accentBase;
  const cta = readableOnBoth(ctaBase, 4.5);
  // Dominant → headings and large blocks — AA-large (3) on the paper and the cards.
  const heading = readableOnBoth(slot(MAIN_SLOT.dominant) ?? accentBase, 3);
  // Accent 2 → ornaments and dividers, AS IT IS (borders, rings, seals, dots —
  // no contrast pull, or a gold ornament turns to ink). Words set in it
  // (`text-gild`: the "and" between the names, small italic lines — measured on
  // maria-and-jose at 1.2:1 raw) take their own TEXT token, the same hue moved
  // until it reads on the paper and the cards: `--color-gild-text`, which
  // Tailwind's `text-gild` reads (`tailwind.config.ts` textColor) while
  // `bg-`/`border-gild` keep the raw.
  const gild = slot(MAIN_SLOT.accent2) ?? gildFromPool(pool);
  const gildText = readableOnBoth(gild, 4.5);
  const veilBoard: RolePalette = { reception: pool.map(toHex) };
  const away = (c: RGB, amount: number) => (luminance(paper) > 0.18 ? darken(c, amount) : lighten(c, amount));

  return {
    '--color-cream': channels(paper),
    '--color-ink': channels(ink),
    '--color-terracotta': channels(accent),
    // Hover / pressed steps move AWAY from the paper — darker on a light page, lighter on a dark one.
    '--color-terracotta-600': channels(away(accent, 0.12)),
    '--color-terracotta-700': channels(away(accent, 0.24)),
    '--color-mulberry': channels(cta),
    '--color-mulberry-600': channels(away(cta, 0.15)),
    '--color-mulberry-700': channels(away(cta, 0.28)),
    // Pahina material tokens (design 2026-07-25 §4). Root fallbacks live in
    // globals.css so palette-less events (this fn returns null) get the same three tokens.
    '--color-gild': channels(gild),
    '--color-gild-text': channels(gildText),
    '--color-paper-deep': channels(plate),
    // The plate was moved until the page ink reads on it at the bar — the card words ARE the page ink.
    '--color-ink-on-plate': channels(ink),
    '--color-veil': channels(hexToRgb(veilColorFromPalette(veilBoard)) ?? PAHINA_VEIL_FALLBACK),
    '--hub-heading': toHex(heading),
  };
}

// ── Pahina material derivations (design 2026-07-25 §4) ───────────────────────

// Atelier gold — the blend target + fallback for the gild (decor metallic).
const GILD_TARGET: RGB = { r: 176, g: 141, b: 87 }; // #B08D57
const GILD_FALLBACK: RGB = { r: 169, g: 131, b: 75 }; // #A9834B
const PAHINA_VEIL_FALLBACK: RGB = { r: 243, g: 236, b: 225 }; // #f3ece1 (veil ivory)

/**
 * Gild — the palette's warmest mid-luminance swatch nudged 35% toward metallic
 * gold (#B08D57); Atelier-gold fallback when the palette has no warm mid-tone.
 * Decor-only (rules, seal, the guest-hub ✦ star) — never body text, so no
 * contrast enforcement (spec §4: "never body text below AA-large"). The
 * editorial chapter numeral this comment used to also list was removed
 * (owner 2026-09-25 "drop the numbers") — no section renders one anymore.
 */
function gildFromPool(pool: RGB[]): RGB {
  const mid = pool.filter((c) => {
    const l = luminance(c);
    return l >= 0.12 && l <= 0.72;
  });
  // Warmth: red-minus-blue spread; require genuine warmth so cool palettes
  // fall back to the brand gold instead of gilding with a mauve.
  const warm = mid
    .filter((c) => c.r - c.b >= 16)
    .sort((a, b) => b.r - b.b - (a.r - a.b));
  const base = warm[0];
  if (!base) return GILD_FALLBACK;
  return blend(base, GILD_TARGET, 0.35);
}

/**
 * 🎨 THE PAGE'S COLOURS AS THE MOOD BOARD GIVES THEM — what the guest page
 * paints while the couple has picked no colour of their own: the page's
 * background (`--color-cream`, the paper) and its buttons (`--color-mulberry`,
 * the CTA), read from `buildSitePaletteVars` — the SAME resolver the guest page
 * wears (`app/[slug]/_lib/loaders.ts`) — plus the swatches themselves.
 *
 * Owner, 2026-09-27, on the Maker's Colors panel: *"mood board palettes did not
 * update"* — the panel drew a hard-coded cream for "blank = use my Mood Board",
 * so it never showed the couple's colours. Null = no Mood Board palette yet.
 */
export function moodBoardSiteColours(
  palette: RolePalette | null | undefined,
): { background: string; buttons: string; swatches: string[] } | null {
  const vars = buildSitePaletteVars(palette);
  if (!vars) return null;
  const hexOf = (ch: string | undefined) => {
    const [r, g, b] = (ch ?? '').split(' ').map(Number);
    return [r, g, b].every((n) => Number.isFinite(n)) ? toHex({ r: r!, g: g!, b: b! }) : null;
  };
  const background = hexOf(vars['--color-cream']);
  const buttons = hexOf(vars['--color-mulberry']);
  if (!background || !buttons) return null;
  return { background, buttons, swatches: paletteSwatches(palette).map((h) => h.toLowerCase()) };
}
