'use client';

/**
 * FormingMark — the Setnayan mark at the head of the sign-in and create-account cards, drawn inline so it can FORM
 * (owner 24 Nov 2026, DECISION_LOG "Sign in and Create account: simple, dark, a forming logo"; approved drawing
 * `prototypes/login_simple_dark_2026-11-24/login_simple_dark_2026-11-24_fable.html`, its `.mark` SVG and CSS).
 *
 * The three filled paths are the shipped mark (`public/brand/setnayan-mark.svg`, split at each `z m`). On mount:
 *   1. four solid gold arcs circle one round (the Rise speed), growing from a short dash to their length, and stop
 *      exactly as the ring's quarters (pathLength 360);
 *   2. at that moment the filled mark shows (visibility — nothing fades), its inside held back by a black disc;
 *   3. the disc shrinks to nothing over the same Rise speed, so every inner line grows inward together and they all
 *      end at the same moment.
 * Plays once. Under reduced motion the finished mark shows at once. The mask id is per instance (`useId`), so two
 * cards on one page never share a mask.
 */
import { useId, type CSSProperties } from 'react';
import { SETNAYAN_GOLD } from '@/lib/qr-look';
import styles from './forming-mark.module.css';

const MARK_TRANSFORM = 'matrix(1.3333333,0,0,-1.3333333,0,5333.3333)';
const MARK_PATHS = [
  'M 1859.526,3749.781 C 1458.028,3717.757 1065.454,3548.554 758.3406,3241.44 451.2286,2934.328 282.2397,2541.742 250.2195,2140.255 l 1326.8215,1.536 V 661.7647 C 1368.543,727.4195 1172.067,841.5416 1006.804,1006.804 768.3191,1245.29 633.8543,1548.261 602.7217,1859.526 H 250 C 282.024,1458.028 451.2265,1065.455 758.3406,758.3406 1065.453,451.2287 1458.039,282.2396 1859.526,250.2195 V 2422.739 H 661.7647 c 65.6549,208.498 179.7773,404.975 345.0393,570.237 238.486,238.486 541.457,372.95 852.722,404.083 z',
  'M 2140.474,3749.781 l 1.537,-1609.307 h 280.948 v 1197.761 c 208.498,-65.655 404.974,-179.776 570.237,-345.039 238.485,-238.486 372.95,-541.457 404.082,-852.722 H 3750 c -32.024,401.498 -201.226,794.071 -508.341,1101.185 -307.112,307.112 -699.697,476.101 -1101.185,508.122 z',
  'M 2140.474,1859.526 c 32.025,-401.498 201.227,-794.073 508.341,-1101.1854 0.658,-0.6584 1.316,-1.3173 1.975,-1.9754 -80.395,-42.041 -163.892,-76.0428 -249.331,-101.7389 -85.439,-25.696 -172.821,-43.0864 -260.985,-51.9046 V 250.2195 c 401.497,32.0253 794.073,201.0094 1101.185,508.1211 307.114,307.1134 476.317,699.6874 508.341,1101.1854 h -352.722 c -31.132,-311.265 -165.597,-614.236 -404.082,-852.722 -15.719,-15.7189 -32.464,-29.741 -48.727,-44.5564 -15.975,14.4789 -31.774,29.1397 -47.191,44.5564 -238.485,238.486 -372.95,541.457 -404.082,852.722 z',
] as const;

/** The mark's own gold (art, the same in both themes — the shipped mark file), handed to the CSS as one variable. */
const GOLD = { '--sn-mark-gold': SETNAYAN_GOLD } as CSSProperties;

/** The centre of the 5333 viewBox, and the ring the arcs draw (radius and the disc that holds the inside back). */
const C = 2666.67;
const RING_R = 2098;
const INSIDE_R = 1863;
/** The four arcs, each a quarter of the ring, in the drawing's order. */
const ARCS = [styles.a1, styles.a2, styles.a3, styles.a4] as const;

export function FormingMark({ className }: { className?: string }) {
  const maskId = `sn-fm-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  return (
    <svg
      className={[styles.mark, className].filter(Boolean).join(' ')}
      viewBox="0 0 5333 5333"
      role="img"
      aria-label="Setnayan"
      data-forming-mark=""
      style={GOLD}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="5333" height="5333">
          <rect width="5333" height="5333" fill="white" />
          <circle className={styles.inside} cx={C} cy={C} r={INSIDE_R} fill="black" />
        </mask>
      </defs>
      <g className={styles.ring}>
        {ARCS.map((a) => (
          <circle key={a} className={a} cx={C} cy={C} r={RING_R} pathLength={360} />
        ))}
      </g>
      <g className={styles.fill} mask={`url(#${maskId})`}>
        {MARK_PATHS.map((d) => (
          <path key={d.slice(0, 24)} d={d} transform={MARK_TRANSFORM} />
        ))}
      </g>
    </svg>
  );
}
