'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * TicketPicture — the guest's Digital ticket, drawn by the SAME route "Save my
 * ticket" downloads (`/api/guest/pass-card`), so the card on Me and the file in
 * Photos are one PNG, never two drawings.
 *
 * 🔑 A FAILED PICTURE MUST NOT LOOK LIKE A PICTURE. A 503 (the render timed
 * out) or a 404 (the reply changed since the page drew) leaves an `<img>` as a
 * broken icon or an empty box — at a door, that is "no ticket" with no reason.
 * So a failure swaps in `fallback` (the caller's plain code + one line).
 *
 * ⚠ `onError` alone is not enough: an image that fails BEFORE hydration fires
 * its error event at a DOM with no listener yet. The effect asks the element
 * itself (`complete && naturalWidth === 0` is a finished, broken image).
 *
 * The box is 3 : 4 before a byte arrives (width/height attributes + aspect), so
 * the page does not jump when the picture lands.
 */
export function TicketPicture({
  src,
  alt,
  fallback,
}: {
  src: string;
  alt: string;
  fallback: ReactNode;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<'loading' | 'shown' | 'failed'>('loading');

  useEffect(() => {
    const img = ref.current;
    if (!img || !img.complete) return;
    setState(img.naturalWidth > 0 ? 'shown' : 'failed');
  }, []);

  if (state === 'failed') return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- the route's own PNG, cookie-authenticated; next/image would proxy it without the cookie
    <img
      ref={ref}
      src={src}
      alt={alt}
      width={300}
      height={400}
      decoding="async"
      data-ticket-picture={state}
      onLoad={() => setState('shown')}
      onError={() => setState('failed')}
      className={`mx-auto block aspect-[3/4] h-auto w-[300px] max-w-full drop-shadow-md ${
        state === 'loading' ? 'motion-safe:animate-pulse rounded-2xl bg-ink/[0.06]' : ''
      }`}
    />
  );
}
