'use client';

/**
 * MobileLandingAccordion — admin mobile "More" overflow as a 3-section
 * accordion (ops-shaped nav redesign 2026-06-08 · PR 3).
 *
 * WHY: the "More" tab previously rendered a flat 24-card grid
 * (MobileLandingGrid). The redesign (Admin_Console_Nav_Redesign_2026-06-08
 * §5) calls for a grouped, collapsible accordion — never a flat dump — so an
 * admin can scan the three tune-groups (Insights · Money & Catalog ·
 * Platform) and collapse the ones they don't need. Sections start expanded
 * (no discoverability regression vs the flat grid); each is collapsible with
 * a chevron. Client component (the collapse state is interactive).
 *
 * Item card markup is intentionally identical to MobileLandingGrid so the two
 * landings read the same. lg:hidden — desktop uses the sidebar tree.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { LandingItem } from './mobile-landing-grid';

export type AccordionSectionData = {
  /** Stable key (also the localStorage-able id if persistence is added later). */
  key: string;
  /** Section heading rendered as an m-label-mono eyebrow. */
  label: string;
  items: LandingItem[];
};

type Props = {
  title: string;
  subtitle: string;
  sections: AccordionSectionData[];
};

export function MobileLandingAccordion({ title, subtitle, sections }: Props) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:hidden">
      <header className="mb-6 space-y-2">
        <p className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
          Admin
        </p>
        <h1
          className="m-display-tight text-3xl"
          style={{ color: 'var(--m-ink)' }}
        >
          {title}
        </h1>
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          {subtitle}
        </p>
      </header>

      <div className="space-y-5">
        {sections.map((section) => (
          <AccordionSection key={section.key} section={section} />
        ))}
      </div>
    </div>
  );
}

function AccordionSection({ section }: { section: AccordionSectionData }) {
  const [open, setOpen] = useState(true);
  const panelId = `more-acc-${section.key}`;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="mb-2 flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-[var(--m-paper-2)]"
      >
        <span className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
          {section.label}
        </span>
        <span
          className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
          style={{ background: 'var(--m-paper-2)', color: 'var(--m-slate)' }}
        >
          {section.items.length}
        </span>
        <ChevronDown
          aria-hidden
          className={`ml-auto h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`}
          strokeWidth={2}
          style={{ color: 'var(--m-slate-2)' }}
        />
      </button>

      {open ? (
        <ul
          id={panelId}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {section.items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="m-card flex h-full items-start gap-3 p-4 transition-colors hover:bg-[var(--m-paper)]"
                  style={{ color: 'var(--m-ink)' }}
                >
                  <span
                    className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                    style={{ background: 'var(--m-paper-2)' }}
                  >
                    <Icon
                      aria-hidden
                      className="h-5 w-5"
                      strokeWidth={1.75}
                      style={{ color: 'var(--m-orange-2)' }}
                    />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span
                      className="text-base font-semibold"
                      style={{ color: 'var(--m-ink)' }}
                    >
                      {item.label}
                    </span>
                    <span
                      className="text-xs leading-relaxed"
                      style={{ color: 'var(--m-slate)' }}
                    >
                      {item.description}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
