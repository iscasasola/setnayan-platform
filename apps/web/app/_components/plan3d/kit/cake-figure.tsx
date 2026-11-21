/**
 * 🎂 <CakeFigure> — the ONE cake picture (controller ruling 2026-11-21: "simple and very beautiful… not image heavy").
 * Drawn in code from the shared model `cakeFigureSpec` (lib/cake-config.ts) — never from photos, never from the raw
 * design — so the maker's preview, the received card and the order all show the same cake, and the lazy 3D
 * turntable (`cake-figure-3d.tsx`) draws the very same CakeFigureSpec.
 *
 * Soft rounded tiers with a gentle cylinder shading · the finish as a light texture · per-tier accents · one flowing
 * accent · acrylic spacers or pillars · the topper as a line icon · the message in script on a plaque. The cake keeps
 * its real colours in dark mode; only the stage follows the theme. No downloads.
 */
import { useId } from 'react';
import type { CakeFigureSpec, CakeFigureTier } from '@/lib/cake-config';
import css from './cake-figure.module.css';

const U = 100; // px per cake unit
const IVORY = '#F7F0E4';
const GOLD = '#C9A55C';
const INK_LINE = '#6B5B4B';

export function CakeFigure({
  spec,
  monogramText = null,
  className,
  title,
}: {
  spec: CakeFigureSpec;
  /** The event's shipped monogram (resolveMonogram) — drawn where the design puts it. */
  monogramText?: string | null;
  className?: string;
  /** An accessible name; omitted = decorative. */
  title?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const margin = 0.35;
  const w = (spec.width + margin * 2) * U;
  const h = (spec.height + 0.75) * U;
  const base = h - 0.42 * U; // the board's top
  const cx = spec.cupcakes?.placement === 'tower' ? (w - 0.7 * U) / 2 : w / 2;
  const colour = (i: number) => spec.colours[i % spec.colours.length]!;
  const X = (t: CakeFigureTier) => cx + t.x * U;
  const topY = (t: CakeFigureTier) => base - (t.y + t.height) * U;
  const botY = (t: CakeFigureTier) => base - t.y * U;
  const rx = (t: CakeFigureTier) => t.radius * U;
  const ry = (t: CakeFigureTier) => t.radius * U * 0.17;
  const stands = [...new Set(spec.tiers.map((t) => t.stand))];

  return (
    <svg
      viewBox={`0 0 ${w.toFixed(0)} ${h.toFixed(0)}`}
      className={`${css.fig} ${className ?? ''}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-cake-figure={spec.tiers.length}
    >
      <defs>
        <linearGradient id={`${uid}s`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.16" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.2" />
        </linearGradient>
        <radialGradient id={`${uid}b`} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#E9E1D4" />
        </radialGradient>
        <pattern id={`${uid}bc`} width="14" height="9" patternUnits="userSpaceOnUse">
          <path d="M0 6 Q3.5 2 7 6 T14 6" fill="none" stroke="#000" strokeOpacity="0.06" strokeWidth="1.4" />
        </pattern>
      </defs>

      {/* the board under each stand, with a soft contact shadow */}
      {stands.map((s) => {
        const first = spec.tiers.find((t) => t.stand === s)!;
        const r = rx(first) * 1.16;
        return (
          <g key={`board${s}`}>
            <ellipse cx={X(first)} cy={base + 10} rx={r * 1.04} ry={r * 0.2} fill="#000" opacity="0.1" />
            <ellipse cx={X(first)} cy={base + 4} rx={r} ry={r * 0.19} fill={`url(#${uid}b)`} stroke="#D8CEC0" />
          </g>
        );
      })}

      {spec.cupcakes?.placement === 'base' ? <CupcakeRing spec={spec} cx={X(spec.tiers[0]!)} base={base} r={rx(spec.tiers[0]!) * 1.12} colour={colour(0)} /> : null}

      {spec.tiers.map((t) => {
        const left = X(t) - rx(t);
        const right = X(t) + rx(t);
        const top = topY(t);
        const bot = botY(t);
        const body = `M${left} ${top} L${left} ${bot} A${rx(t)} ${ry(t)} 0 0 0 ${right} ${bot} L${right} ${top} Z`;
        const fill = spec.finish === 'semi_naked' ? t.sponge : IVORY;
        const accentColour = colour(t.index);
        return (
          <g key={t.index} className={css.tier}>
            {t.gapBelow > 0 ? <Gap t={t} spec={spec} cx={X(t)} bot={bot} rx={rx(t)} ry={ry(t)} /> : null}
            <path d={body} fill={fill} />
            {spec.finish === 'semi_naked' ? (
              <g opacity="0.75">
                {[0.25, 0.5, 0.75].map((f) => (
                  <rect key={f} x={left} y={top + (bot - top) * f - 3} width={right - left} height="6" fill={IVORY} opacity="0.85" />
                ))}
              </g>
            ) : null}
            {spec.finish === 'buttercream' ? <path d={body} fill={`url(#${uid}bc)`} /> : null}
            <path d={body} fill={`url(#${uid}s)`} />
            <ellipse cx={X(t)} cy={top} rx={rx(t)} ry={ry(t)} fill={spec.finish === 'semi_naked' ? '#FBF6EC' : '#FFFBF4'} />
            {spec.finish === 'fondant' ? (
              <ellipse cx={X(t) - rx(t) * 0.35} cy={top + (bot - top) * 0.45} rx={rx(t) * 0.12} ry={(bot - top) * 0.32} fill="#fff" opacity="0.28" />
            ) : null}
            <Accent t={t} spec={spec} colour={accentColour} cx={X(t)} top={top} bot={bot} rx={rx(t)} ry={ry(t)} />
          </g>
        );
      })}

      {spec.flowing ? <Flowing spec={spec} X={X} topY={topY} botY={botY} rx={rx} colour={colour} /> : null}

      {spec.monogram && monogramText ? <Monogram spec={spec} text={monogramText} X={X} topY={topY} botY={botY} base={base} /> : null}

      {spec.topper ? <Topper spec={spec} text={spec.topper.kind === 'monogram' ? (monogramText ?? '') : spec.message} X={X} topY={topY} colour={colour(0)} /> : null}

      {spec.cupcakes?.placement === 'tower' ? <CupcakeTower count={spec.cupcakes.count} x={w - 0.28 * U} base={base} colour={colour(1)} /> : null}

      {spec.message.trim() && spec.topper?.kind !== 'names' ? (
        <g className={css.plaque}>
          <rect x={cx - 0.62 * U} y={base + 0.05 * U} width={1.24 * U} height={0.28 * U} rx="8" fill="#FFFDF8" stroke="#D8CEC0" />
          <text x={cx} y={base + 0.24 * U} textAnchor="middle" className={css.script} fill={INK_LINE}>
            {spec.message.trim()}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

type TierDraw = { t: CakeFigureTier; spec: CakeFigureSpec; cx: number; rx: number; ry: number };

function Gap({ t, spec, cx, bot, rx, ry }: TierDraw & { bot: number }) {
  const gapPx = t.gapBelow * U;
  if (spec.arrangement === 'pillars') {
    return (
      <g fill="#FFFDF8" stroke="#D8CEC0">
        {[-0.62, -0.2, 0.2, 0.62].map((f) => (
          <rect key={f} x={cx + rx * f - 3} y={bot} width="6" height={gapPx + ry * 0.4} rx="2" />
        ))}
      </g>
    );
  }
  // floating — a clear acrylic spacer
  return <rect x={cx - rx * 0.55} y={bot} width={rx * 1.1} height={gapPx} rx="4" fill="#DCEBF2" opacity="0.55" stroke="#BCD3DE" />;
}

function Accent({ t, colour, cx, top, bot, rx, ry }: TierDraw & { colour: string; top: number; bot: number }) {
  const hgt = bot - top;
  switch (t.accent) {
    case 'ribbon':
      return (
        <path
          d={`M${cx - rx} ${bot - hgt * 0.22} A${rx} ${ry} 0 0 0 ${cx + rx} ${bot - hgt * 0.22} L${cx + rx} ${bot - hgt * 0.06} A${rx} ${ry} 0 0 1 ${cx - rx} ${bot - hgt * 0.06} Z`}
          fill={colour}
          opacity="0.92"
        />
      );
    case 'pearls': {
      const n = Math.max(6, Math.round(rx / 9));
      return (
        <g fill="#FFFDF7" stroke="#E2D7C6" strokeWidth="0.8">
          {Array.from({ length: n }, (_, i) => {
            const a = Math.PI * (0.06 + (0.88 * i) / (n - 1));
            return <circle key={i} cx={cx - Math.cos(a) * rx} cy={bot - 4 + Math.sin(a) * ry} r="3.4" />;
          })}
        </g>
      );
    }
    case 'drip': {
      const n = Math.max(5, Math.round(rx / 12));
      let d = `M${cx - rx} ${top}`;
      for (let i = 0; i < n; i++) {
        const x0 = cx - rx + (2 * rx * i) / n;
        const x1 = cx - rx + (2 * rx * (i + 1)) / n;
        const depth = hgt * (i % 2 === 0 ? 0.42 : 0.24);
        d += ` L${x0 + (x1 - x0) * 0.3} ${top + 4} Q${(x0 + x1) / 2} ${top + depth} ${x0 + (x1 - x0) * 0.7} ${top + 4}`;
      }
      d += ` L${cx + rx} ${top} Z`;
      return <path d={d} fill={colour} opacity="0.95" />;
    }
    case 'flowers':
      return (
        <g>
          {[-0.55, -0.38, -0.2].map((f, i) => (
            <Flower key={i} x={cx + rx * f} y={top + hgt * (0.3 + i * 0.16)} r={Math.min(9, hgt * 0.18)} colour={colour} />
          ))}
        </g>
      );
    case 'gold_leaf':
      return (
        <g fill={GOLD} opacity="0.9">
          {[
            [-0.4, 0.3],
            [-0.15, 0.55],
            [0.2, 0.25],
            [0.45, 0.6],
          ].map(([fx, fy], i) => (
            <path
              key={i}
              d={`M${cx + rx * fx!} ${top + hgt * fy!} l6 -3 l5 4 l-3 6 l-7 -1 Z`}
            />
          ))}
        </g>
      );
    case 'ruffles':
      return (
        <g fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="2">
          {[0.3, 0.55, 0.8].map((f) => {
            let d = `M${cx - rx} ${top + hgt * f}`;
            const n = Math.max(6, Math.round(rx / 10));
            for (let i = 0; i < n; i++) d += ` q${rx / n} 6 ${(2 * rx) / n} 0`;
            return <path key={f} d={d} />;
          })}
        </g>
      );
    default:
      return null;
  }
}

function Flower({ x, y, r, colour }: { x: number; y: number; r: number; colour: string }) {
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={x + Math.cos((a * Math.PI) / 180) * r * 0.55} cy={y + Math.sin((a * Math.PI) / 180) * r * 0.55} r={r * 0.5} fill={colour} />
      ))}
      <circle cx={x} cy={y} r={r * 0.32} fill="#F4E3B5" />
    </g>
  );
}

