'use client';

/**
 * Rigid-panel reveals (envelope family · templates 2–4 of 7).
 *
 * The same scroll-scrubbed, swipe-the-seal engine as the four-flap envelope
 * (RigidStage), parameterised over the three remaining rigid openings:
 *   - two-flap-vertical    — splits left | right, the two flaps swing open
 *   - two-flap-horizontal  — splits top | bottom, the two flaps swing open
 *   - church-doors         — two grand arched doors swing wide
 *
 * The flaps SCRUB open with scroll (progress 0→1) — not a tap — after the
 * couple's monogram wax seal is swiped off the paper (§1a). No WebGL dependency,
 * so these stay inside the guest-site bundle / Lighthouse budget. Each flap is
 * two-sided — paper on the front, the liner accent on the back — so as it swings
 * past upright you glimpse the inner colour, exactly like a real envelope.
 * Everything uses the moodboard-recoloured Tailwind tokens (cream / terracotta /
 * mulberry / ink) app/[slug] overrides per event, so it recolours, ₱0.
 */

import type { CSSProperties, ReactNode } from 'react';
import type { WaxSealConfig } from '@/lib/wax-seal/types';
import { RigidStage } from './rigid-stage';
import { RigidFlaps } from './rigid-flaps';

export type RigidVariant = 'two-flap-vertical' | 'two-flap-horizontal' | 'church-doors';

type Props = {
  variant: RigidVariant;
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
};

const FOLD = 'absolute will-change-transform [transform-style:preserve-3d]';

/**
 * One two-sided rigid flap, rotated by `progress` toward `maxDeg` about `axis`.
 * `backRotate` flips the liner face 180° about the flap's own hinge so it shows
 * once the flap turns past upright.
 */
function Flap({
  className,
  faceClass = 'bg-cream',
  backClass = 'bg-terracotta',
  faceStyle,
  backStyle,
  axis,
  maxDeg,
  backRotate,
  progress,
  children,
}: {
  className: string;
  faceClass?: string;
  backClass?: string;
  faceStyle?: CSSProperties;
  backStyle?: CSSProperties;
  axis: 'X' | 'Y';
  maxDeg: number;
  backRotate: string;
  progress: number;
  children?: ReactNode;
}) {
  const transform = `rotate${axis}(${maxDeg * progress}deg)`;
  return (
    <div className={`${FOLD} ${className}`} style={{ transform }}>
      {/* front (paper) */}
      <div
        className={`absolute inset-0 overflow-hidden [backface-visibility:hidden] ${faceClass}`}
        style={{ boxShadow: 'inset 0 0 60px rgba(0,0,0,0.06)', ...faceStyle }}
      >
        {children}
      </div>
      {/* back (liner accent) */}
      <div
        className={`absolute inset-0 overflow-hidden [backface-visibility:hidden] ${backClass}`}
        style={{ transform: backRotate, ...backStyle }}
      />
    </div>
  );
}

/** Decorative two-panel inset + gold trim that turns a plain flap into a door. */
function DoorPanels({ trim }: { trim: 'left' | 'right' }) {
  return (
    <>
      <div className="absolute inset-[9%] flex flex-col gap-[9%]">
        <div className="flex-1 rounded-md ring-1 ring-ink/15 shadow-[inset_0_2px_10px_rgba(0,0,0,0.10)]" />
        <div className="flex-[1.4] rounded-md ring-1 ring-ink/15 shadow-[inset_0_2px_10px_rgba(0,0,0,0.10)]" />
      </div>
      <div
        className="absolute top-[6%] bottom-[6%] w-px bg-[#cb9e4b]/50"
        style={trim === 'left' ? { right: '5%' } : { left: '5%' }}
      />
    </>
  );
}

function flaps(variant: RigidVariant, p: number): ReactNode {
  if (variant === 'two-flap-vertical') {
    return (
      <>
        <Flap className="left-0 top-0 h-full w-1/2 origin-left" axis="Y" maxDeg={-122} backRotate="rotateY(180deg)" progress={p} />
        <Flap className="right-0 top-0 h-full w-1/2 origin-right" axis="Y" maxDeg={122} backRotate="rotateY(180deg)" progress={p} />
      </>
    );
  }
  if (variant === 'two-flap-horizontal') {
    return (
      <>
        <Flap className="left-0 top-0 h-1/2 w-full origin-top" axis="X" maxDeg={122} backRotate="rotateX(180deg)" progress={p} />
        <Flap className="left-0 bottom-0 h-1/2 w-full origin-bottom" axis="X" maxDeg={-122} backRotate="rotateX(180deg)" progress={p} />
      </>
    );
  }
  return (
    <>
      <Flap
        className="left-0 top-0 h-full w-1/2 origin-left"
        axis="Y"
        maxDeg={-138}
        backRotate="rotateY(180deg)"
        backClass="bg-mulberry"
        faceStyle={{ borderTopRightRadius: '42%' }}
        backStyle={{ borderTopRightRadius: '42%' }}
        progress={p}
      >
        <DoorPanels trim="left" />
      </Flap>
      <Flap
        className="right-0 top-0 h-full w-1/2 origin-right"
        axis="Y"
        maxDeg={138}
        backRotate="rotateY(180deg)"
        backClass="bg-mulberry"
        faceStyle={{ borderTopLeftRadius: '42%' }}
        backStyle={{ borderTopLeftRadius: '42%' }}
        progress={p}
      >
        <DoorPanels trim="right" />
      </Flap>
    </>
  );
}

export function RigidReveal({
  variant,
  markSvg,
  monogram,
  waxColor,
  config = null,
  fallbackSeed,
  onOpened,
}: Props) {
  return (
    <RigidStage
      markSvg={markSvg}
      monogramText={monogram}
      waxColor={waxColor}
      config={config}
      fallbackSeed={fallbackSeed}
      onOpened={onOpened}
      renderFlaps={(p) => (
        <RigidFlaps variant={variant} progress={p} cssFallback={flaps(variant, p)} />
      )}
    />
  );
}
