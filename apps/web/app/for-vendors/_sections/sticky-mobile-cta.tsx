import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

// Sticky mobile CTA — pinned to the bottom of the viewport on small
// screens for thumb-zone access (per iter 0015 § Section 2 mobile-
// specific rule + Heyflow / Apple HIG / WCAG 2.2 SC 2.5.8 — 44–48px
// tap target). PH is 80%+ mobile per DataReportal Digital 2024 PH.

export function StickyMobileCta() {
  return (
    <div
      role="region"
      aria-label="Get started as a vendor"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-cream/95 px-4 py-3 backdrop-blur-md sm:hidden"
    >
      <div
        className="mx-auto flex max-w-md items-center gap-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Link
          href="/signup?as=vendor"
          className="button-primary inline-flex h-12 flex-1 items-center justify-center gap-2 px-4 text-sm font-semibold"
        >
          List your business — free
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </Link>
      </div>
    </div>
  );
}
