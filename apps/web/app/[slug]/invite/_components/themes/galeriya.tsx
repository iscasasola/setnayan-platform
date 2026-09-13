import localFont from 'next/font/local';
import type { DoorSkin } from '@/app/_components/door/door-shell';
import type { InviteSkinInput } from './invite-skin';
import styles from './galeriya.module.css';

/**
 * GALERIYA — the Sophisticated invite theme (Event Hub Pro). See
 * galeriya.module.css for the port and its two measured corrections.
 *
 * The photo is painted as a CSS background whose URL goes through
 * `JSON.stringify` — a quoted, escaped CSS string — so a presigned URL's `&`,
 * `%` or any stray quote can never break out of `url(…)`.
 *
 * 📦 THE FACE IS DECLARED HERE, NOT IN app/layout.tsx. This module is reached
 * only from the three invite doors (invite-skin ← load-invite-look, server-only),
 * so Galeriya's type ships on Galeriya's doors and on no other page.
 */

/**
 * Schibsted Grotesk — the gallery face.
 *
 * ONE FACE, SEMIBOLD. SIL OFL 1.1, from github.com/google/fonts
 * `ofl/schibstedgrotesk` (`SchibstedGrotesk[wght].ttf`, Version 1.100, sha256
 * 6ceeadf6…e823d), instanced at wght 600, subset to latin and converted to
 * woff2 with fonttools. The licence travels with it:
 * app/_fonts/schibsted-grotesk/OFL.txt.
 *
 * 🔑 600 AND NOTHING ELSE, THOUGH THE DESIGN NAMES 400/500/600. The other two
 * weights dress the board's own fields, labels and buttons — and the card, its
 * 3px edge and its one action are DoorShell's, not a skin's
 * (themes-stay-skins.test.ts). Shipping them would be bytes nothing renders,
 * and `scripts/lint-fonts-are-local.mjs` fails an orphaned face for exactly
 * that reason.
 *
 * The theme's OTHER face needs no download at all: the design's DM Mono is
 * already this app's `font-mono` (app/layout.tsx `--font-editorial-mono`), so
 * the eyebrow and the date line are the design's type as DoorShell renders them.
 */
const schibsted = localFont({
  src: [
    {
      path: '../../../../_fonts/schibsted-grotesk/schibsted-grotesk-600.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-galeriya-sans',
  // Metric-matched fallback while the face loads — with local files it must be
  // stated (app/layout.tsx carries the same note).
  adjustFontFallback: 'Arial',
});

export function galeriyaSkin({ photo, accent }: InviteSkinInput): DoorSkin {
  return {
    className: [styles.galeriya ?? '', schibsted.variable].join(' '),
    style: { ['--accent' as string]: accent } as React.CSSProperties,
    /*
     * The wall is the frame's own background; the ground carries the one rule
     * everything ranges off. No photo goes here — in this theme the couple's
     * reveal background is the WORK, hung, not the ground it hangs on.
     */
    ground: <div className={styles.rule} />,
    /*
     * THE WORK, and NOTHING WHEN THERE IS NO PHOTO. The design: "no photo → no
     * work: the wall exactly as it was." An empty frame is not a neutral
     * fallback — it is a picture hook with the picture missing, on the one
     * screen a stranger reads first.
     *
     * 🔒 THE MONOGRAM IS DELIBERATELY UNUSED. Every other Pro theme presses the
     * couple's mark as a seal; this one does not ("this theme sets no seal" —
     * the design's own note). Their name IS the label, at 40px, and a seal
     * above it would be the same two people said twice.
     */
    crest: photo ? (
      <div className={styles.work}>
        <div
          className={styles.print}
          style={{ backgroundImage: `url(${JSON.stringify(photo)})` }}
        />
      </div>
    ) : undefined,
    hinge: <div className={styles.hinge} />,
  };
}
