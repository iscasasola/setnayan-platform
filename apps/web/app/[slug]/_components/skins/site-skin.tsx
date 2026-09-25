import localFont from 'next/font/local';
import type { InviteThemeId } from '@/lib/invite-themes';

/*
 * ─── THE THEMES' OWN FACES ───────────────────────────────────────────────────
 * Two faces the ten themes name are not declared in the root layout: Bodoni
 * Moda (Luxe's heading, and Regency's stand-in for Prata) and Jost (Modern's
 * body, and the stand-in for Quicksand and Poiret One). Every other face a theme
 * asks for — Fraunces, Playfair, Cinzel, Vidaloka, Hanken Grotesk, Space Mono —
 * is already a root variable, and `globals.css` points each theme block at it.
 *
 * 🔑 THE SAME FILES AND THE SAME VARIABLE NAMES THE VELVET DOOR LOADS
 * (`invite/_components/themes/velvet.tsx`). `next/font/local` keys on the
 * resolved font config, so a guest who came through the door does not download
 * a second copy.
 *
 * ⚠ `adjustFontFallback` IS STATED ON EVERY ONE. With local files Next does not
 * infer it, and without it the swap from the metric fallback to the real face
 * reflows the page — `app/layout.tsx` carries the same note.
 *
 * ⏭ STAND-INS, NAMED. The spec's faces for several themes (Instrument Serif,
 * Italiana, Yeseva One, Prata, Limelight, Syne, Lora, Quicksand, Josefin Sans…)
 * are not committed under `app/_fonts` yet; each theme block in `globals.css`
 * says which loaded face stands in for which. The registry keeps the spec's
 * names (`INVITE_THEMES[id].fonts`) so the fetch can follow without a data change.
 */
const bodoni = localFont({
  src: [{ path: '../../../_fonts/bodoni-moda/bodoni-moda-600.woff2', weight: '600', style: 'normal' }],
  display: 'swap',
  variable: '--font-velvet-display',
  adjustFontFallback: 'Times New Roman',
});
const jost = localFont({
  src: [
    { path: '../../../_fonts/jost/jost-400.woff2', weight: '400', style: 'normal' },
    { path: '../../../_fonts/jost/jost-500.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-velvet-utility',
  adjustFontFallback: 'Arial',
});

/** Which of the two extra faces each theme reads — the rest are root variables. */
const EXTRA_FACES: Partial<Record<InviteThemeId, string>> = {
  velvet: [bodoni.variable, jost.variable].join(' '),
  regency: bodoni.variable,
  galeriya: jost.variable,
  whimsical: jost.variable,
  gatsby: jost.variable,
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
