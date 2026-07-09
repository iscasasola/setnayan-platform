import type { ReactNode } from 'react';

/**
 * ProgressRing — the signature "Energy, not skin" progress primitive (reskin
 * 2026-07-09). A pure inline-SVG donut: no deps, theme-aware, wine stroke on a
 * faint ink track. Reusable across the app (couple countdown, home event cards,
 * vendor completeness, budget) — pass `pct` and optional center content.
 *
 * Colours come from CSS vars so it flips with the theme and tracks the wine
 * `--color-mulberry` token by default. Renderable in a server component (no
 * client JS).
 *
 * `color` overrides the progress stroke — pass a palette-driven value (e.g.
 * `rgb(var(--color-terracotta))`) on the couple's mood-board-themed guest
 * pages, so the ring recolours per event instead of hardcoding dashboard wine.
 */
export function ProgressRing({
  pct,
  size = 88,
  stroke = 8,
  children,
  className,
  color = 'rgb(var(--color-mulberry))',
}: {
  /** 0–100; clamped. Non-finite → 0. */
  pct: number;
  /** Outer diameter in px. */
  size?: number;
  /** Ring thickness in px. */
  stroke?: number;
  /** Centered content (e.g. the "62%" label). */
  children?: ReactNode;
  className?: string;
  /** Progress-stroke colour. Defaults to the wine CTA token; override with a
   *  palette variable on guest surfaces. */
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const offset = circ * (1 - clamped / 100);
  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${className ?? ''}`.trim()}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          style={{ stroke: 'rgb(var(--color-ink) / 0.12)' }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{
            stroke: color,
            transition: 'stroke-dashoffset 0.6s ease',
          }}
        />
      </svg>
      {children != null ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
          {children}
        </div>
      ) : null}
    </div>
  );
}
