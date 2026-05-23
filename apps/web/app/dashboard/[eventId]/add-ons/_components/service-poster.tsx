import Link from 'next/link';
import { type LucideIcon } from 'lucide-react';

/**
 * Service poster — owner directive 2026-05-23 PM:
 * "services must look like live/animated posters instead of cards.
 *  with overlay text about the information on the lower third."
 *
 * Replaces the prior static white-card grid on /dashboard/[eventId]/add-ons
 * with cinema-style posters: full-bleed colored background + per-service
 * CSS animated motion layer + dark gradient mask + text content sitting
 * in the bottom third (lower-third overlay, broadcast convention).
 *
 * Three motion variants drive every poster:
 *   - drift  → slow radial gradient drift (calm services)
 *   - pulse  → centered scaling pulse (creative / generative services)
 *   - scan   → horizontal sweep line (broadcast / render services)
 *
 * Each service maps to a (motion, color pair) combination in the
 * SERVICE_POSTER_STYLES map in add-ons/page.tsx. Adding a new service
 * is one row in that map — never a CSS edit.
 *
 * 4:5 aspect ratio chosen as a compromise between Netflix-style 2:3
 * cinema posters (too tall for a 3-column grid on desktop) and square
 * cards (no cinematic feel). 4:5 also matches Instagram's portrait
 * post aspect ratio so the visual rhythm reads native to Filipino
 * couples coming from FB/IG.
 *
 * Server component — no client JS. Animations are pure CSS keyframes
 * defined in apps/web/app/globals.css. `prefers-reduced-motion: reduce`
 * is honored automatically via the global block at globals.css:114
 * which forces animation-duration to 0.001ms.
 */

export type PosterMotion = 'drift' | 'pulse' | 'scan';

export type PosterStyle = {
  /** Which keyframe animation drives the motion layer. */
  motion: PosterMotion;
  /**
   * CSS background for the base layer (behind the motion layer). Use a
   * radial-gradient or linear-gradient. Per-service hue gives each
   * poster its character; brand discipline keeps each gradient
   * harmonious (warm → terracotta family · cool → ink family · earthy
   * → cream/amber family).
   */
  baseBackground: string;
  /**
   * CSS background for the motion layer (transformed by the keyframe).
   * Typically a lighter, smaller radial-gradient that drifts/pulses/
   * sweeps across the base.
   */
  motionBackground: string;
  /**
   * Tone for the icon badge background tint. Sits in the top-left
   * corner with a subtle ring for depth.
   */
  iconBadgeClass: string;
};

type Props = {
  /** Display label rendered at the top of the lower-third overlay. */
  label: string;
  /** One-line blurb under the label. ~80 chars max for legibility. */
  blurb: string;
  /** Final CTA text. Rendered as a small label at the bottom. */
  cta: string;
  /**
   * Where the poster links to. When null, the poster renders as a
   * non-clickable div (used for `coming_soon` services).
   */
  href: string | null;
  /** Lucide icon rendered in the top-left badge. */
  Icon: LucideIcon;
  /** Visual style for this service (motion + colors + badge tint). */
  style: PosterStyle;
  /**
   * Optional pill rendered top-right. Used for "Coming soon" / "Web V1"
   * states + the iteration number for internal admins.
   */
  pill?: React.ReactNode;
  /**
   * When true, the poster renders with a dashed border + opacity
   * dimming (non-clickable, coming-soon state). Defaults to false.
   */
  comingSoon?: boolean;
};

export function ServicePoster({
  label,
  blurb,
  cta,
  href,
  Icon,
  style,
  pill,
  comingSoon = false,
}: Props) {
  const motionClass =
    style.motion === 'drift'
      ? 'poster-motion-drift'
      : style.motion === 'pulse'
        ? 'poster-motion-pulse'
        : 'poster-motion-scan';

  // Tailwind aspect-[4/5] gives the poster shape. min-h fallback keeps
  // it usable even if aspect-ratio CSS support is missing on some
  // older browsers (~3% of traffic).
  const aspectClass =
    'group relative block aspect-[4/5] min-h-[280px] overflow-hidden rounded-2xl shadow-sm transition-shadow';
  const interactiveClass = comingSoon
    ? 'cursor-not-allowed opacity-90'
    : 'hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream';

  const inner = (
    <>
      {/* Base layer — service-specific gradient background. Stays still
          to give the motion layer something to drift over. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: style.baseBackground }}
      />

      {/* Motion layer — same area, transformed by the keyframe. Sits
          on top of the base with mix-blend-mode for subtle interplay.
          When prefers-reduced-motion is on, the animation freezes at
          its current frame (per globals.css:114 global rule). */}
      <div
        aria-hidden
        className={`absolute inset-0 ${motionClass}`}
        style={{
          background: style.motionBackground,
          mixBlendMode: 'screen',
        }}
      />

      {/* Lower-third gradient mask for text legibility. Goes from
          transparent at the top to ink/90 at the bottom-third so the
          label + blurb + CTA always have enough contrast against the
          colored poster behind. Broadcast/film convention. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/60 to-transparent"
      />

      {/* Top row — icon badge + optional pill. Sits above the gradient
          so the pill stays readable on busy posters. */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-5">
        <span
          className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-white/20 backdrop-blur-md ${style.iconBadgeClass}`}
        >
          <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        {pill ? <div className="flex items-center">{pill}</div> : null}
      </div>

      {/* Lower-third content — sits in the bottom third with the
          gradient mask behind it. Text uses cream for high contrast
          against the ink gradient. */}
      <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-4 sm:p-5">
        <h2 className="text-lg font-semibold leading-tight text-cream sm:text-xl">
          {label}
        </h2>
        <p className="line-clamp-2 text-sm text-cream/80">{blurb}</p>
        {comingSoon ? (
          <p className="pt-1 text-xs font-medium text-cream/55">
            Not yet available
          </p>
        ) : (
          <p className="pt-1 text-sm font-medium text-cream">
            {cta} <span aria-hidden>›</span>
          </p>
        )}
      </div>
    </>
  );

  if (comingSoon || !href) {
    return (
      <div
        className={`${aspectClass} ${interactiveClass}`}
        aria-disabled="true"
      >
        {inner}
      </div>
    );
  }

  return (
    <Link href={href} className={`${aspectClass} ${interactiveClass}`}>
      {inner}
    </Link>
  );
}
