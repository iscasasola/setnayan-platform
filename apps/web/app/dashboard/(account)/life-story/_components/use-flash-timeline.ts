'use client';

/**
 * Life Story · the flash timeline (Build Plan §6).
 *
 * One GSAP timeline over pre-rendered beat layers. SAFETY IS STRUCTURAL:
 * the only tweens this hook ever creates are slow opacity cross-dissolves
 * (≥ CROSSFADE_S ease), a gentle Ken Burns scale, and a linear progress bar —
 * no keyframe can produce a strobe. Dwell comes from compileBeats(); the
 * timeline renders the arc, it never reorders it.
 *
 * Follows the repo's useGSAP({ scope }) convention (gsap.context auto-cleanup)
 * — see app/_components/marketing/_premium.tsx.
 */

import { useRef, type RefObject } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export const CROSSFADE_S = 1.15;
/** Hold on the final (present_forward) layer before onComplete fires. */
const ENDING_HOLD_S = 0.9;

export type FlashTimelineHandle = {
  pause: () => void;
  resume: () => void;
};

export function useFlashTimeline({
  scope,
  active,
  dwellsMs,
  onBeatChange,
  onComplete,
}: {
  scope: RefObject<HTMLDivElement | null>;
  /** Build + play while true; kill on false. */
  active: boolean;
  /** One entry per beat; null = the ending (fades in, never out). */
  dwellsMs: Array<number | null>;
  onBeatChange: (index: number) => void;
  onComplete: () => void;
}): FlashTimelineHandle {
  const timeline = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      if (!active || dwellsMs.length === 0) return;

      const layers = gsap.utils.toArray<HTMLElement>('[data-beat-layer]', scope.current);
      const medias = gsap.utils.toArray<HTMLElement>('[data-beat-media]', scope.current);
      const bar = scope.current?.querySelector<HTMLElement>('[data-progress-bar]') ?? null;
      if (layers.length === 0) return;

      gsap.set(layers, { autoAlpha: 0 });
      if (bar) gsap.set(bar, { scaleX: 0 });

      const tl = gsap.timeline({ onComplete });
      let at = 0;
      layers.forEach((layer, i) => {
        const dwellS = (dwellsMs[i] ?? 0) / 1000;
        const isLast = i === layers.length - 1;

        tl.call(() => onBeatChange(i), [], at);
        tl.to(layer, { autoAlpha: 1, duration: CROSSFADE_S, ease: 'power2.inOut' }, at);

        // Gentle Ken Burns on the layer's media, running through its dwell.
        const media = medias.find((m) => m.dataset.beatMedia === String(i));
        if (media) {
          tl.to(
            media,
            {
              scale: 1.1,
              xPercent: -1,
              duration: CROSSFADE_S + dwellS + (isLast ? 0 : CROSSFADE_S),
              ease: 'none',
            },
            at,
          );
        }

        at += CROSSFADE_S + dwellS;
        if (!isLast) {
          // Cross-dissolve: this layer fades out exactly as the next fades in.
          tl.to(layer, { autoAlpha: 0, duration: CROSSFADE_S, ease: 'power2.inOut' }, at);
        }
      });
      tl.to({}, { duration: ENDING_HOLD_S }, at); // settle on the ending

      if (bar) {
        tl.to(bar, { scaleX: 1, duration: tl.duration(), ease: 'none' }, 0);
      }

      timeline.current = tl;
      return () => {
        timeline.current = null;
        tl.kill();
      };
    },
    { scope, dependencies: [active] },
  );

  return {
    pause: () => timeline.current?.pause(),
    resume: () => timeline.current?.play(),
  };
}
