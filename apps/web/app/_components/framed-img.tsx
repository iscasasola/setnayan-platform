import { framedImageStyle } from '@/lib/photo-frame-display';
import type { FrameShape } from '@/lib/photo-frame-shape';

/**
 * A supplier photo drawn at its saved framing (Photo Frame Template · "any
 * size"): the place's aspect is derived from the one framing stored in the
 * photo's own name, so the Find card, the service card, the sheet and the
 * portfolio tile all show the square the supplier chose — and more around it,
 * never less. A photo never framed (no `-fr-` in its name) draws exactly as
 * before: `object-cover`.
 *
 * Fills its parent; the parent sizes it. `frameRef` is the stored ref (or the
 * display URL — both carry the key) to read the framing from.
 */
export function FramedImg({
  src,
  frameRef,
  shape = 'square',
  aspect,
  alt = '',
  loading,
  className = '',
}: {
  src: string;
  frameRef?: string | null;
  shape?: FrameShape;
  /** The place's designed aspect, w/h. */
  aspect: number;
  alt?: string;
  loading?: 'lazy' | 'eager';
  className?: string;
}) {
  const style = framedImageStyle(frameRef ?? src, shape, aspect);
  if (!style) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} loading={loading} className={`h-full w-full object-cover ${className}`} />;
  }
  return (
    <span className="relative block h-full w-full overflow-hidden" data-framed="">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading={loading} className={className} style={style} />
    </span>
  );
}
