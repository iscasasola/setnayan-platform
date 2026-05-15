'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';

// Cross-cutting widget — Sticky thumb-zone CTA (iteration 0015 § Cross-cutting
// standards). Pinned `Start planning · free` button at the bottom of the
// viewport on mobile only. Hides on desktop (>=lg). Dims/hides when the
// Section 11 conversion module is in view, so it never overlaps the page's
// own primary CTA.
//
// PH is 80%+ mobile per DataReportal Digital 2024 Philippines.

export function StickyMobileCTA() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const target = document.getElementById('conversion-module');
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        // Hide the sticky CTA whenever any part of the conversion module is
        // visible — the page's own CTA is already in the viewport.
        setVisible(!entry.isIntersecting);
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 transition-opacity duration-200 lg:hidden ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[140%] bg-gradient-to-t from-cream via-cream/90 to-transparent"
      />
      <Link
        href="/signup"
        className="button-primary flex min-h-[48px] w-full items-center justify-center gap-2 px-6 text-sm font-semibold shadow-[0_12px_32px_-12px_rgba(26,26,26,0.35)]"
      >
        Start planning
        <span aria-hidden className="opacity-60">
          ·
        </span>
        <span className="opacity-90">free</span>
        <ArrowRight aria-hidden className="ml-1 h-4 w-4" strokeWidth={2} />
      </Link>
    </div>
  );
}
