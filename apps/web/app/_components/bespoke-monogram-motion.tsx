'use client';

import React, { useId } from 'react';
import type { MonogramMotionKey } from '@/lib/monogram-motion';

/**
 * BespokeMonogramMotion — plays one of the six Monogram Motion Library signatures
 * (lib/monogram-motion.ts) on a couple's BESPOKE custom SVG mark.
 *
 * WHY a separate renderer: AnimatedMonogramHero plays the signatures at the
 * GLYPH level (stroke-tracing letterforms, sweeping foil across <text>) — it
 * needs real letters. A bespoke / AI mark is an arbitrary sanitized SVG with no
 * accessible letterforms, so each signature is re-expressed as a WHOLE-MARK
 * effect on the rendered mark (owner 2026-06-22 "play according to the settings
 * created" — the couple's chosen motion must show on their actual mark, not a
 * generic bloom):
 *
 *   draw      — the mark wipes on left→right (a drawn-live feel)
 *   foil      — the mark appears, then a band of gold light sweeps ACROSS it
 *               (the sweep is masked to the mark's own shape, so the foil rides
 *               the artwork — the closest whole-mark analogue of the glyph foil)
 *   bloom     — the mark blooms outward from the centre (growing circular clip)
 *   editorial — the mark rises + settles
 *   halo      — a ring sweeps around the mark, then the mark fades up inside it
 *   stardust  — gold sparks twinkle around the mark as it settles in
 *
 * Pure SVG/CSS, SSR-safe, no animation runtime. Every signature collapses to the
 * static mark under `prefers-reduced-motion: reduce` (WCAG 2.2 § 2.3.3). The mark
 * itself is an inert data-URI <img> (the SVG was allowlist-sanitized server-side).
 *
 * REPLAY: callers key this component (e.g. by the active beat) so a remount
 * re-plays the signature the moment the mark is shown — see FilmMonogram.
 */

const SPARK_GOLD = '#C5A059';

// Deterministic spark layout in a 0..100 viewBox (fixed so SSR + client match).
const SPARKS: { x: number; y: number; r: number; d: number }[] = [
  { x: 18, y: 22, r: 5.5, d: 0.2 },
  { x: 82, y: 18, r: 4, d: 0.55 },
  { x: 88, y: 62, r: 5, d: 0.95 },
  { x: 22, y: 82, r: 4.5, d: 1.3 },
  { x: 66, y: 86, r: 3.4, d: 0.75 },
  { x: 12, y: 50, r: 3.1, d: 1.1 },
];

/** Four-point sparkle path centred on cx,cy at radius r (0..100 viewBox units). */
function sparklePath(cx: number, cy: number, r: number): string {
  const w = r * 0.3;
  return [
    `M${cx} ${cy - r} L${cx + w} ${cy} L${cx} ${cy + r} L${cx - w} ${cy} Z`,
    `M${cx - r} ${cy} L${cx} ${cy - w} L${cx + r} ${cy} L${cx} ${cy + w} Z`,
  ].join(' ');
}

