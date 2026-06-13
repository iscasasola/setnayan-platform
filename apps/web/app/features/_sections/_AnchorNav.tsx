'use client';

import { useEffect, useRef, useState } from 'react';
import type { MarketingLocale } from '@/lib/marketing-i18n';

// Sticky horizontal scroll-spy nav. Native anchor links + IntersectionObserver
// for active-state highlighting. Accessible: keyboard-focusable, visible
// focus rings, no JS required for navigation (graceful — links work even if
// the IO callback never fires). Active pill scrolls into view on small
// screens so the visitor can always see where they are.
//
// The category chips read in English in BOTH locales by design: "planning
// toolkit", "vendors", "budget" are the terms Filipino couples actually use
// when speaking Taglish, so translating them would read less natural, not
// more. Only the nav's accessible label localizes.

type NavItem = { id: string; label: string };

const NAV_ITEMS: NavItem[] = [
  { id: 'planning-toolkit', label: 'Planning toolkit' },
  { id: 'communications', label: 'Communications' },
  { id: 'vendors-ledger', label: 'Vendors & ledger' },
  { id: 'day-of-apparatus', label: 'Day-of apparatus' },
  { id: 'outsourcing-pacing', label: 'Outsourcing & pacing' },
  { id: 'compliance', label: 'Compliance & receipts' },
];

const NAV_ARIA_LABEL: Record<MarketingLocale, string> = {
  en: 'Feature sections',
  tl: 'Mga seksyon ng features',
};

export function FeaturesAnchorNav({ locale }: { locale: MarketingLocale }) {
  const [activeId, setActiveId] = useState<string>(NAV_ITEMS[0]?.id ?? '');
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const sections = NAV_ITEMS.map(({ id }) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null,
    );

    if (sections.length === 0) return;

    // Top margin allows for the sticky header + this anchor nav (~120px combined).
    // Bottom margin biases activation toward sections in the upper viewport, so
    // the highlighted pill matches what the user is reading.
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry that is most prominently in view.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: '-120px 0px -55% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  // Scroll active pill into view on small screens so the user always sees
  // their position in the nav.
  useEffect(() => {
    if (!navRef.current) return;
    const activeBtn = navRef.current.querySelector<HTMLAnchorElement>(
      `a[data-nav-id="${activeId}"]`,
    );
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeId]);

  return (
    <nav
      ref={navRef}
      aria-label={NAV_ARIA_LABEL[locale]}
      className="sticky top-0 z-30 border-b border-ink/10 bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/80"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <ul className="flex gap-2 overflow-x-auto py-3 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {NAV_ITEMS.map((item) => {
            const isActive = activeId === item.id;
            return (
              <li key={item.id} className="shrink-0">
                <a
                  data-nav-id={item.id}
                  href={`#${item.id}`}
                  aria-current={isActive ? 'true' : undefined}
                  className={`inline-flex h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream ${
                    isActive
                      ? 'border-terracotta bg-terracotta text-cream'
                      : 'border-ink/15 bg-cream text-ink/70 hover:border-ink/30 hover:text-ink'
                  }`}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
