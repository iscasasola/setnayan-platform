'use client';

/**
 * /pa3d motion — the small kit this page needs and nothing more.
 *
 * Owner 2026-09-02: *"more photos and imagery. less text. important to use
 * animations and effect to make this attractive to the users browsing."*
 *
 * ─── ZERO DEPENDENCIES, ON PURPOSE ────────────────────────────────────────
 * `framer-motion` is not in this app and is not being added for a landing
 * page. Everything here is CSS keyframes + one IntersectionObserver, the same
 * posture as `_components/marketing/_motion.tsx` (Reveal / Blob) and Papic's
 * own `SettleTiles`. A marketing page that ships an animation library is a
 * marketing page that costs every visitor to read it.
 *
 * ─── REDUCED MOTION IS NOT A TOGGLE HERE, IT IS THE CONTRACT ─────────────
 * Every effect in this file is drift, zoom or slide — exactly the class of
 * motion that makes vestibular-sensitive people ill. Each one is wrapped in
 * `@media (prefers-reduced-motion: reduce)` and becomes a plain static image.
 * The page must still read perfectly with all of it off; if a section only
 * makes sense once it moves, that is a bug in the section.
 */

import Image from 'next/image';
import './_pa3d.css';

/**
 * A photograph that drifts — a slow Ken Burns push, so the hero is alive
 * without asking anything of the viewer. 22s is deliberately past the point
 * where the eye tracks it as movement: it reads as depth, not animation.
 */
export function KenBurns({
  src,
  alt,
  priority = false,
  sizes = '(min-width:768px) 672px, 100vw',
  className = '',
}: {
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  return (
    <div className={`pa3d-kb relative overflow-hidden ${className}`}>
      <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className="object-cover" />
    </div>
  );
}

/**
 * The day the room becomes — real photographs from the sample wedding,
 * drifting past. Duplicated once so the loop has no seam; the copy is
 * `aria-hidden` so a screen reader hears each photograph exactly once.
 *
 * Pauses on hover and on focus-within, so someone reading a caption or
 * tabbing through is not fighting the animation.
 */
export function PhotoRail({
  photos,
}: {
  photos: ReadonlyArray<{ src: string; alt: string }>;
}) {
  return (
    <div className="pa3d-rail relative overflow-hidden" aria-label="Photographs from the sample wedding">
      <div className="pa3d-rail-track flex gap-3">
        {photos.map((p) => (
          <RailPhoto key={p.src} src={p.src} alt={p.alt} />
        ))}
        {photos.map((p) => (
          <RailPhoto key={`dup-${p.src}`} src={p.src} alt="" ariaHidden />
        ))}
      </div>
      {/* Soft edges so the strip reads as continuing past the page, not as a
          row that stops. Tokens only — the palette guard bans a literal. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-10"
        style={{ background: 'linear-gradient(to right, var(--m-paper-2), transparent)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-10"
        style={{ background: 'linear-gradient(to left, var(--m-paper-2), transparent)' }}
      />
    </div>
  );
}

function RailPhoto({
  src,
  alt,
  ariaHidden = false,
}: {
  src: string;
  alt: string;
  ariaHidden?: boolean;
}) {
  return (
    <div
      aria-hidden={ariaHidden || undefined}
      className="relative h-40 w-32 flex-none overflow-hidden rounded-xl border border-[var(--m-line)] sm:h-52 sm:w-40"
    >
      <Image src={src} alt={alt} fill sizes="160px" className="object-cover" />
    </div>
  );
}
