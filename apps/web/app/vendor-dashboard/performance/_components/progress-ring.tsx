'use client';

import type { ReactNode } from 'react';
import { EASE_GROW, useTween } from './growth-motion';

/**
 * ◯ PROGRESS RING — `CompositeRing`'s geometry (health-composite-card.tsx: round caps, −90°, the ring's own track)
 * extracted with a stroke-dashoffset sweep, 900 ms on the grow curve (Shop › Analytics, owner-approved 6 Nov 2026). One
 * ring for the badge tracker (64 px, r 26) and the health score (112 px, r 45.5 — the shipped 128-viewBox proportions).
 * `ghost` = a dashed track with no value: nothing measured yet, never a 0 % ring.
 */
function Value({ size, r, sw, pct, id, delay }: { size: number; r: number; sw: number; pct: number; id: string; delay: number }) {
  const c = 2 * Math.PI * r;
  const v = useTween(id, pct, { dur: 900, ease: EASE_GROW, delay });
  return <circle className="ag-rval" cx={size / 2} cy={size / 2} r={r} strokeWidth={sw} strokeDasharray={c} style={{ strokeDashoffset: c * (1 - v / 100) }} />;
}

export function ProgressRing({
  size,
  r,
  sw,
  pct,
  id,
  ghost = false,
  delay = 0,
  children,
}: {
  size: number;
  r: number;
  sw: number;
  /** 0–100. */
  pct: number;
  id: string;
  ghost?: boolean;
  delay?: number;
  children?: ReactNode;
}) {
  return (
    <div className="ag-ringwrap" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
        <circle className={ghost ? 'ag-rtrk ag-ghost' : 'ag-rtrk'} cx={size / 2} cy={size / 2} r={r} strokeWidth={ghost ? 1.5 : sw} />
        {ghost ? null : <Value size={size} r={r} sw={sw} pct={Math.max(0, Math.min(100, pct))} id={id} delay={delay} />}
      </svg>
      <div className="ag-lbl">{children}</div>
    </div>
  );
}
