'use client';

/**
 * StdTouchGlow — a soft light that blooms where a finger presses on the
 * Save-the-Date, like a floor that glows where you step in a film.
 *
 * A `screen`-blended radial bloom appears at each touch/press, follows the
 * finger while held, and fades out on release. Multiple fingers → multiple
 * blooms (tracked per pointerId). The whole layer is `pointer-events-none` at
 * z-[80] (above the reveal z-[60] and film z-[50]/[70]), so it brightens the
 * scene without ever blocking a tap. Honors prefers-reduced-motion (renders
 * nothing). Admin-tunable colour/intensity/size (lib/reveal-config touchGlow);
 * mounted by RevealOverlayServer during the STD phase when enabled.
 */

import { useEffect, useRef, useState } from 'react';

type Glow = { uid: number; x: number; y: number; out: boolean };

export function StdTouchGlow({
  enabled = true,
  color = '#FBE9C8',
  intensity = 55,
  size = 50,
}: {
  enabled?: boolean;
  color?: string;
  intensity?: number;
  size?: number;
}) {
  const [glows, setGlows] = useState<Glow[]>([]);
  // pointerId → the glow uid it currently drives (a pointerId can be reused, so
  // a monotonic uid avoids a fresh press inheriting a fading one's lifecycle).
  const pointerUid = useRef<Map<number, number>>(new Map());
  const uidSeq = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const down = (e: PointerEvent) => {
      const uid = ++uidSeq.current;
      pointerUid.current.set(e.pointerId, uid);
      setGlows((g) => [...g, { uid, x: e.clientX, y: e.clientY, out: false }]);
    };
    const move = (e: PointerEvent) => {
      const uid = pointerUid.current.get(e.pointerId);
      if (uid == null) return; // only pointers that pressed (ignore hover)
      setGlows((g) => g.map((it) => (it.uid === uid ? { ...it, x: e.clientX, y: e.clientY } : it)));
    };
    const lift = (e: PointerEvent) => {
      const uid = pointerUid.current.get(e.pointerId);
      if (uid == null) return;
      pointerUid.current.delete(e.pointerId);
      setGlows((g) => g.map((it) => (it.uid === uid ? { ...it, out: true } : it)));
      window.setTimeout(() => setGlows((g) => g.filter((it) => it.uid !== uid)), 700);
    };

    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', lift, { passive: true });
    window.addEventListener('pointercancel', lift, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', lift);
      window.removeEventListener('pointercancel', lift);
    };
  }, [enabled]);

  if (!enabled) return null;

  const diameter = Math.round(160 + (Math.min(100, Math.max(0, size)) / 100) * 380);
  const peak = +(0.14 + (Math.min(100, Math.max(0, intensity)) / 100) * 0.46).toFixed(3);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      {glows.map((g) => (
        <GlowBlob key={g.uid} x={g.x} y={g.y} out={g.out} diameter={diameter} peak={peak} color={color} />
      ))}
    </div>
  );
}

function GlowBlob({
  x,
  y,
  out,
  diameter,
  peak,
  color,
}: {
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
        position: 'fixed',
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
