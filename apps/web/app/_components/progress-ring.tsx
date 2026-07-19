import type { CSSProperties, ReactNode } from 'react';

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
  trackColor = 'rgb(var(--color-ink) / 0.12)',
  sweep,
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
  /** Track-stroke colour override (opt-in; other call sites untouched). */
  trackColor?: string;
  /** OPT-IN entrance sweep (home-launcher pixel pass 2026-07-15): animates the
   *  ring 0→pct via the `sn-ring-sweep` keyframe (1.3s, sn-ease-out, `both`)
   *  after `delayMs`. Off by default so the ring's other mounts (couple
   *  countdown, vendor completeness) render exactly as before. The global
   *  prefers-reduced-motion freeze snaps it to the final state. */
  sweep?: { delayMs?: number };
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
          style={{ stroke: trackColor }}
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
          style={
            {
              stroke: color,
              transition: 'stroke-dashoffset 0.6s ease',
              ...(sweep
                ? {
                    '--sn-ring-circ': `${circ}px`,
                    animation: 'sn-ring-sweep 1.3s var(--sn-ease-out) both',
                    animationDelay: `${sweep.delayMs ?? 0}ms`,
                  }
                : {}),
            } as CSSProperties
          }
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