function Flowing({
  spec,
  X,
  topY,
  botY,
  rx,
  colour,
}: {
  spec: CakeFigureSpec;
  X: (t: CakeFigureTier) => number;
  topY: (t: CakeFigureTier) => number;
  botY: (t: CakeFigureTier) => number;
  rx: (t: CakeFigureTier) => number;
  colour: (i: number) => string;
}) {
  const f = spec.flowing!;
  const run = spec.tiers.filter((t) => t.index >= f.toTier && t.index <= f.fromTier).reverse();
  if (run.length === 0) return null;
  const pts = run.map((t, i) => ({ x: X(t) + rx(t) * (i % 2 === 0 ? 0.35 : -0.15), y: (topY(t) + botY(t)) / 2 }));
  if (f.kind === 'ribbon_cascade' || f.kind === 'pearl_strand') {
    const d = pts.reduce((acc, p, i) => (i === 0 ? `M${p.x} ${p.y}` : `${acc} S${(pts[i - 1]!.x + p.x) / 2 + 18} ${(pts[i - 1]!.y + p.y) / 2} ${p.x} ${p.y}`), '');
    return f.kind === 'ribbon_cascade' ? (
      <path d={d} fill="none" stroke={colour(0)} strokeWidth="7" strokeLinecap="round" opacity="0.9" />
    ) : (
      <path d={d} fill="none" stroke="#FFFDF7" strokeWidth="5" strokeDasharray="0.1 8" strokeLinecap="round" />
    );
  }
  return (
    <g>
      {pts.map((p, i) => (
        <Flower key={i} x={p.x} y={p.y} r={10} colour={colour(i)} />
      ))}
    </g>
  );
}

