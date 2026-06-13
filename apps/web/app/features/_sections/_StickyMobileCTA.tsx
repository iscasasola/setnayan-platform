'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { MarketingLocale } from '@/lib/marketing-i18n';

// Sticky thumb-zone primary CTA on mobile per the marketing-page
// cross-cutting standards (per Heyflow / Apple HIG; PH is 80%+ mobile per
// DataReportal Digital 2024 Philippines). Hides until the visitor scrolls
// past the hero, so it doesn't double-up on the in-hero CTA above the fold.

const LABEL: Record<MarketingLocale, string> = {
  en: 'Start planning · free',
  tl: 'Magsimula · free',
};

export function StickyMobileCTA({ locale }: { locale: MarketingLocale }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function onScroll() {
      // Show after scrolling 60vh — past the hero on most viewports.
      const trigger = window.innerHeight * 0.6;
      setVisible(window.scrollY > trigger);
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-cream/95 px-4 py-3 backdrop-blur transition-transform duration-200 supports-[backdrop-filter]:bg-cream/85 sm:hidden ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <Link
        href="/signup"
        tabIndex={visible ? 0 : -1}
        className="button-primary flex h-12 w-full items-center justify-center gap-2 text-sm"
      >
        {LABEL[locale]}
        <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </Link>
    </div>
  );
}
