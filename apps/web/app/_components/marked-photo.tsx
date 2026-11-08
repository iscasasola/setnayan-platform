import Image from 'next/image';
import { displayAspectAllowed, type FrameShape } from '@/lib/photo-mark-geometry';
import { framedImageStyle } from '@/lib/photo-frame-display';

/**
 * A MARKED supplier photo, drawn so its mark is never cropped off (controller
 * audit 2026-11-04, item 1).
 *
 * The Seal and plate sits bottom-right of the photo's FRAME square. A display
 * whose aspect is inside the frame's band (`FRAME_DISPLAY_ASPECT`: a square
 * frame allows 5:7 … 1.91:1) keeps that square in view and draws the photo
 * `object-cover` as before. A display outside it — the Find card's 2.8:1
 * banner, a 2.3:1 shortlist hero — would crop the mark off, so the photo is
 * drawn WHOLE (`object-contain`) over a blurred, dimmed copy of itself. Same
 * URL twice, so the browser fetches it once. Never a mark moved mid-photo.
 *
 * `displayAspect` is the DESIGNED aspect of the slot (w/h at the phone width);
 * `the-mark-is-never-cropped-off.test.ts` holds every supplier-photo display
 * to declaring it.
 */
export function MarkedPhoto({
  src,
  alt,
  frame = 'square',
  displayAspect,
  sizes,
  priority,
  className = '',
}: {
  src: string;
  alt: string;
  frame?: FrameShape;
  displayAspect: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  // A photo framed in the Frame step carries its framing in its own name: the
  // place is DERIVED from it (keep the frame, widen; cut from the top when the
  // original runs out), which keeps the frame's mark square in view at any
  // aspect — no blurred fill needed.
  const framed = framedImageStyle(src, frame, displayAspect);
  if (framed) {
    return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={className} style={framed} data-framed="" />;
  }
  if (displayAspectAllowed(frame, displayAspect)) {
    return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={`object-cover ${className}`} />;
  }
  return (
    <>
      <Image
        src={src}
        alt=""
        aria-hidden
        fill
        sizes={sizes}
        priority={priority}
        className="scale-110 object-cover blur-xl brightness-75"
      />
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={`object-contain ${className}`} data-marked-whole="" />
    </>
  );
}

