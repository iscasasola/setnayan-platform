'use client';

import { useEffect, useState, type ComponentProps } from 'react';
import { RevealOverlay } from './reveal-overlay';
import { COVER_PLAY_LIFT_EVENT, COVER_PLAY_OPENING_EVENT, type CoverPlayOpeningDetail } from '../play-sequence';

type OverlayProps = Omit<ComponentProps<typeof RevealOverlay>, 'enabled' | 'preview' | 'premiumUnlocked' | 'oncePerVisit' | 'seenEventId' | 'firstPageOnly' | 'eventTemplate'>;

/**
 * 🎬 ▶ ON THE COVER SCENE PLAYS THE GUESTS' OWN OPENING (owner-approved 2026-10-16; controller 2026-10-17: "the SAME
 * veil guests get on live (the shipped Veil, #6546) … reuse the guest component; don't draw a new one").
 *
 * Mounted in the Maker's canvas only, beside the editor bridge. It draws nothing until `playCover` (`play-sequence.ts`)
 * asks; then it mounts the shipped `RevealOverlay` — the same props the page hands it (`site-body.tsx`) — in its
 * `preview` mode: the closed veil and "Tap or swipe up to unveil", lifting by itself after `liftAfterMs`, touching
 * nothing of the page's (no hold, no "seen" mark, no film signal). A new ▶ is a new veil (`key`); ▶ resting or stopped
 * takes it away. The Sheer veil only — ▶ is asked for it alone (`stage-tools.tsx`); the rigid openings open on a swipe
 * of their seal and have no hands-free lift. The host is trying it, so it is drawn as a Pro page draws it (try then pay — `hostTrial`).
 */
export function CoverPlayOpening(props: OverlayProps) {
  const [run, setRun] = useState<{ n: number; liftAfterMs: number } | null>(null);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const d = (e as CustomEvent<CoverPlayOpeningDetail>).detail;
      if (d?.on) {
        n += 1;
        setRun({ n, liftAfterMs: d.liftAfterMs });
      } else setRun(null);
    };
    window.addEventListener(COVER_PLAY_OPENING_EVENT, on);
    return () => window.removeEventListener(COVER_PLAY_OPENING_EVENT, on);
  }, []);
  if (!run) return null;
  return <RevealOverlay key={run.n} {...props} enabled premiumUnlocked eventTemplate="veil-sheer" preview={{ liftAfterMs: run.liftAfterMs, onLift: () => window.dispatchEvent(new CustomEvent(COVER_PLAY_LIFT_EVENT)) }} />;
}
