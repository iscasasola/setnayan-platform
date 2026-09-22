import localFont from 'next/font/local';
import type { InviteThemeId } from '@/lib/invite-themes';
import capiz from './capiz.module.css';
import velvet from './velvet.module.css';
import galeriya from './galeriya.module.css';
import abaca from './abaca.module.css';

/*
 * ─── THE THEMES' OWN FACES ───────────────────────────────────────────────────
 * Three of the four Pro themes carry a typeface, and the site port would be a
 * colour swap without them: Velvet is Bodoni Moda over Jost, Galeriya is
 * Schibsted Grotesk, Abaca is Alfa Slab One over Oswald. (Capiz carries none —
 * its door sets the seal in the house Cormorant, so the page keeps it too.)
 *
 * 🔑 THE SAME FILES THE DOOR LOADS, declared the same way. `next/font/local`
 * keys on the resolved font config, so a guest who came through the door does
 * not download a second copy — and stating the files here rather than importing
 * the door's module is what keeps `themes-stay-skins.test.ts` true (no theme
 * stylesheet reaches the shared chunk).
 *
 * ⚠ `adjustFontFallback` IS STATED ON EVERY ONE. With local files Next does not
 * infer it, and without it the swap from the metric fallback to the real face
 * reflows the page — `app/layout.tsx` carries the same note, and so does every
 * door skin.
 */
const velvetDisplay = localFont({
  src: [{ path: '../../../_fonts/bodoni-moda/bodoni-moda-600.woff2', weight: '600', style: 'normal' }],
  display: 'swap',
  variable: '--font-velvet-display',
  adjustFontFallback: 'Times New Roman',
});
const velvetUtility = localFont({
  src: [
    { path: '../../../_fonts/jost/jost-400.woff2', weight: '400', style: 'normal' },
    { path: '../../../_fonts/jost/jost-500.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-velvet-utility',
  adjustFontFallback: 'Arial',
});
const galeriyaSans = localFont({
  src: [
    {
      path: '../../../_fonts/schibsted-grotesk/schibsted-grotesk-600.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-galeriya-sans',
  adjustFontFallback: 'Arial',
});
const abacaDisplay = localFont({
  src: [
    { path: '../../../_fonts/alfa-slab-one/alfa-slab-one-400.woff2', weight: '400', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-abaca-display',
  adjustFontFallback: 'Times New Roman',
});
const abacaUtility = localFont({
  src: [{ path: '../../../_fonts/oswald/oswald-500.woff2', weight: '500', style: 'normal' }],
  display: 'swap',
  variable: '--font-abaca-utility',
  adjustFontFallback: 'Arial',
});

/**
 * The Event Hub's ground, for a theme the couple already chose on their door.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Owner, 2026-09-22: *"we have event hub themes"* — and he was right. The five
 * (`lib/invite-themes.ts`, since 2026-09-10) stopped at `/[slug]/invite`.
 * Everything behind that door was still the one Clean-Editorial look, which is
 * what made the site read as plain next to the market. Owner ruling the same
 * day: the site wears the theme the couple already picked. One choice, one
 * picker, one purchase.
 *
 * ─── WHY THIS IS NOT `inviteSkin()` ──────────────────────────────────────────
 * ⛔ THE SITE MAY NOT IMPORT THE DOOR'S STYLESHEETS, and the rule is right:
 * `themes-stay-skins.test.ts` holds that a theme's CSS is imported only from
 * the invite routes' own theme folder, so no theme ever reaches the shared
 * chunk. These four modules are the SITE's chunk, imported only from here.
 *
 * What the two surfaces DO share is the material — pearl, velvet, wall, kraft,
 * and the couple's accent mixed into each — which lives once in
 * `app/globals.css` under `[data-invite-theme='x'], [data-hub-theme='x']`.
 * Neither surface declares it, so neither can drift from the other.
 *
 * A `DoorSkin` fills slots around ONE centred card. A site skin has exactly one
 * job: the ground behind a page that scrolls. Everything else a theme does to
 * the page — paper, metal, grain, the printed frame, the rule — it does through
 * the tokens, with no component knowing a theme exists.
 */
export type SiteSkin = {
  /**
   * The theme's font-variable classes, for the page frame. The material itself
   * is keyed on `data-hub-theme` in globals.css and needs no class — this
   * carries ONLY the `--font-*-…` variables `next/font` generates, which cannot
   * live in a stylesheet because their values are build-time hashes.
   */
  className: string;
  /** The fixed layer behind the whole page. Decorative; never interactive. */
  ground: React.ReactNode;
  /** The couple's colour, for the material's `color-mix` — ornament only. */
  style: React.CSSProperties;
};

/** A background-image value whose URL cannot break out of `url(…)`. */
function photoLayer(cls: string, photo: string) {
  return <div className={cls} style={{ backgroundImage: `url(${JSON.stringify(photo)})` }} />;
}

export function siteSkin(
  theme: InviteThemeId,
  input: { photo: string | null; accent: string },
): SiteSkin | undefined {
  const style = { ['--accent' as string]: input.accent } as React.CSSProperties;

  switch (theme) {
    case 'capiz':
      return {
        style,
        className: '',
        ground: (
          <div className={capiz.ground}>
            {input.photo ? photoLayer(capiz.photo ?? '', input.photo) : null}
            <div className={capiz.shell} />
          </div>
        ),
      };
    case 'velvet':
      return {
        style,
        className: [velvetDisplay.variable, velvetUtility.variable].join(' '),
        ground: (
          <div className={velvet.ground}>
            {input.photo ? photoLayer(velvet.photo ?? '', input.photo) : null}
            <div className={velvet.veil} />
            <div className={velvet.scrim} />
          </div>
        ),
      };
    /*
      🔑 GALERIYA AND ABACA TAKE NO PHOTO, and neither is an oversight — each
      module's docblock carries its own reason (a gallery whose wall is the
      picture has no wall; kraft has no contrast headroom to give a multiply).
      Both let the couple's photo reach the page through the hero the site
      already renders, which is where the door prints it too.
    */
    case 'galeriya':
      return {
        style,
        className: galeriyaSans.variable,
        ground: (
          <div className={galeriya.ground}>
            <div className={galeriya.rule} />
          </div>
        ),
      };
    case 'abaca':
      return {
        style,
        className: [abacaDisplay.variable, abacaUtility.variable].join(' '),
        ground: (
          <div className={abaca.ground}>
            <div className={abaca.stock} />
          </div>
        ),
      };
    /*
      House — and anything `resolveInviteTheme` turned into House — is the page
      exactly as it renders today. No ground, no attribute, no CSS block: an
      event that never chose a theme is byte-identical to before this shipped.
    */
    default:
      return undefined;
  }
}
