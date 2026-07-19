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
import { useEffect } from 'react';
import { usePrefersReducedMotion } from '@/lib/use-responsive';
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
import type { RevealEffectsLook, VeilLook } from '@/lib/reveal-config';

// gold/molten retired as reveal openings 2026-06-22 (now monogram-editor motions).
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
  /** Mood-Board-derived inherit defaults; the couple's per-event colour
   *  overrides (effects.veilColor / effects.petalColor) win over these. */
  veilColor?: string;
  petalsColor?: string;
  /** Admin Reveal Studio calibration — veil look + rigid particle look — so the
   *  couple's preview matches the tuned reveal set in /admin/reveal-studio. */
  veilLook?: VeilLook;
  effectLook?: RevealEffectsLook;
  /** Fired once the opening finishes auto-playing (lifts away) — lets a parent
   *  reveal the film beneath. Maps to onRevealed (veil) / onOpened (rigid). */
  onDone?: () => void;
  /** Couple's effect toggles + colour overrides. Veil → petals via WebGL
   *  features + veil/petal colour; rigid → the canvas-2D particle layer. */
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
  petalsColor,
  veilLook,
  effectLook,
  onDone = noop,
  effects,
}: Props) {
  // Accessibility: when the visitor has asked the OS to minimise motion, we do
  // NOT mount the animated reveal (WebGL veil / CSS-3D flaps auto-playing on a
  // timer). The live guest overlay (reveal-overlay.tsx) skips the reveal entirely
  // in this case; the preview can't do that because the parent waits on `onDone`
  // to uncover the film beneath. So we render the SAME final visible state the
  // motion would have ended in — a static, lifted/opened still showing the
  // couple's monogram — and fire the completion callback exactly once. The flow
  // still completes; only the motion is removed.
  const reducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    if (!reducedMotion) return;
    // Fire once on mount of the reduced path; `onDone` reference may change
    // identity but the intent ("the reveal finished") is one-shot per mount.
    onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  if (reducedMotion) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        style={{ background: effects?.veilColor ?? veilColor ?? waxColor }}
        aria-hidden
      >
        {markSvg ? (
          <span
            className="block h-2/5 w-2/5 opacity-90 [&>svg]:h-full [&>svg]:w-full"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: markSvg }}
          />
        ) : (
          <span className="font-serif text-3xl tracking-[0.2em] text-black/70">
            {monogram}
          </span>
        )}
      </div>
    );
  }

  if (isVeilTemplate(template)) {
    return (
      <VeilReveal
        veilColor={effects?.veilColor ?? veilColor}
        petalsColor={effects?.petalColor ?? petalsColor}
        look={veilLook}
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
        effectLook={effectLook}
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
      effectLook={effectLook}
    />
  );
}
