'use client';

/**
 * StdTouchGlow — a soft light that blooms where a finger presses on the
 * Save-the-Date, like a floor that glows where you step in a film.
 *
 * A `screen`-blended radial bloom appears at each touch/press, follows the
 * finger while held, and fades out on release. Multiple fingers → multiple
 * blooms (tracked per pointerId). Honors prefers-reduced-motion (renders
 * nothing). Admin-tunable colour/intensity/size (lib/reveal-config touchGlow).
 *
 * Two modes:
 *   • Live (default) — full-viewport, `pointer-events-none` at z-[80] (above the
 *     reveal z-[60] and film z-[50]/[70]); listens on `window`. Mounted by
 *     RevealOverlayServer during the STD phase.
 *   • Scoped (pass `containerRef`) — confined to that element + positioned
 *     relative to it, listening on it (capture phase, so the veil's grab-zone
 *     can't swallow the press). Used by the admin Reveal Studio's live preview
 *     so HQ can see + tune the glow in place.
 */

import { useEffect, useRef, useState, type RefObject } from 'react';

type Glow = { uid: number; x: number; y: number; out: boolean };

export function StdTouchGlow({
  enabled = true,
  color = '#FBE9C8',
  intensity = 55,
  size = 50,
  containerRef,
}: {
  enabled?: boolean;
  color?: string;
  intensity?: number;
  size?: number;
  /** When set, scope the glow to this element (admin preview) instead of the
   *  whole viewport — listens on it + positions blooms relative to it. */
  containerRef?: RefObject<HTMLElement | null>;
}) {
  const scoped = Boolean(containerRef);
  const [glows, setGlows] = useState<Glow[]>([]);
  // pointerId → the glow uid it currently drives (a pointerId can be reused, so
  // a monotonic uid avoids a fresh press inheriting a fading one's lifecycle).
  const pointerUid = useRef<Map<number, number>>(new Map());
  const uidSeq = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const target: HTMLElement | Window = containerRef?.current ?? window;

    // Scoped → coords relative to the container box; live → viewport coords.
    const coord = (e: PointerEvent) => {
      const el = containerRef?.current;
      if (el) {
        const r = el.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      }
      return { x: e.clientX, y: e.clientY };
    };

    const down = (e: PointerEvent) => {
      const uid = ++uidSeq.current;
      pointerUid.current.set(e.pointerId, uid);
      const { x, y } = coord(e);
      setGlows((g) => [...g, { uid, x, y, out: false }]);
    };
    const move = (e: PointerEvent) => {
      const uid = pointerUid.current.get(e.pointerId);
      if (uid == null) return; // only pointers that pressed (ignore hover)
      const { x, y } = coord(e);
      setGlows((g) => g.map((it) => (it.uid === uid ? { ...it, x, y } : it)));
    };
    const lift = (e: PointerEvent) => {
      const uid = pointerUid.current.get(e.pointerId);
      if (uid == null) return;
      pointerUid.current.delete(e.pointerId);
      setGlows((g) => g.map((it) => (it.uid === uid ? { ...it, out: true } : it)));
      window.setTimeout(() => setGlows((g) => g.filter((it) => it.uid !== uid)), 700);
    };

    // Capture phase in scoped mode so the veil's grab-zone (a descendant that
    // captures the pointer) can't swallow the press before we see it.
    const opts: AddEventListenerOptions = { passive: true, capture: scoped };
    const d = down as EventListener;
    const m = move as EventListener;
    const u = lift as EventListener;
    target.addEventListener('pointerdown', d, opts);
    target.addEventListener('pointermove', m, opts);
    target.addEventListener('pointerup', u, opts);
    target.addEventListener('pointercancel', u, opts);
    return () => {
      target.removeEventListener('pointerdown', d, opts);
      target.removeEventListener('pointermove', m, opts);
      target.removeEventListener('pointerup', u, opts);
      target.removeEventListener('pointercancel', u, opts);
    };
  }, [enabled, containerRef, scoped]);

  if (!enabled) return null;

  const diameter = Math.round(160 + (Math.min(100, Math.max(0, size)) / 100) * 380);
  const peak = +(0.14 + (Math.min(100, Math.max(0, intensity)) / 100) * 0.46).toFixed(3);

  return (
    <div
      aria-hidden
      className={
        scoped
          ? 'pointer-events-none absolute inset-0 z-30 overflow-hidden'
          : 'pointer-events-none fixed inset-0 z-[80] overflow-hidden'
      }
    >
      {glows.map((g) => (
        <GlowBlob
          key={g.uid}
          scoped={scoped}
          x={g.x}
          y={g.y}
          out={g.out}
          diameter={diameter}
          peak={peak}
          color={color}
        />
      ))}
    </div>
  );
}

function GlowBlob({
  scoped,
  x,
  y,
  out,
  diameter,
  peak,
  color,
}: {
  scoped: boolean;
  x: number;
  y: number;
  out: boolean;
  diameter: number;
  peak: number;
  color: string;
}) {
  // Mount at 0 / scale .7, then flip on next frame so the bloom eases in.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);
  const visible = shown && !out;
  return (
    <span
      aria-hidden
      style={{
        position: scoped ? 'absolute' : 'fixed',
        left: x,
        top: y,
        width: diameter,
        height: diameter,
        marginLeft: -diameter / 2,
        marginTop: -diameter / 2,
        borderRadius: '9999px',
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        mixBlendMode: 'screen',
        pointerEvents: 'none',
        opacity: visible ? peak : 0,
        transform: `scale(${out ? 1.25 : visible ? 1 : 0.7})`,
        transition: out
          ? 'opacity 620ms ease-out, transform 620ms ease-out'
          : 'opacity 200ms ease-out, transform 240ms ease-out',
        willChange: 'opacity, transform',
      }}
    />
  );
}
