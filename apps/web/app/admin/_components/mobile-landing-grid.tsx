/**
 * MobileLandingGrid — v2.1 Navigation Phase 3 (admin mobile overflow).
 *
 * WHY: ops-shaped nav redesign 2026-06-08 — the admin mobile strip is a
 * 5-tab spine (Home · Work · Directory · Money · More). This shared renderer
 * backs the card-grid landings (/admin/directory + /admin/money + /admin/more);
 * /admin/work uses the QueuesTriageFeed instead (a prioritized action feed, not
 * a card menu). Each card renders icon + label + 1-line description. Items
 * mirror the admin-sidebar.tsx groups — single source of truth.
 *
 * LAYOUT: pass `items` for a single flat grid (the directory/money landings),
 * or `groups` for the redesigned, labeled-section layout (the /more overflow —
 * 2026-06-21 nav redesign). `groups` wins when both are given; each group renders
 * a small mono eyebrow header + its own card grid.
 *
 * SCOPE: server component, no client interactivity. Each card is a <Link> with
 * .m-card chrome from globals.css. Single-column on phones, 2-column on tablet.
 * Hidden via lg:hidden on desktop because the sidebar handles overflow there.
 *
 * Per [[feedback_setnayan_orphan_prevention]] every NavItem on a landing page
 * maps 1:1 to a sidebar entry — no orphan surfaces introduced.
 */

import Link from 'next/link';
import type { NavItem } from '@/app/_components/nav/types';

type LandingItem = NavItem & {
  /** 1-line description rendered below the label on the landing card. */
  description: string;
};

/** A labeled section for the grouped ("More") layout. */
type LandingGroup = {
  label: string;
  items: LandingItem[];
};

type Props = {
  /** Page heading rendered above the grid. */
  title: string;
  /** Page sub-heading — 1 sentence brand-voice context. */
  subtitle: string;
  /** Flat card list (the /admin/directory + /admin/money landings). */
  items?: LandingItem[];
  /** Labeled sections (the redesigned /admin/more layout). Wins over `items`. */
  groups?: LandingGroup[];
};

function LandingCard({ item }: { item: LandingItem }) {
  const Icon = item.icon;
  return (
    <li>
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
          <span className="text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
            {item.label}
          </span>
          <span className="text-xs leading-relaxed" style={{ color: 'var(--m-slate)' }}>
            {item.description}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function MobileLandingGrid({ title, subtitle, items, groups }: Props) {
  // Normalize to sections: explicit `groups` win; else a single unlabeled
  // section from the flat `items` (backward-compatible with directory/money).
  const sections: LandingGroup[] = groups ?? (items ? [{ label: '', items }] : []);
  const isEmpty = sections.every((s) => s.items.length === 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:hidden">
      <header className="mb-6 space-y-2">
        <p className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
          Admin
        </p>
        <h1 className="m-display-tight text-3xl" style={{ color: 'var(--m-ink)' }}>
          {title}
        </h1>
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          {subtitle}
        </p>
      </header>

      {isEmpty ? (
        <div className="m-card p-8 text-center text-sm" style={{ color: 'var(--m-slate)' }}>
          Nothing here yet. The surfaces in this section appear once their
          features ship.
        </div>
      ) : (
        <div className="space-y-7">
          {sections.map((section, i) => (
            <section key={section.label || i} className="space-y-3">
              {section.label ? (
                <h2 className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
                  {section.label}
                </h2>
              ) : null}
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {section.items.map((item) => (
                  <LandingCard key={item.key} item={item} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export type { LandingItem };
