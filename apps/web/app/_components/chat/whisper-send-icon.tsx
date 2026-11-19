'use client';

/**
 * 🤫 THE ONE SEND ICON: PLANE ⇄ WHISPER BUBBLE (DECISION_LOG 2026-11-19 "PLANE → WHISPER, IN ORDER" · "WHISPER → PLANE,
 * IN ORDER" · "MESSAGE ⇄ WHISPER APPROVED"; drawing `prototypes/chat_send_to_private_2026-11-19.html`).
 *
 *   ON   the triangle morphs into a rounded square → its small line swings down to be the chat tip → three dots show
 *        one by one.
 *   OFF  the dots break into specks and go, last first → the square morphs back into the triangle → the line swings in
 *        and completes the plane.
 *
 * The paths, their order, the overlaps and the curves are the drawing's (`lib/chat-whisper.ts` — `PLANE_D`, `BUBBLE_D`,
 * `whisperTracks`). The drawing morphs with SMIL `<animate d>`; here ONE small frame loop writes the same numbers into
 * the same path, because that plays the same in iPhone Safari, Chrome and Firefox (CSS `d:` does not exist in Safari)
 * AND it turns around from where it is when the box is dragged again mid-change — SMIL finishes first.
 *
 * Reduced motion: no morph — the icon swaps at once (the drawing's own note). The server and the first paint draw the
 * resting icon for `on`, so there is nothing to wait for.
 */
import { useEffect, useRef } from 'react';
import {
  CREASE_D,
  WHISPER_DOTS,
  WHISPER_DOT_R,
  WHISPER_SPECKS,
  WHISPER_SPECK_R,
  creaseAt,
  shapeAt,
  speckOpacity,
  whisperEase,
  whisperTracks,
} from '@/lib/chat-whisper';

type Pose = { shape: number; crease: number; dot0: number; dot1: number; dot2: number; speck: number };
type Key = keyof Pose;

const rest = (on: boolean): Pose => (on ? { shape: 1, crease: 1, dot0: 1, dot1: 1, dot2: 1, speck: 1 } : { shape: 0, crease: 0, dot0: 0, dot1: 0, dot2: 0, speck: 1 });

/** A dot arriving grows from 0.4 to 1; a dot leaving swells to 1.15 as it fades (the drawing's `s-dot1/2/3`). */
function dotScale(k: number, arriving: boolean): number {
  return arriving ? 0.4 + 0.6 * k : 1.15 - 0.15 * k;
}

export function WhisperSendIcon({ on, className }: { on: boolean; className?: string }) {
  const svg = useRef<SVGSVGElement | null>(null);
  const pose = useRef<Pose>(rest(on));
  const first = useRef(true);

  useEffect(() => {
    const root = svg.current;
    if (!root) return;
    const shape = root.querySelector<SVGPathElement>('[data-whisper-shape]');
    const crease = root.querySelector<SVGPathElement>('[data-whisper-crease]');
    const dots = Array.from(root.querySelectorAll<SVGCircleElement>('[data-whisper-dot]'));
    const specks = Array.from(root.querySelectorAll<SVGCircleElement>('[data-whisper-speck]'));
    if (!shape || !crease) return;

    const paint = (p: Pose, arriving: boolean) => {
      shape.setAttribute('d', shapeAt(p.shape));
      crease.setAttribute('transform', creaseAt(p.crease));
      dots.forEach((dot, i) => {
        const k = p[`dot${i}` as Key];
        const at = WHISPER_DOTS[i]!;
        const s = dotScale(k, arriving);
        dot.setAttribute('opacity', String(Math.round(k * 1000) / 1000));
        dot.setAttribute('transform', `translate(${at.cx} ${at.cy}) scale(${Math.round(s * 1000) / 1000}) translate(${-at.cx} ${-at.cy})`);
      });
      specks.forEach((speck, i) => {
        const drift = WHISPER_SPECKS[i % WHISPER_SPECKS.length]!;
        const k = arriving ? 1 : p.speck;
        speck.setAttribute('opacity', String(Math.round(speckOpacity(k) * 1000) / 1000));
        speck.setAttribute('transform', `translate(${Math.round(drift.dx * k * 1000) / 1000} ${Math.round(drift.dy * k * 1000) / 1000})`);
      });
    };

    // The first paint is already the resting icon (drawn by the markup below) — nothing moves on arrival.
    if (first.current) {
      first.current = false;
      return;
    }
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) {
      pose.current = rest(on);
      paint(pose.current, on);
      return;
    }

    // Every part leaves from WHERE IT IS (a second drag mid-change turns it around), to its end, on its own clock.
    const from: Pose = { ...pose.current, speck: on ? 1 : 0 };
    const tracks = whisperTracks(on);
    const total = Math.max(...tracks.map((t) => t.delay + t.dur));
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = now - start;
      const next: Pose = { ...from };
      for (const track of tracks) {
        const key = track.key as Key;
        const x = track.dur <= 0 ? 1 : Math.max(0, Math.min(1, (t - track.delay) / track.dur));
        next[key] = from[key] + (track.to - from[key]) * whisperEase(track.ease, x);
      }
      pose.current = next;
      paint(next, on);
      if (t < total) frame = requestAnimationFrame(tick);
      else {
        pose.current = rest(on);
        paint(pose.current, on);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [on]);

  const at = rest(on);
  return (
    <svg
      ref={svg}
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      overflow="visible"
      aria-hidden
      data-whisper-send-icon={on ? 'whisper' : 'plane'}
    >
      <path data-whisper-shape="" d={shapeAt(at.shape)} />
      <path data-whisper-crease="" d={CREASE_D} transform={creaseAt(at.crease)} />
      {WHISPER_DOTS.map((dot, i) => (
        <circle key={`d${i}`} data-whisper-dot="" cx={dot.cx} cy={dot.cy} r={WHISPER_DOT_R} fill="currentColor" stroke="none" opacity={on ? 1 : 0} />
      ))}
      {WHISPER_DOTS.flatMap((dot, i) =>
        WHISPER_SPECKS.map((_, j) => (
          <circle key={`s${i}-${j}`} data-whisper-speck="" cx={dot.cx} cy={dot.cy} r={WHISPER_SPECK_R} fill="currentColor" stroke="none" opacity={0} />
        )),
      )}
    </svg>
  );
}
