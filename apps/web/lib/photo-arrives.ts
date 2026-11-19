/**
 * photo-arrives.ts — PHOTO ARRIVES (motion standard 18 Nov 2026, § 4 #20): "each photo fades in over its own tinted
 * space" — Move 320 · Settle, opacity plus a tiny settle in size. No cascade: each one fades as it lands.
 *
 * HOW A PHOTO JOINS: the shared photo parts put `PHOTO_ARRIVES` on their <img> (`{...PHOTO_ARRIVES}`); any new
 * photo does the same. ONE capture listener (`watchPhotosArrive`, mounted once by `app/_components/photo-arrives.tsx`)
 * plays the arrival when a marked image's `load` fires.
 *
 * WHAT IT CAN NEVER DO:
 *  · HIDE A PHOTO. Nothing is hidden waiting for script: a marked image with no listener, a failed script, or an
 *    image that had already loaded simply shows, as before. The arrival only plays over an image that has just
 *    got its pixels.
 *  · MOVE THE LAYOUT. Opacity and the `scale` property only (not `transform` — a framed photo carries its framing
 *    there, and the arrival must not fight it).
 *  · SLOW THE PAGE. No request, no wait. An image the page asked for first (`fetchpriority="high"` or
 *    `loading="eager"`, i.e. the likely largest paint) is never faded.
 *  · REACH THE COUPLE'S EVENT HUB. Anything inside `.sn-editorial` keeps its own motion.
 * Reduced motion: the photo shows at once.
 *
 * 🔒 lib/photo-arrives.test.ts
 */
import { EASE_SETTLE, MOVE_MS } from '@/lib/motion-table';

/** The mark a photo carries to join. Spread it on the <img> / <Image>. */
export const PHOTO_ARRIVES = { 'data-sn-photo': '' } as const;
export const PHOTO_ARRIVES_SELECTOR = 'img[data-sn-photo]';

/** How far the photo settles in: it lands a touch large and comes to rest. */
export const PHOTO_ARRIVES_FROM_SCALE = 1.02;

export const PHOTO_ARRIVES_KEYFRAMES = [
  { opacity: 0, scale: String(PHOTO_ARRIVES_FROM_SCALE) },
  { opacity: 1, scale: '1' },
] as const;

/** `fill: backwards`, never `both` — nothing is left on the photo when the arrival ends. */
export const PHOTO_ARRIVES_TIMING = { duration: MOVE_MS, easing: EASE_SETTLE, fill: 'backwards' } as const;

type ImgLike = {
  matches?: (selector: string) => boolean;
  closest?: (selector: string) => unknown;
  getAttribute: (name: string) => string | null;
  animate?: (keyframes: Keyframe[], timing: KeyframeAnimationOptions) => unknown;
};

/** Should this element's `load` play the arrival? Pure — the test runs it. */
export function photoShouldArrive(el: ImgLike | null | undefined, reducedMotion: boolean): boolean {
  if (!el || reducedMotion) return false;
  if (typeof el.matches !== 'function' || !el.matches(PHOTO_ARRIVES_SELECTOR)) return false;
  if (typeof el.animate !== 'function') return false;
  // The page's first picture is never faded: it is what the page is measured by.
  if (el.getAttribute('fetchpriority') === 'high' || el.getAttribute('loading') === 'eager') return false;
  // The couple's own Event Hub keeps its own motion.
  if (typeof el.closest === 'function' && el.closest('.sn-editorial')) return false;
  return true;
}

/** Play the arrival on one image. Returns true if it played. */
export function playPhotoArrives(el: ImgLike | null | undefined, reducedMotion: boolean): boolean {
  if (!photoShouldArrive(el, reducedMotion)) return false;
  el!.animate!([...PHOTO_ARRIVES_KEYFRAMES] as unknown as Keyframe[], { ...PHOTO_ARRIVES_TIMING });
  return true;
}

/** The one listener. `load` does not bubble, so it is caught on the way down. Returns its own undo. */
export function watchPhotosArrive(doc: Document, win: Window): () => void {
  const reduced = () =>
    typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onLoad = (e: Event) => {
    playPhotoArrives(e.target as unknown as ImgLike, reduced());
  };
  doc.addEventListener('load', onLoad, true);
  return () => doc.removeEventListener('load', onLoad, true);
}