export function BespokeMonogramMotion({
  svg,
  motion,
  sizeCls,
  glow,
  color = '#5C2542',
}: {
  /** Sanitized bespoke SVG markup (events.monogram_custom_svg / uploaded). */
  svg: string;
  /** Which motion signature plays. */
  motion: MonogramMotionKey;
  /** Tailwind size class for the square mark box (the stage scale handles fit). */
  sizeCls: string;
  /** Optional drop-shadow filter for legibility on the background. */
  glow?: string;
  /** Accent for the halo ring (the couple's contrast-aware ink). Sparks are gold. */
  color?: string;
}) {
  const uid = useId().replace(/[:]/g, '');
  const sc = `bmm-${uid}`;
  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  let css = '';
  let behind: React.ReactNode = null; // overlays drawn UNDER the mark (halo ring)
  let over: React.ReactNode = null; // overlays drawn OVER the mark (foil / sparks)

  if (motion === 'foil') {
    // Mark fades in, then a single band of warm gold light sweeps across — masked
    // to the mark's own shape so the foil rides the artwork (not a rectangle).
    css = `
      .${sc} .bmm-mark { opacity: 0; animation: ${sc}-in 0.6s ease-out forwards; }
      .${sc} .bmm-foil {
        position: absolute; inset: 0;
        -webkit-mask-image: url("${dataUri}"); mask-image: url("${dataUri}");
        -webkit-mask-size: contain; mask-size: contain;
        -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
        -webkit-mask-position: center; mask-position: center;
        background-image: linear-gradient(100deg, transparent 38%, rgba(255,247,224,0.95) 50%, transparent 62%);
        background-size: 260% 100%;
        background-position: 130% 0;
        opacity: 0;
        animation: ${sc}-sweep 1.5s ease-in-out 0.65s forwards;
      }
      @keyframes ${sc}-in { to { opacity: 1; } }
      @keyframes ${sc}-sweep {
        0% { background-position: 130% 0; opacity: 0; }
        18% { opacity: 1; }
        82% { opacity: 1; }
        100% { background-position: -130% 0; opacity: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .${sc} .bmm-mark { opacity: 1; animation: none; }
        .${sc} .bmm-foil { display: none; }
      }
    `;
    over = <span aria-hidden className="bmm-foil" />;
  } else if (motion === 'bloom') {
    // Blooms outward from the heart of the mark — a growing circular clip + a
    // soft blur that sharpens.
    css = `
      .${sc} .bmm-mark { animation: ${sc}-bloom 1.6s cubic-bezier(0.22,1,0.36,1) forwards; }
      @keyframes ${sc}-bloom {
        0% { clip-path: circle(0% at 50% 50%); filter: blur(4px); opacity: 0.45; }
        50% { opacity: 1; }
        100% { clip-path: circle(75% at 50% 50%); filter: blur(0); opacity: 1; }
      }
      @media (prefers-reduced-motion: reduce) { .${sc} .bmm-mark { clip-path: none; filter: none; opacity: 1; animation: none; } }
    `;
  } else if (motion === 'editorial') {
    // Rises into place + a hair of scale settles — a magazine masthead.
    css = `
      .${sc} .bmm-mark { opacity: 0; transform: translateY(10%) scale(0.97); animation: ${sc}-rise 1.5s cubic-bezier(0.16,1,0.3,1) 0.15s forwards; }
      @keyframes ${sc}-rise {
        0% { opacity: 0; transform: translateY(10%) scale(0.97); }
        55% { opacity: 1; }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @media (prefers-reduced-motion: reduce) { .${sc} .bmm-mark { opacity: 1; transform: none; animation: none; } }
    `;
  } else if (motion === 'halo') {
    // A ring sweeps itself around the mark first (real path length via
    // pathLength=1), then the mark fades up inside it.
    css = `
      .${sc} .bmm-ring { stroke-dasharray: 1; stroke-dashoffset: 1; transform: rotate(-90deg); transform-origin: 50% 50%; animation: ${sc}-ring 1.4s cubic-bezier(0.65,0,0.35,1) forwards; }
      .${sc} .bmm-mark { opacity: 0; transform: translateY(5%); animation: ${sc}-up 0.9s cubic-bezier(0.16,1,0.3,1) 1.05s forwards; }
      @keyframes ${sc}-ring { to { stroke-dashoffset: 0; } }
      @keyframes ${sc}-up { to { opacity: 1; transform: translateY(0); } }
      @media (prefers-reduced-motion: reduce) {
        .${sc} .bmm-ring { stroke-dashoffset: 0; animation: none; }
        .${sc} .bmm-mark { opacity: 1; transform: none; animation: none; }
      }
    `;
    behind = (
      <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
        <circle className="bmm-ring" cx={50} cy={50} r={47} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" pathLength={1} />
      </svg>
    );
  } else if (motion === 'stardust') {
    // Gold sparks twinkle around the mark in a ripple while it settles in.
    css = `
      .${sc} .bmm-mark { opacity: 0; transform: scale(0.94); transform-origin: 50% 50%; animation: ${sc}-settle 1.1s cubic-bezier(0.16,1,0.3,1) 0.2s forwards; }
      .${sc} .bmm-spark { opacity: 0; transform-box: fill-box; transform-origin: center; animation: ${sc}-spark 1.6s ease-in-out forwards; }
      @keyframes ${sc}-settle { to { opacity: 1; transform: scale(1); } }
      @keyframes ${sc}-spark {
        0% { opacity: 0; transform: scale(0.2); }
        35% { opacity: 1; transform: scale(1); }
        70% { opacity: 0.8; transform: scale(0.7); }
        100% { opacity: 0; transform: scale(0.25); }
      }
      @media (prefers-reduced-motion: reduce) {
        .${sc} .bmm-mark { opacity: 1; transform: none; animation: none; }
        .${sc} .bmm-spark { display: none; }
      }
    `;
    over = (
      <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
        {SPARKS.map((s, i) => (
          <path key={i} className="bmm-spark" d={sparklePath(s.x, s.y, s.r)} fill={SPARK_GOLD} style={{ animationDelay: `${s.d}s` }} />
        ))}
      </svg>
    );
  } else {
    // 'draw' — the mark wipes on left→right (a drawn-live reveal). A bespoke mark
    // has no strokeable letterforms, so this whole-mark wipe is the analogue.
    css = `
      .${sc} .bmm-mark { animation: ${sc}-draw 1.7s cubic-bezier(0.65,0,0.35,1) forwards; }
      @keyframes ${sc}-draw { 0% { clip-path: inset(0 100% 0 0); } 100% { clip-path: inset(0 0 0 0); } }
      @media (prefers-reduced-motion: reduce) { .${sc} .bmm-mark { clip-path: none; animation: none; } }
    `;
  }

  return (
    <span
      aria-hidden
      className={`${sc} relative inline-flex items-center justify-center ${sizeCls}`}
      style={glow ? { filter: glow } : undefined}
    >
      <style>{css}</style>
      {behind}
      {/* eslint-disable-next-line @next/next/no-img-element -- inert sanitized data-URI mark; next/image rejects inline SVG data URIs */}
      <img className="bmm-mark relative h-full w-full object-contain" src={dataUri} alt="" />
      {over}
    </span>
  );
}
