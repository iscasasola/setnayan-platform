'use client';

/**
 * Four-flap envelope reveal (rigid family · template 1 of 7).
 *
 * A full-screen paper "envelope" whose four triangular flaps are pinned to the
 * screen edges and fold away to their corners, uncovering the invitation beneath.
 * The fold is SCRUBBED by scroll (progress 0→1 from RigidStage) — not a tap — and
 * is gated by swiping the couple's monogram wax seal off the paper first (§1a).
 *
 * Pure CSS 3D — no WebGL dependency, so it stays inside the guest-site bundle /
 * Lighthouse budget. Colour: the moodboard-recoloured Tailwind tokens (cream /
 * ink) that app/[slug] overrides per event via buildSitePaletteVars, so it
 * recolours automatically, ₱0. The wax seal carries the deep-accent colour.
 */

import type { WaxSealConfig } from '@/lib/wax-seal/types';
import { RigidStage } from './rigid-stage';
import { RigidFlaps } from './rigid-flaps';

type Props = {
  /** The couple's monogram SVG markup (uploaded/custom). Null → lettered seal. */
  markSvg: string | null;
  /** Lettered fallback for the seal, e.g. "A & J". */
  monogram: string;
  /** Wax seal colour (hex) — the moodboard deep accent. */
  waxColor: string;
  /** The minted wax-seal recipe (null → default levers seeded by fallbackSeed). */
  config?: WaxSealConfig | null;
  /** Stable seed for an un-minted seal (public_id-derived). */
  fallbackSeed?: number;
  /** Fired once the flaps have scrubbed fully open. */
  onOpened: () => void;
  /** Preview/demo mode — auto-plays the open, ignores gestures (dashboard chooser). */
  autoPlay?: boolean;
};

const flap = 'absolute inset-0 bg-cream will-change-transform';

export function FourFlapEnvelope({
  markSvg,
  monogram,
  waxColor,
  config = null,
  fallbackSeed,
  onOpened,
  autoPlay = false,
}: Props) {
  return (
    <RigidStage
      markSvg={markSvg}
      monogramText={monogram}
      waxColor={waxColor}
      config={config}
      fallbackSeed={fallbackSeed}
      onOpened={onOpened}
      autoPlay={autoPlay}
      renderFlaps={(p) => {
        const off = 101 * p;
        const css = (
          <>
            {/* top */}
            <div
              className={flap}
              style={{
                clipPath: 'polygon(0 0, 100% 0, 50% 50%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
                transform: `translateY(${-off}%)`,
              }}
            />
            {/* bottom */}
            <div
              className={flap}
              style={{ clipPath: 'polygon(0 100%, 100% 100%, 50% 50%)', transform: `translateY(${off}%)` }}
            />
            {/* left */}
            <div
              className={flap}
              style={{ clipPath: 'polygon(0 0, 0 100%, 50% 50%)', transform: `translateX(${-off}%)` }}
            />
            {/* right */}
            <div
              className={flap}
              style={{ clipPath: 'polygon(100% 0, 100% 100%, 50% 50%)', transform: `translateX(${off}%)` }}
            />
          </>
        );
        return <RigidFlaps variant="four-flap" progress={p} cssFallback={css} forcePreviewCss={autoPlay} />;
      }}
    />
  );
}
