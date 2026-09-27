import localFont from 'next/font/local';

/*
 * ─── EVERY FACE WE SHIP, AS A CHOICE — AND NONE OF THEM PRELOADED ────────────
 * Owner, 2026-09-27: *"remember to use all our fonts on the dropdown"*.
 *
 * `app/layout.tsx` declares the thirteen faces the product chrome and the first
 * nine choices use. Every OTHER family the repo carries is declared here, once,
 * under a `--font-hub-<key>` variable, so the Maker's Font dropdown
 * (`lib/hub-fonts.ts`) can offer it on any page and any theme.
 *
 * 🔑 `preload: false` ON EVERY ONE — THE PHONE RULE. 99% of guests are on
 * phones. A preloaded face is a `<link rel=preload as=font>` in every page's
 * <head>, downloaded whether or not a letter is ever set in it. Without the
 * preload, an `@font-face` costs a few hundred bytes of CSS and downloads its
 * file ONLY when some text on the page is actually set in it — i.e. only on a
 * page where the couple chose it, or in the Maker's own dropdown, where each
 * option is drawn in its face. A plain guest page downloads exactly what it did
 * before. `hub-fonts-are-loaded.test.ts` fails if any entry here preloads.
 *
 * ── WHERE THE FILES CAME FROM (no network — every source was already in the repo)
 *   · `./<family>/*.woff2` (not Cardo/Pinyon/Poppins) — the committed Google
 *     latin subsets the theme faces (`[slug]/_components/skins/site-skin.tsx`,
 *     `invite/_components/themes/*`) already load. Same files; a second
 *     declaration with the same file is the same URL, so a guest never
 *     downloads a face twice.
 *   · `./cardo`, `./pinyon-script`, `./poppins` — latin `.woff2` subsets cut
 *     from the repo's own OFL `.ttf`s (`lib/social/fonts`,
 *     `public/monogram-studio/fonts`) by `scripts/subset-shipped-fonts.py`.
 *     None of the three carries a Reserved Font Name, so a subset may keep it.
 *   · The six Reserved-Font-Name faces (Cinzel Decorative, Gilda Display,
 *     Marcellus, Playfair Display SC, Herr Von Muellerhoff, Mr De Haviland) are
 *     served as the UNMODIFIED `.ttf` the repo already carries. OFL §3 forbids a
 *     modified version (a subset is one) from keeping a reserved name, so they
 *     are not cut — the price is a larger file, paid only by a couple who picks
 *     one.
 *
 * ⚠ `adjustFontFallback` is stated on every one, as in `layout.tsx`: with local
 * files Next does not infer it, and without it the swap reflows the page.
 */

