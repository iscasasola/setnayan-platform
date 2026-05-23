/* eslint-disable @next/next/no-img-element */
//
// Setnayan brand logo · TEMPORARY orange-red gradient + white "SET NA 'YAN"
// lock-up (owner directive 2026-05-23 PM: "make this the temporary icon for
// setnayan. both on website and icons").
//
// Renders the canonical /brand/setnayan-mark.svg as a square 1024×1024
// image. The prior inline `<path>` + `currentColor` treatment is retired
// for the temp pass because the new design carries its own gradient + text
// fill that doesn't compose with parent CSS color.
//
// Using a raw `<img>` (eslint-disable above) rather than next/image because
// the SVG is small (~600 bytes), already optimized, and serving it through
// next/image would add a presigning round-trip with no payload win.

const MARK_SRC = '/brand/setnayan-mark.svg';

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
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`.trim()}>
      <img
        src={MARK_SRC}
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
