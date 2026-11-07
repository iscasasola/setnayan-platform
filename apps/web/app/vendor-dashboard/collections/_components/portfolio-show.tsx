'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * ▶ SHOW — the picked album, full screen, to swipe through in front of a couple (owner v110; BARS LOCKED "Show";
 * THE ONE BUILD A3 W14, lane C4).
 *
 * 🔑 NOTHING BUT THE PHOTOS: no edit button, no price, no caption (no caption field exists), no delete — a supplier hands
 * the phone over. One photo per swipe (scroll-snap), "3 of 24" to say where you are, ✕ / Esc / the phone's Back to
 * close. Reduced motion: no smooth scroll and no fade. The photos are the album's already-loaded URLs — no new read.
 * 🔒 collections/the-portfolio-is-all-media.test.ts
 */
export function PortfolioShow({ title, urls, onClose }: { title: string; urls: readonly string[]; onClose: () => void }) {
  const [at, setAt] = useState(0);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setHost(document.body);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.history.back();
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const t = track.current;
        if (!t) return;
        t.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * t.clientWidth, behavior: 'auto' });
      }
    };
    // The phone's Back closes Show (one history entry of its own).
    window.history.pushState({ portfolioShow: true }, '');
    const onPop = () => onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPop);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
    };
  }, [onClose]);

  useEffect(() => {
    closeRef.current?.focus();
  }, [host]);

  if (!host) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — Show`}
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
      data-portfolio-show=""
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(env(safe-area-inset-top),12px)]">
        <span className="text-[13px] tabular-nums text-white/75" aria-live="polite">
          {urls.length ? `${at + 1} of ${urls.length}` : ''}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={() => window.history.back()}
          aria-label="Close Show"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10"
        >
          <X aria-hidden className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
      <div
        ref={track}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => {
          const t = e.currentTarget;
          setAt(Math.round(t.scrollLeft / Math.max(1, t.clientWidth)));
        }}
      >
        {urls.map((u, i) => (
          <div key={u} className="flex h-full w-full shrink-0 snap-center snap-always items-center justify-center px-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- presigned display URLs */}
            <img src={u} alt={`${title} — ${i + 1} of ${urls.length}`} className="max-h-full max-w-full object-contain" loading={i < 2 ? 'eager' : 'lazy'} />
          </div>
        ))}
      </div>
    </div>,
    host,
  );
}
