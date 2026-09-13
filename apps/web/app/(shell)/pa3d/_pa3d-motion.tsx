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
