'use client';

/**
 * RevealPreview — mounts ONE opening template in auto-play, low-resolution,
 * non-interactive mode, filling its (device-screen) container.
 *
 * Reuses the exact live-page reveal components so the couple previews what
 * guests get — but `autoPlay`/`autoplay` skips the seal-swipe / drag-to-lift
 * gestures (un-draggable in a small frame) and ramps the open on a timer, and
 * the rigid templates force the cheap CSS-3D path (no per-preview WebGL). Only
 * the veil spins up a single low-DPR WebGL context.
 *
 * Render this inside a `relative` box (e.g. DeviceFrame's screen); the reveal
 * components mount `absolute inset-0`.
 */

import dynamic from 'next/dynamic';
import { FourFlapEnvelope } from '@/app/[slug]/_components/reveal/four-flap';
import { RigidReveal } from '@/app/[slug]/_components/reveal/rigid-reveal';
import {
  isVeilTemplate,
  type RevealTemplate,
} from '@/app/[slug]/_components/reveal/reveal-templates';
import type { WaxSealConfig } from '@/lib/wax-seal/types';
import {
  rigidEffectFor,
  type RevealEffects,
} from '@/lib/std-reveal-effects';

const VeilReveal = dynamic(() => import('@/app/[slug]/_components/reveal/veil-reveal'), {
  ssr: false,
});

const noop = () => {};

type Props = {
  template: RevealTemplate;
  /** The couple's monogram SVG — pressed into the wax seal / carved into doors. */
  markSvg?: string | null;
  /** Lettered fallback for the seal, e.g. "A & J". */
  monogram: string;
  waxColor?: string;
  sealConfig?: WaxSealConfig | null;
  sealFallbackSeed?: number;
  veilColor?: string;
  /** Fired once the opening finishes auto-playing (lifts away) — lets a parent
   *  reveal the film beneath. Maps to onRevealed (veil) / onOpened (rigid). */
  onDone?: () => void;
  /** Couple's effect toggles. Veil → petals via WebGL features; rigid → the
   *  canvas-2D particle layer (butterflies for envelopes, petals for doors). */
  effects?: RevealEffects;
};

export function RevealPreview({
  template,
  markSvg = null,
  monogram,
  waxColor = '#5c2542',
  sealConfig = null,
  sealFallbackSeed,
  veilColor = '#f3ece1',
  onDone = noop,
  effects,
}: Props) {
  if (isVeilTemplate(template)) {
    return (
      <VeilReveal
        veilColor={veilColor}
        onRevealed={onDone}
        autoplay
        lowRes
        features={{ petals: effects?.petals ?? true, logo: true, music: false }}
      />
    );
  }
  const effect = effects ? rigidEffectFor(template, effects) : null;
  if (
    template === 'two-flap-vertical' ||
    template === 'two-flap-horizontal' ||
    template === 'church-doors'
  ) {
    return (
      <RigidReveal
        variant={template}
        markSvg={markSvg}
        monogram={monogram}
        waxColor={waxColor}
        config={sealConfig}
        fallbackSeed={sealFallbackSeed}
        onOpened={onDone}
        autoPlay
        effect={effect}
      />
    );
  }
  return (
    <FourFlapEnvelope
      markSvg={markSvg}
      monogram={monogram}
      waxColor={waxColor}
      config={sealConfig}
      fallbackSeed={sealFallbackSeed}
      onOpened={onDone}
      autoPlay
      effect={effect}
    />
  );
}