function Monogram({
  spec,
  text,
  X,
  topY,
  botY,
  base,
}: {
  spec: CakeFigureSpec;
  text: string;
  X: (t: CakeFigureTier) => number;
  topY: (t: CakeFigureTier) => number;
  botY: (t: CakeFigureTier) => number;
  base: number;
}) {
  const m = spec.monogram!;
  const t = spec.tiers[m.onTier] ?? spec.tiers[0]!;
  const x = m.spot === 'board' ? X(spec.tiers[0]!) + spec.tiers[0]!.radius * U * 0.95 : X(t);
  const y = m.spot === 'board' ? base + 6 : (topY(t) + botY(t)) / 2;
  return (
    <g>
      <circle cx={x} cy={y} r="15" fill="#FFFDF8" stroke={GOLD} strokeWidth="1.5" />
      <text x={x} y={y + 4.5} textAnchor="middle" className={css.mono} fill={INK_LINE}>
        {text.slice(0, 4)}
      </text>
    </g>
  );
}

function Topper({
  spec,
  text,
  X,
  topY,
  colour,
}: {
  spec: CakeFigureSpec;
  text: string;
  X: (t: CakeFigureTier) => number;
  topY: (t: CakeFigureTier) => number;
  colour: string;
}) {
  const tp = spec.topper!;
  const t = spec.tiers[tp.onTier]!;
  const x = X(t);
  const y = topY(t) - 4;
  const line = { fill: 'none', stroke: INK_LINE, strokeWidth: 1.6, strokeLinecap: 'round' as const };
  if (tp.kind === 'flowers') {
    return (
      <g data-cake-topper={tp.onTier}>
        <Flower x={x - 9} y={y - 6} r={9} colour={colour} />
        <Flower x={x + 9} y={y - 8} r={8} colour={colour} />
        <Flower x={x} y={y - 16} r={8} colour="#F6EEE3" />
      </g>
    );
  }
  if (tp.kind === 'figurine') {
    return (
      <g data-cake-topper={tp.onTier} {...line}>
        <circle cx={x - 8} cy={y - 34} r="5" />
        <path d={`M${x - 8} ${y - 29} L${x - 14} ${y} M${x - 8} ${y - 29} L${x - 2} ${y}`} />
        <circle cx={x + 8} cy={y - 34} r="5" />
        <path d={`M${x + 8} ${y - 29} L${x + 8} ${y} M${x + 3} ${y - 18} L${x + 13} ${y - 18}`} />
      </g>
    );
  }
  const words = (tp.kind === 'monogram' ? text.slice(0, 4) : text.trim().slice(0, 14)) || 'A & M';
  return (
    <g data-cake-topper={tp.onTier}>
      <path d={`M${x - 16} ${y} L${x - 16} ${y - 14} M${x + 16} ${y} L${x + 16} ${y - 14}`} {...line} />
      <text x={x} y={y - 18} textAnchor="middle" className={tp.kind === 'monogram' ? css.mono : css.script} fill={INK_LINE}>
        {words}
      </text>
    </g>
  );
}

