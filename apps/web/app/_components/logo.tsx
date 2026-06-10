/* eslint-disable @next/next/no-img-element */
'use client';
//
// Setnayan brand logo · official gold mark (owner-supplied 2026-05-31).
// Replaces the temporary 2026-05-23 orange→red "SET NA 'YAN" gradient tile
// with a flat champagne-gold (#cb9e4b) glyph on a transparent ground.
//
// Renders the canonical /brand/setnayan-mark.svg as a square (1:1) image — OR
// the admin-uploaded default brand icon when one is set (owner 2026-06-10),
// resolved via `useBrandMark()` from the root BrandProvider. The default mark
// carries its own fixed gold fill (not `currentColor`), so it does not compose
// with parent CSS color — it reads the same on any background.
//
// Using a raw `<img>` (eslint-disable above) rather than next/image because
// the mark is small + already optimized, and serving it through next/image
// would add a presigning round-trip with no payload win.

import { useBrandMark } from './brand-provider';

type LogoProps = {
  className?: string;
  /**
   * Mark size in pixels (square). The temp icon is 1:1 aspect so width
   * equals height. Previous Logo accepted only `height`; for back-compat
   * we still accept it and treat it as the square edge length.
   */
  height?: number;
  withWordmark?: boolean;
  /** Accessible name. Hidden visually when `withWordmark` is true since the wordmark labels it. */
  title?: string;
};

export function Logo({
  className,
  height = 32,
  withWordmark = false,
  title = 'Setnayan',
}: LogoProps) {
  const markSrc = useBrandMark();
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`.trim()}>
      <img
        src={markSrc}
        alt={withWordmark ? '' : title}
        width={height}
        height={height}
        aria-hidden={withWordmark ? true : undefined}
        className="block rounded-md"
      />
      {withWordmark && (
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink/70">
          {title}
        </span>
      )}
    </span>
  );
}
