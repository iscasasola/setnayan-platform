import localFont from 'next/font/local';
import type { InviteThemeId } from '@/lib/invite-themes';

/*
 * ─── THE THEMES' OWN FACES ───────────────────────────────────────────────────
 * Every theme's spec face is now committed under `app/_fonts` (Phase 4,
 * 2026-09-25) and declared HERE, not in the root layout — these faces render
 * only on a themed guest page, never on marketing/dashboard/admin, so loading
 * them at the root would tax every page for nine themes only one visitor at a
 * time ever needs. `globals.css` points each theme block's `--font-display` /
 * `--font-mono` at the variable declared below (or, for Modern and Luxe, at a
 * root variable already loaded for an unrelated reason — see the CSS
 * comments). Rustic (Fraunces) and Vintage (Playfair Display) needed no face
 * here at all: both spec faces were already root variables.
 *
 * 🔑 THE SAME FILES AND THE SAME VARIABLE NAMES THE VELVET DOOR LOADS
 * (`invite/_components/themes/velvet.tsx`). `next/font/local` keys on the
 * resolved font config, so a guest who came through the door does not download
 * a second copy.
 *
 * 📱 `preload: false` ON EVERY ONE (2026-09-27). This module is imported by the
 * guest-tree layout, so a preload here was a download of EVERY theme's faces on
 * EVERY guest page — a plain House page included, which sets a letter in none
 * of them. next/font decides preloading per declaration at build time and
 * cannot know which theme a request wears, so there is no per-theme preload to
 * be had; without one, a face downloads only when text is set in it, i.e. only
 * the ACTIVE theme's. 🔑 AND THE SAME FILE MUST SAY THE SAME THING EVERYWHERE:
 * next/font names a preloaded file `<hash>.p.woff2` and an unpreloaded one
 * `<hash>.woff2`, so the door (`invite/_components/themes/*`) and
 * `_fonts/choice-faces.ts` say `preload: false` too — otherwise one face is two
 * URLs and a guest who walks from the door to the page downloads it twice.
 * Both rules are held by `lib/fonts-preload-only-the-first-paint.test.ts`.
 *
 * ⚠ `adjustFontFallback` IS STATED ON EVERY ONE. With local files Next does not
 * infer it, and without it the swap from the metric fallback to the real face
 * reflows the page — `app/layout.tsx` carries the same note.
 *
 * ⏭ HEADING AND LABELS: no stand-ins. Every face the spec names for a theme's
 * heading or its labels is downloaded (OFL, from google/fonts) and wired to the
 * CSS var that theme reads.
 *
 * ✅ BODY AND SCRIPT ARE WIRED TOO (B5, 2026-10-04) — and need NOTHING here.
 * Each theme block in `globals.css` now sets `--font-body` (also `--font-sans`
 * and the inherited `font-family`), `--font-theme-script` and `--font-mono`,
 * pointing at faces ALREADY declared on `<html>` with `preload: false`
 * (`app/layout.tsx`, `app/_fonts/choice-faces.ts`), so no class is added here
 * and no file downloads until a themed page sets text in it. Which face each
 * role wears is `lib/hub-theme-faces.ts` — every one the spec's own face since
 * the ten missing Google families were added (2026-10-04).
 */