function Cupcake({ x, y, s, colour }: { x: number; y: number; s: number; colour: string }) {
  return (
    <g>
      <path d={`M${x - 7 * s} ${y - 9 * s} L${x - 5 * s} ${y} L${x + 5 * s} ${y} L${x + 7 * s} ${y - 9 * s} Z`} fill="#E8D8C0" stroke="#D2BFA3" strokeWidth="0.6" />
      <ellipse cx={x} cy={y - 11 * s} rx={8 * s} ry={5 * s} fill={colour} />
      <circle cx={x} cy={y - 16 * s} r={2.2 * s} fill="#fff" opacity="0.8" />
    </g>
  );
}

function CupcakeRing({ spec, cx, base, r, colour }: { spec: CakeFigureSpec; cx: number; base: number; r: number; colour: string }) {
  const shown = Math.min(spec.cupcakes!.count, 9);
  return (
    <g>
      {Array.from({ length: shown }, (_, i) => {
        const f = shown === 1 ? 0.5 : i / (shown - 1);
        return <Cupcake key={i} x={cx - r + 2 * r * f} y={base + 10 + Math.sin(Math.PI * f) * 6} s={0.9} colour={colour} />;
      })}
    </g>
  );
}

function CupcakeTower({ count, x, base, colour }: { count: number; x: number; base: number; colour: string }) {
  const rows = count >= 24 ? 3 : count >= 12 ? 2 : 1;
  return (
    <g>
      {Array.from({ length: rows }, (_, row) => {
        const y = base - row * 26;
        const n = rows - row + 1;
        return (
          <g key={row}>
            <rect x={x - n * 9} y={y} width={n * 18} height="3" rx="1.5" fill="#D8CEC0" />
            {Array.from({ length: n }, (_, k) => (
              <Cupcake key={k} x={x - (n - 1) * 9 + k * 18} y={y} s={0.75} colour={colour} />
            ))}
          </g>
        );
      })}
    </g>
  );
}
