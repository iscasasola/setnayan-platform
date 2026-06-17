'use client';

/**
 * HeroHandsComposite — Step 3 of the Alaala orb.
 *
 * Three depth planes create the illusion of the Alaala orb resting between
 * cupped hands:
 *
 *   [ Layer 1 — back  ] Full hands photo
 *   [ Layer 2 — mid   ] AlaalaOrbGL, positioned over the palm center
 *   [ Layer 3 — front ] Same photo again, masked to fingertip region only
 *                        so the fingertips appear *in front of* the orb
 *
 * Props let you tune the composite for any source photo without touching
 * this component — when the final production shot arrives, just update
 * HANDS_SRC and the positioning constants in OurStory.tsx (or pass via props).
 *
 * Default geometry is calibrated for /alaala/hands.webp (1024×1024, palms
 * cupped up, golden center at ~52% from top). The front mask fades from solid
 * to transparent over the 20–30% band so no hard line appears at the seam.
 */

import Image from 'next/image';
import { AlaalaOrbGL } from './AlaalaOrbGL';

type Props = {
  /** Root-relative path to the hands photograph. */
  src?: string;
  /** Natural width of the photo (px). Used by next/image for aspect ratio. */
  width?: number;
  /** Natural height of the photo (px). */
  height?: number;
  /**
   * Vertical centre of the palm hollow as % of photo height.
   * Orb is centred here. Default 52 (calibrated for hands.webp).
   */
  orbCenterY?: number;
  /**
   * Orb diameter as % of the composite width. Default 48.
   */
  orbSize?: number;
  /**
   * Bottom edge of the fingertip mask as % of photo height.
   * Everything above this line is treated as "in front of" the orb.
   * Default 26 (calibrated for hands.webp).
   */
  fingertipEdge?: number;
  /** Extra Tailwind / className applied to the outer wrapper. */
  className?: string;
};

export function HeroHandsComposite({
  src = '/alaala/hands.webp',
  width = 1024,
  height = 1024,
  orbCenterY = 52,
  orbSize = 48,
  fingertipEdge = 26,
  className = '',
}: Props) {
  return (
    <div
      className={`alaala-hands-root ${className}`}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {/* ── Layer 1: background — full hands photo ── */}
      <Image
        src={src}
        width={width}
        height={height}
        alt=""
        aria-hidden
        priority
        className="alaala-hands-photo"
        style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'inherit' }}
      />

      {/* ── Layer 2: orb — sits in the palm hollow ── */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          top: `${orbCenterY}%`,
          width: `${orbSize}%`,
          aspectRatio: '1 / 1',
          transform: 'translate(-50%, -50%)',
          zIndex: 2,
        }}
      >
        <AlaalaOrbGL className="h-full w-full" />
      </div>

      {/* ── Layer 3: fingertips — photo masked to the top band ── */}
      {/*
       * The mask fades from opaque (top) to transparent (at fingertipEdge%).
       * This makes the fingers appear physically in front of the orb while
       * the edge blends naturally into the palm glow below.
       */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${src})`,
          backgroundSize: '100% auto',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
          borderRadius: 'inherit',
          zIndex: 3,
          WebkitMaskImage: `linear-gradient(to bottom,
            black 0%,
            black ${fingertipEdge - 8}%,
            transparent ${fingertipEdge + 4}%
          )`,
          maskImage: `linear-gradient(to bottom,
            black 0%,
            black ${fingertipEdge - 8}%,
            transparent ${fingertipEdge + 4}%
          )`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
