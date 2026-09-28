'use client';

import { useEffect, useState } from 'react';
import { canvasReturnHref } from '../_lib/back-to-the-invitation';

/**
 * Every "Back to the invitation" on Find your seat — the round button and the
 * text link — through ONE component, so the two can never land in different
 * places. The server hands the guest address (`findSeatBackHref`); inside the
 * Maker's canvas the frame's own `src` replaces it after mount, so the canvas
 * goes back to the canvas and never to the plain guest page. See
 * `../_lib/back-to-the-invitation.ts`.
 *
 * ⚠ A PLAIN `<a>`, NOT `next/link` — MEASURED, not a style choice. On the
 * test event (rosa-ben, 390 px, 2026-09-28) a client-side push to
 * `/rosa-ben#site-details` left the page at `scrollY 0` — the hero, i.e. the
 * very front cover this exists to skip (cause not traced; the page body
 * streams behind a Suspense boundary). A document load of the same
 * address landed on The Details (`scrollY 734`) with the bar pinned, and the
 * hash is on the URL before the opening's first-page check reads it.
 */
export function SeatBackLink({
  href,
  slug,
  className,
  children,
  'aria-label': ariaLabel,
}: {
  href: string;
  slug: string;
  className?: string;
  children: React.ReactNode;
  'aria-label'?: string;
}) {
  const [target, setTarget] = useState(href);

  useEffect(() => {
    let src: string | null = null;
    try {
      if (window.top !== window.self) src = window.frameElement?.getAttribute('src') ?? null;
    } catch {
      src = null; // a cross-origin parent — not the Maker
    }
    setTarget(canvasReturnHref(src, slug, window.location.origin) ?? href);
  }, [href, slug]);

  return (
    <a href={target} aria-label={ariaLabel} className={className} data-seat-back="">
      {children}
    </a>
  );
}
