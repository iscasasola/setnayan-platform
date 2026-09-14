import localFont from 'next/font/local';
import type { DoorSkin } from '@/app/_components/door/door-shell';
import type { InviteSkinInput } from './invite-skin';
import styles from './abaca.module.css';

/**
 * ABACA — the Rugged invite theme (Event Hub Pro). See abaca.module.css for the
 * port and its four measured corrections.
 *
 * The photo is painted as a CSS background whose URL goes through
 * `JSON.stringify` — a quoted, escaped CSS string — so a presigned URL's `&`,
 * `%` or any stray quote can never break out of `url(…)`.
 *
 * 📦 THE FACES ARE DECLARED HERE, NOT IN app/layout.tsx. This module is reached
 * only from the three invite doors (invite-skin ← load-invite-look, server-only),
 * so Abaca's type ships on Abaca's doors and on no other page.
 */

/**
 * Alfa Slab One — the woodtype display face.
 *
 * ONE FACE, AND IT HAS ONLY ONE. SIL OFL 1.1, from github.com/google/fonts
 * `ofl/alfaslabone` (`AlfaSlabOne-Regular.ttf`, Version 2.000, sha256
 * 28664afa…299d), subset to latin and converted to woff2 with fonttools. The
 * licence travels with it: app/_fonts/alfa-slab-one/OFL.txt.
 */
const alfaSlabOne = localFont({
  src: [
    {
      path: '../../../../_fonts/alfa-slab-one/alfa-slab-one-400.woff2',
      weight: '400',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-abaca-display',
  // Metric-matched fallback while the face loads — with local files it must be
  // stated (app/layout.tsx carries the same note).
  adjustFontFallback: 'Times New Roman',
});

/**
 * Oswald — the condensed gothic that sets the kicker and the date stamp.
 *
 * ONE WEIGHT, 500. SIL OFL 1.1, from github.com/google/fonts `ofl/oswald`
 * (`Oswald[wght].ttf`, Version 4.103, sha256 5b38c246…2817), instanced at
 * wght 500, subset to latin and converted to woff2 with fonttools. The licence
 * travels with it: app/_fonts/oswald/OFL.txt.
 *
 * 🔑 500 AND NOTHING ELSE, THOUGH THE DESIGN NAMES 500 AND 600 — and the third
 * family the design names, BITTER, IS NOT DOWNLOADED AT ALL. Oswald 600 dresses
 * the wordmark and the buttons; Bitter dresses the body copy, the fields and the
 * RSVP legends. Every one of those is DoorShell's or the door's own, and a skin
 * owns neither (themes-stay-skins.test.ts) — so shipping them would be ~40 KB
 * of type that nothing on the page renders, and `scripts/lint-fonts-are-local.mjs`
 * fails an orphaned face for exactly that reason. Galeriya shipped one of its
 * three weights on the same reasoning.
 */
const oswald = localFont({
  src: [{ path: '../../../../_fonts/oswald/oswald-500.woff2', weight: '500', style: 'normal' }],
  display: 'swap',
  variable: '--font-abaca-utility',
  adjustFontFallback: 'Arial',
});

export function abacaSkin({ photo, accent, monogram }: InviteSkinInput): DoorSkin {
  return {
    className: [styles.abaca ?? '', alfaSlabOne.variable, oswald.variable].join(' '),
    style: { ['--accent' as string]: accent } as React.CSSProperties,
    /*
     * THE GROUND IS ONE SHEET OF PRINTED KRAFT, in three layers that have to
     * stay three: the sheet, the print, the tooth.
     *
     * The print is a SEPARATE element rather than one more layer of the sheet's
     * background list, because it is the only layer that is masked (the wordmark
     * sits on the ground and the print must not reach it — port correction 3),
     * and because `mix-blend-mode: multiply` is what makes the photo ink rather
     * than wallpaper. With no photo the element is not rendered at all and the
     * ground is the plain kraft, pixel for pixel, exactly as the design says.
     */
    ground: (
      <div className={styles.paper}>
        {photo ? (
          <div
            className={styles.print}
            style={{ backgroundImage: `url(${JSON.stringify(photo)})` }}
          />
        ) : null}
        <div className={styles.tooth} />
      </div>
    ),
    crest: (
      <div className={styles.crest}>
        <span className={styles.seal}>{monogram}</span>
      </div>
    ),
    hinge: <div className={styles.hinge} />,
  };
}
