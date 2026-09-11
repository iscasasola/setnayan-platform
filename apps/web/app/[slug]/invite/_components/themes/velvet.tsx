import localFont from 'next/font/local';
import type { DoorSkin } from '@/app/_components/door/door-shell';
import type { InviteSkinInput } from './invite-skin';
import styles from './velvet.module.css';

/**
 * VELVET — the Classy invite theme (Event Hub Pro). See velvet.module.css.
 *
 * The photo is painted as a CSS background whose URL goes through
 * `JSON.stringify` — a quoted, escaped CSS string — so a presigned URL's `&`,
 * `%` or any stray quote can never break out of `url(…)`.
 *
 * 📦 THE FACES ARE DECLARED HERE, NOT IN app/layout.tsx. This module is reached
 * only from the three invite doors (invite-skin ← load-invite-look, server-only),
 * so Velvet's type ships on Velvet's doors and on no other page.
 */

/**
 * Bodoni Moda — the engraved display face.
 *
 * ONE FACE, SEMIBOLD, ROMAN. It is the repo's own
 * `assets/cipher-fonts/bodoni-moda.ttf` (SIL OFL 1.1, see that folder's
 * LICENSES.md), subset to latin and converted to woff2 with fonttools. Its
 * `usWeightClass` is 600 — the design asks Bodoni Moda 400 and italic 400, and
 * NEITHER is in this repo. Declaring the face at its true weight keeps the
 * browser from synthesising a fake: the title is DoorShell's own
 * `font-semibold`, which this face actually has.
 */
const bodoni = localFont({
  src: [{ path: '../../../../_fonts/bodoni-moda/bodoni-moda-600.woff2', weight: '600', style: 'normal' }],
  display: 'swap',
  variable: '--font-velvet-display',
  // Metric-matched fallback while the face loads — with local files it must be
  // stated (app/layout.tsx carries the same note).
  adjustFontFallback: 'Times New Roman',
});

/**
 * Jost — the utility face (owner Q1 = A, 2026-09-11).
 *
 * SIL OFL 1.1, from github.com/google/fonts `ofl/jost` (`Jost[wght].ttf`
 * v3.710, sha256 6343b709…3076), instanced at the two weights the design uses,
 * subset to latin and converted to woff2 with fonttools. The licence travels
 * with it: app/_fonts/jost/OFL.txt.
 */
const jost = localFont({
  src: [
    { path: '../../../../_fonts/jost/jost-400.woff2', weight: '400', style: 'normal' },
    { path: '../../../../_fonts/jost/jost-500.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-velvet-utility',
  adjustFontFallback: 'Arial',
});

export function velvetSkin({ photo, accent, monogram }: InviteSkinInput): DoorSkin {
  return {
    className: [styles.velvet ?? '', bodoni.variable, jost.variable].join(' '),
    style: { ['--accent' as string]: accent } as React.CSSProperties,
    ground: (
      <>
        {photo ? (
          <div className={styles.photo} style={{ backgroundImage: `url(${JSON.stringify(photo)})` }} />
        ) : null}
        <div className={styles.ground} />
      </>
    ),
    crest: (
      <div className={styles.crest}>
        <span className={styles.ring} />
        <span className={styles.engraveOuter} />
        <span className={styles.engraveInner} />
        <span className={styles.seal}>{monogram}</span>
      </div>
    ),
    hinge: (
      <div className={styles.hinge}>
        <i className={styles.gem} />
      </div>
    ),
  };
}
