'use client';

import { useEffect, useState } from 'react';

/**
 * StudioSectionTabs — the desktop App Store-style segmented tab strip at the
 * top of the Studio hub (Setnayan AI · Website · Capture · Branding). Clicking
 * a tab smooth-scrolls to that section anchor; a scroll-spy lights the section
 * currently in view.
 *
 * Desktop only (lg:). On mobile the docked section sub-nav (customer-menu.ts
 * Studio children → the same anchors) already provides this, so rendering it
 * here too would duplicate. Sticky under the dashboard top bar.
 */

type Tab = { id: string; label: string };

export function StudioSectionTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState<string>(tabs[0]?.id ?? '');

  useEffect(() => {
    const els = tabs
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Bias the active band toward the upper third of the viewport so the tab
      // flips as a section's heading reaches the top, not its middle.
      { rootMargin: '-20% 0px -65% 0px', threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [tabs]);

  function go(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActive(id);
  }

  return (
    <nav
      aria-label="Studio sections"
      className="sticky top-0 z-10 -mx-1 hidden border-b border-ink/10 bg-cream/85 px-1 py-2 backdrop-blur lg:block"
    >
      <ul className="flex gap-1">
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => go(t.id)}
                aria-current={isActive ? 'true' : undefined}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-ink text-cream'
                    : 'text-ink/60 hover:bg-ink/[0.06] hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