const hubCormorantSc = localFont({
  src: [
    { path: './cormorant-sc/cormorant-sc-400.woff2', weight: '400', style: 'normal' },
    { path: './cormorant-sc/cormorant-sc-600.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  variable: '--font-hub-cormorantsc',
  adjustFontFallback: 'Times New Roman',
});
const hubPlayfairSc = localFont({
  src: [{ path: '../../public/monogram-studio/fonts/PlayfairDisplaySC-Regular.ttf', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-hub-playfairsc',
  adjustFontFallback: 'Times New Roman',
});
const hubBodoni = localFont({
  src: [{ path: './bodoni-moda/bodoni-moda-600.woff2', weight: '600', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-hub-bodoni',
  adjustFontFallback: 'Times New Roman',
});
const hubPrata = localFont({
  src: [{ path: './prata/prata-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-hub-prata',
  adjustFontFallback: 'Times New Roman',
});
const hubInstrument = localFont({
  src: [
    { path: './instrument-serif/instrument-serif-400.woff2', weight: '400', style: 'normal' },
    { path: './instrument-serif/instrument-serif-400-italic.woff2', weight: '400', style: 'italic' },
  ],
  display: 'swap',
  preload: false,
  variable: '--font-hub-instrument',
  adjustFontFallback: 'Times New Roman',
});
const hubCardo = localFont({
  src: [
    { path: './cardo/cardo-400.woff2', weight: '400', style: 'normal' },
    { path: './cardo/cardo-400-italic.woff2', weight: '400', style: 'italic' },
    { path: './cardo/cardo-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  variable: '--font-hub-cardo',
  adjustFontFallback: 'Times New Roman',
});
const hubGilda = localFont({
  src: [{ path: '../../public/monogram-studio/fonts/GildaDisplay-Regular.ttf', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-hub-gilda',
  adjustFontFallback: 'Times New Roman',
});
const hubCinzelDeco = localFont({
  src: [{ path: '../../public/monogram-studio/fonts/CinzelDecorative-Regular.ttf', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-hub-cinzeldeco',
  adjustFontFallback: 'Times New Roman',
});
const hubItaliana = localFont({
  src: [{ path: './italiana/italiana-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-hub-italiana',
  adjustFontFallback: 'Times New Roman',
});
const hubMarcellus = localFont({
  src: [{ path: '../../public/monogram-studio/fonts/Marcellus-Regular.ttf', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-hub-marcellus',
  adjustFontFallback: 'Times New Roman',
});
const hubYeseva = localFont({
  src: [{ path: './yeseva-one/yeseva-one-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-hub-yeseva',
  adjustFontFallback: 'Times New Roman',
});
const hubLimelight = localFont({
  src: [{ path: './limelight/limelight-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-hub-limelight',
  adjustFontFallback: 'Times New Roman',
});
const hubAlfaSlab = localFont({
  src: [{ path: './alfa-slab-one/alfa-slab-one-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-hub-alfaslab',
  adjustFontFallback: 'Times New Roman',
});
const hubOswald = localFont({
  src: [{ path: './oswald/oswald-500.woff2', weight: '500', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-hub-oswald',
  adjustFontFallback: 'Arial',
});
const hubSyne = localFont({
  src: [
    { path: './syne/syne-400.woff2', weight: '400', style: 'normal' },
    { path: './syne/syne-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  variable: '--font-hub-syne',
  adjustFontFallback: 'Arial',
});
const hubPoiret = localFont({
  src: [{ path: './poiret-one/poiret-one-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-hub-poiret',
  adjustFontFallback: 'Arial',
});
const hubPinyon = localFont({
  src: [{ path: './pinyon-script/pinyon-script-400.woff2', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-hub-pinyon',
  adjustFontFallback: 'Times New Roman',
});
const hubHerrVon = localFont({
  src: [{ path: '../../assets/cipher-fonts/herr-von-muellerhoff.ttf', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-hub-herrvon',
  adjustFontFallback: 'Times New Roman',
});
const hubHaviland = localFont({
  src: [{ path: '../../assets/cipher-fonts/mr-de-haviland.ttf', weight: '400', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-hub-haviland',
  adjustFontFallback: 'Times New Roman',
});
const hubJost = localFont({
  src: [
    { path: './jost/jost-400.woff2', weight: '400', style: 'normal' },
    { path: './jost/jost-500.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  variable: '--font-hub-jost',
  adjustFontFallback: 'Arial',
});
const hubQuicksand = localFont({
  src: [
    { path: './quicksand/quicksand-400.woff2', weight: '400', style: 'normal' },
    { path: './quicksand/quicksand-500.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  variable: '--font-hub-quicksand',
  adjustFontFallback: 'Arial',
});
const hubOutfit = localFont({
  src: [
    { path: './outfit/outfit-400.woff2', weight: '400', style: 'normal' },
    { path: './outfit/outfit-500.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  variable: '--font-hub-outfit',
  adjustFontFallback: 'Arial',
});
const hubSchibsted = localFont({
  src: [{ path: './schibsted-grotesk/schibsted-grotesk-600.woff2', weight: '600', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-hub-schibsted',
  adjustFontFallback: 'Arial',
});
const hubPoppins = localFont({
  src: [
    { path: './poppins/poppins-400.woff2', weight: '400', style: 'normal' },
    { path: './poppins/poppins-500.woff2', weight: '500', style: 'normal' },
    { path: './poppins/poppins-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
  variable: '--font-hub-poppins',
  adjustFontFallback: 'Arial',
});

/**
 * The variable classes for `<html>` — each one only DEFINES a `--font-hub-*`
 * custom property; nothing downloads until text is set in the face.
 */
export const HUB_CHOICE_FACES_CLASS = [
  hubCormorantSc,
  hubPlayfairSc,
  hubBodoni,
  hubPrata,
  hubInstrument,
  hubCardo,
  hubGilda,
  hubCinzelDeco,
  hubItaliana,
  hubMarcellus,
  hubYeseva,
  hubLimelight,
  hubAlfaSlab,
  hubOswald,
  hubSyne,
  hubPoiret,
  hubPinyon,
  hubHerrVon,
  hubHaviland,
  hubJost,
  hubQuicksand,
  hubOutfit,
  hubSchibsted,
  hubPoppins,
]
  .map((f) => f.variable)
  .join(' ');
