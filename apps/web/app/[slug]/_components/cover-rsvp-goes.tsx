'use client';

import { useEffect } from 'react';

/**
 * 🧭 THE COVER'S RSVP BUTTON TAKES THE READER TO THE RSVP PART — SMOOTHLY (owner 2026-10-17, *"it is not going to the
 * RSVP part?"*). The button is a plain in-page link (`#site-reply`, `COVER_RSVP_PART`), so with no script it still
 * jumps there; this only makes the jump a glide — the cover lifts away as the page moves down to the Reply card — and
 * keeps the address clean (no `#site-reply` left behind). Reduced motion: the same move, at once.
 *
 * It listens on the document, not on the button, so nothing laid over the button's words (an effect's layer inside it,
 * a kit piece) can stand between the tap and the move: a click anywhere inside the link reaches it. Drawn once, by the
 * cover's foot, only when its button is such a link. Draws nothing.
 */
export function CoverRsvpGoes() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[data-cover-rsvp]');
      const href = link?.getAttribute('href') ?? '';
      if (!href.startsWith('#')) return;
      const part = document.getElementById(href.slice(1));
      if (!part) return; // nothing to go to: let the browser do what it would
      e.preventDefault();
      const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      /* Where to stop: the card just clear of the top bar — and never short of the cover's last words (its foot's
         bottom padding, 14px, may stay: it is bare ground). Where the card stands close under the cover, the cover is
         then not wholly gone, so the bars wait and the card is clear of nothing at all; further down, the cover is gone,
         the bars arrive, and the card stands under them. */
      const cover = link!.closest('header');
      const bar = document.querySelector<HTMLElement>('[data-sticky-top]')?.getBoundingClientRect().height ?? 0;
      const partTop = part.getBoundingClientRect().top + window.scrollY;
      const coverGone = cover ? cover.getBoundingClientRect().bottom + window.scrollY : partTop;
      const top = Math.max(0, Math.min(Math.max(coverGone - 14, partTop - bar - 12), partTop));
      window.scrollTo({ top, behavior: calm ? 'auto' : 'smooth' });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
