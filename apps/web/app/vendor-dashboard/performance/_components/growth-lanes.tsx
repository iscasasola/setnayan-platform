'use client';

import { useId } from 'react';
import { EASE_GROW, useTween } from './growth-motion';

/**
 * 📈 GROWTH LANES — the hero of Shop › Analytics (owner-approved 6 Nov 2026, "Analytics, growing"): opened → asked →
 * booked over the window, ONE x-axis, each lane its own scale (a lane chart IS the funnel over time).
 *
 *   · opened = area + line under a clip whose width tweens 0 → W over 900 ms on the `.perf-bar-grow-y` curve;
 *   · asked and booked = bars growing from their baseline exactly as `.perf-bar-grow-y` (BookingsBars), 600 ms, at
 *     +220 ms and +380 ms;
 *   · an EMPTY lane = a dashed baseline with what fills it ("Your first inquiry lands here") — never a zero chart;
 *   · an UNREAD lane = the same calm outline saying "Couldn’t load" — never a flat line that reads as "nobody".
 */
const W = 358;
const GAP = 8;
const LANES = [
  { kind: 'views', h: 60, word: 'opened', ghost: 'Your first profile view lands here' },
  { kind: 'asked', h: 26, word: 'asked', ghost: 'Your first inquiry lands here' },
  { kind: 'booked', h: 30, word: 'booked', ghost: 'Your first booking lands here' },
] as const;

function Bar({ k, x, y, w, h, bottom, cx, cls, delay }: { k: string; x: number; y: number; w: number; h: number; bottom: number; cx: number; cls: string; delay: number }) {
  const s = useTween(k, 1, { dur: 600, ease: EASE_GROW, delay });
  return (
    <rect
      className={cls}
      x={x.toFixed(1)}
      y={y.toFixed(1)}
      width={w.toFixed(1)}
      height={h.toFixed(1)}
      rx={1.5}
      style={{ transformOrigin: `${cx.toFixed(1)}px ${bottom}px`, transform: `scaleY(${s})` }}
    />
  );
}

function Clip({ id, top, h }: { id: string; top: number; h: number }) {
  const w = useTween('lane:views:clip', W, { dur: 900, ease: EASE_GROW });
  return (
    <clipPath id={id}>
      <rect x={0} y={top - 2} height={h + 4} width={Math.max(0, w)} />
    </clipPath>
  );
}

export function GrowthLanes({
  unit,
  labels,
  views,
  asked,
  booked,
}: {
  unit: 'day' | 'month';
  labels: readonly string[];
  views: readonly number[] | null;
  asked: readonly number[] | null;
  booked: readonly number[] | null;
}) {
  const uid = useId().replace(/[:]/g, '');
  const n = labels.length;
  const pad = 1;
  const xs = (i: number) => pad + (i * (W - 2 * pad)) / Math.max(1, n - 1);
  const data = { views, asked, booked };
  let y = 4;
  const parts: React.ReactNode[] = [];
  let clip: React.ReactNode = null;
  LANES.forEach((lane, li) => {
    const arr = data[lane.kind];
    const top = y;
    const bottom = y + lane.h;
    parts.push(<line key={`b${li}`} className="ag-base" x1={0} x2={W} y1={bottom} y2={bottom} />);
    const max = arr ? Math.max(...arr, 0) : 0;
    if (!arr || max === 0) {
      const word = arr ? lane.ghost : 'Couldn’t load';
      parts.push(
        <g key={`g${li}`}>
          <line className="ag-ghostline" x1={2} x2={W - 2} y1={bottom - lane.h / 2} y2={bottom - lane.h / 2} />
          <rect x={W / 2 - 92} y={bottom - lane.h / 2 - 9} width={184} height={18} fill="var(--sn-canvas)" />
          <text className="ag-ghost" x={W / 2} y={bottom - lane.h / 2 + 4} textAnchor="middle">
            {word}
          </text>
        </g>,
      );
    } else if (lane.kind === 'views') {
      const pts = arr.map((v, i) => [xs(i), bottom - 4 - (v / max) * (lane.h - 12)] as const);
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      const last = pts[pts.length - 1]!;
      const area = `${d} L${last[0].toFixed(1)},${bottom} L${pts[0]![0]},${bottom} Z`;
      const cid = `ag-clip-${uid}`;
      clip = <Clip id={cid} top={top} h={lane.h} />;
      parts.push(
        <g key={`v${li}`} clipPath={`url(#${cid})`}>
          <path className="ag-varea" d={area} />
          <path className="ag-vline" d={d} />
          <circle className="ag-vdot" cx={last[0]} cy={last[1]} r={3} />
        </g>,
      );
    } else {
      const bw = Math.max(3, (W / n) * (n > 12 ? 0.5 : 0.42));
      arr.forEach((v, i) => {
        if (!v) return;
        const cx = ((i + 0.5) * W) / n;
        const bh = Math.max(3, (v / max) * (lane.h - 6));
        parts.push(
          <Bar
            key={`${lane.kind}${i}`}
            k={`lane:${lane.kind}:${i}`}
            x={cx - bw / 2}
            y={bottom - bh}
            w={bw}
            h={bh}
            bottom={bottom}
            cx={cx}
            cls={lane.kind === 'asked' ? 'ag-abar' : 'ag-bbar'}
            delay={lane.kind === 'asked' ? 220 : 380}
          />,
        );
      });
    }
    y = bottom + GAP;
  });
  const ly = y + 10;
  if (unit === 'day') {
    [0, 7, 14, 21, n - 1].forEach((i) => {
      if (i < 0 || i >= n) return;
      parts.push(
        <text key={`x${i}`} className="ag-xl" x={xs(i)} y={ly} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
          {labels[i]}
        </text>,
      );
    });
  } else {
    labels.forEach((l, j) =>
      parts.push(
        <text key={`x${j}`} className="ag-xl" x={((j + 0.5) * W) / n} y={ly} textAnchor="middle">
          {l.charAt(0)}
        </text>,
      ),
    );
  }
  const H = ly + 4;
  return (
    <svg className="ag-lanes" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="opened, asked, booked over the window" data-growth-lanes={unit}>
      <defs>{clip}</defs>
      {parts}
    </svg>
  );
}

export function LaneKeys({ tip }: { tip: React.ReactNode }) {
  return (
    <div className="ag-keys">
      <span>
        <i style={{ background: 'var(--m-orange)' }} />
        opened
      </span>
      <span>
        <i style={{ background: 'rgb(var(--sn-accent))' }} />
        asked
      </span>
      <span>
        <i style={{ background: 'var(--m-orange-2)' }} />
        booked
      </span>
      <span className="ag-sp" />
      {tip}
    </div>
  );
}