const bodoni = localFont({
  src: [{ path: '../../../_fonts/bodoni-moda/bodoni-moda-600.woff2', weight: '600', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-velvet-display',
  adjustFontFallback: 'Times New Roman',
});
const jost = localFont({
  src: [
    { path: '../../../_fonts/jost/jost-400.woff2', weight: '400', style: 'normal' },
    { path: '../../../_fonts/jost/jost-500.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  variable: '--font-velvet-utility',
  adjustFontFallback: 'Arial',
});
/** Modern (`galeriya`) heading — replaces the Playfair Display stand-in. */
const instrumentSerif = localFont({
  src: [
    { path: '../../../_fonts/instrument-serif/instrument-serif-400.woff2', weight: '400', style: 'normal' },
    { path: '../../../_fonts/instrument-serif/instrument-serif-400-italic.woff2', weight: '400', style: 'italic' },
  ],
  display: 'swap',
  preload: false,
  variable: '--font-galeriya-display',
  adjustFontFallback: 'Times New Roman',
});
/** Cinderella heading — replaces the Cinzel stand-in. */
const italiana = localFont({
  src: [{ path: '../../../_fonts/italiana/italiana-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-cinderella-display',
  adjustFontFallback: 'Times New Roman',
});
/** Luxe (`velvet`) labels — replaces the Cinzel stand-in for Cormorant SC. */
const cormorantSc = localFont({
  src: [
    { path: '../../../_fonts/cormorant-sc/cormorant-sc-400.woff2', weight: '400', style: 'normal' },
    { path: '../../../_fonts/cormorant-sc/cormorant-sc-600.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  variable: '--font-velvet-labels',
  adjustFontFallback: 'Times New Roman',
});
/** Whimsical heading — replaces the Vidaloka stand-in. */
const yesevaOne = localFont({
  src: [{ path: '../../../_fonts/yeseva-one/yeseva-one-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-whimsical-display',
  adjustFontFallback: 'Times New Roman',
});
/** Whimsical labels — replaces the Jost stand-in for Quicksand. */
const quicksand = localFont({
  src: [
    { path: '../../../_fonts/quicksand/quicksand-400.woff2', weight: '400', style: 'normal' },
    { path: '../../../_fonts/quicksand/quicksand-500.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  variable: '--font-whimsical-labels',
  adjustFontFallback: 'Arial',
});
/** Regency heading — replaces the Bodoni Moda stand-in for Prata. */
const prata = localFont({
  src: [{ path: '../../../_fonts/prata/prata-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-regency-display',
  adjustFontFallback: 'Times New Roman',
});
/** Great Gatsby heading — replaces the Cinzel stand-in for Limelight. */
const limelight = localFont({
  src: [{ path: '../../../_fonts/limelight/limelight-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-gatsby-display',
  adjustFontFallback: 'Times New Roman',
});
/** Great Gatsby labels — replaces the Jost stand-in for Poiret One. */
const poiretOne = localFont({
  src: [{ path: '../../../_fonts/poiret-one/poiret-one-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-gatsby-labels',
  adjustFontFallback: 'Arial',
});
/** Cyber Neon heading — replaces the Hanken Grotesk stand-in for Syne. */
const syne = localFont({
  src: [
    { path: '../../../_fonts/syne/syne-400.woff2', weight: '400', style: 'normal' },
    { path: '../../../_fonts/syne/syne-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  variable: '--font-cyber-display',
  adjustFontFallback: 'Arial',
});
/** Cyber Neon labels — replaces the Space Mono stand-in for Outfit. */
const outfit = localFont({
  src: [
    { path: '../../../_fonts/outfit/outfit-400.woff2', weight: '400', style: 'normal' },
    { path: '../../../_fonts/outfit/outfit-500.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  variable: '--font-cyber-labels',
  adjustFontFallback: 'Arial',
});

/** Which extra faces each theme reads — the rest are root variables. */
const EXTRA_FACES: Partial<Record<InviteThemeId, string>> = {
  velvet: [bodoni.variable, cormorantSc.variable].join(' '),
  regency: prata.variable,
  galeriya: [jost.variable, instrumentSerif.variable].join(' '),
  cinderella: italiana.variable,
  whimsical: [yesevaOne.variable, quicksand.variable].join(' '),
  gatsby: [limelight.variable, poiretOne.variable].join(' '),
  cyber: [syne.variable, outfit.variable].join(' '),
};

/**
 * What the guest-tree layout needs from a theme beyond its CSS block.
 *
 * ─── WHY THIS IS SO SMALL NOW ───────────────────────────────────────────────
 * The theme's colours are a stylesheet block keyed on `data-hub-theme`
 * (generated from the registry — see "THE TEN THEMES ON THE PAGE" in
 * `globals.css`), and its ground — the loop, the still and the scrim — is drawn
 * by `GuestLookScope` from `_lib/theme-ground.ts`. What cannot live in a
 * stylesheet is the `--font-*` variables `next/font` generates (build-time
 * hashes), so this carries exactly those, plus the couple's `--accent`.
 *
 * ⛔ THE SITE STILL MAY NOT IMPORT THE DOOR'S STYLESHEETS
 * (`themes-stay-skins.test.ts`): no theme stylesheet reaches the shared chunk.
 */
export type SiteSkin = {
  /** The theme's font-variable classes, for the page frame. */
  className: string;
  /** The couple's colour, for the material's `color-mix` — ornament only. */
  style: React.CSSProperties;
};

export function siteSkin(theme: InviteThemeId, input: { accent: string }): SiteSkin | undefined {
  /*
    House — and anything `resolveInviteTheme` turned into House — is the page
    exactly as it renders today. No attribute, no CSS block: an event that never
    chose a theme is byte-identical to before themes shipped.
  */
  if (theme === 'house') return undefined;
  return {
    className: EXTRA_FACES[theme] ?? '',
    style: { ['--accent' as string]: input.accent } as React.CSSProperties,
  };
}
