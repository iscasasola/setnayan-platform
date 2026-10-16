'use client';

import { useEffect } from 'react';

/**
 * 🌬 THE ART KIT MOVES ONLY WHILE IT IS SEEN (owner 2026-10-16, the Vintage kit: Sway on the drapes and the araña,
 * Float on the florals). Every moving piece (`[data-kit-motion]`, `kit-piece.tsx`) is PAUSED by the kit's stylesheet
 * until this marks it `data-kit-live` — on screen — and un-marks it when it leaves, so nothing animates off screen.
 *
 * Mounted once, only where a kit is drawn. Nothing to do under reduce motion (the stylesheet takes the animation off
 * there), and nothing without an IntersectionObserver (the pieces stay still — a finished page, never a broken one).
 * Pieces that arrive later (the veil's seal mounts after the page; the Maker canvas re-renders) are picked up by a
 * MutationObserver, batched to one look per frame.
 */
export function ArtKitMotion() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) e.target.setAttribute('data-kit-live', '');
          else e.target.removeAttribute('data-kit-live');
        }
      },
      { rootMargin: '80px 0px' },
    );
    const watched = new WeakSet<Element>();
    const scan = () => {
      document.querySelectorAll('[data-kit-motion]').forEach((el) => {
        if (watched.has(el)) return;
        watched.add(el);
        io.observe(el);
      });
    };
    scan();
    let frame = 0;
    const mo = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        scan();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
