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

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ADMIN_NAV_ALIASES } from './admin-nav-descriptions';
import { buildDestinations } from './admin-destinations';
import type { NavItem } from '@/app/_components/nav/types';
import { MoreSearch } from '@/app/_components/more-search';
import { PageMasthead } from '@/app/_components/page-masthead';

/**
 * The desktop palette's haystack, by address. Built once per render of a server
 * component — `buildDestinations` is pure and reads only generated constants.
 * The fallback below it keeps a card that has no destination row (a grid item
 * that is not in the admin menu) filtering exactly as it did before, rather than
 * silently matching nothing.
 */
const DESKTOP_HAY = new Map(buildDestinations().map((d) => [d.href, d.hay]));

type LandingItem = NavItem & {
  /** 1-line description rendered below the label on the landing card. */
  description: string;
  /** Optional badge count (e.g. unread) shown top-right of the card. */
  count?: number;
};

/** A labeled section for the grouped ("More") layout. */
type LandingGroup = {
  label: string;
  items: LandingItem[];
};

type Props = {
  /**
   * The page name. Kept in the document as an `sr-only` <h1> — it is what a
   * screen reader announces on arrival and what a skip link points at.
   */
  title: string;
  /**
   * A sentence that belongs BESIDE the cards, not above them as a subtitle.
   *
   * ⚖ This is not the retired `subtitle` under a new name. That prop carried
   * orientation — "every admin page there is, grouped and searchable" over a
   * grid of exactly that — and it is gone. This one exists for a sentence that
   * points somewhere the cards do NOT go, which is the one thing a grid of
   * links cannot say for itself. Only `/admin/money` passes it today.
   */
  note?: ReactNode;
  /** Flat card list (the /admin/directory + /admin/money landings). */
  items?: LandingItem[];
  /** Labeled sections (the redesigned /admin/more layout). Wins over `items`. */
  groups?: LandingGroup[];
  /** Show a client filter input that searches cards by label (the /more layout). */
  searchable?: boolean;
  /**
   * Render on desktop too (drops the lg:hidden + widens to a 3-column grid).
   * The 6-menu respine (2026-07-09) promotes the hub landings (/admin/ugat ·
   * /admin/money) to real desktop surfaces — each sidebar menu lands on one
   * integrated page. Mobile-only overflow landings (/admin/more ·
   * /admin/directory) leave this unset.
   */
  desktopVisible?: boolean;
};

function LandingCard({ item }: { item: LandingItem }) {
  const Icon = item.icon;
  const count = item.count ?? 0;
  return (
    <li
      data-more-card
      data-more-label={item.label}
      // 🔑 THE SAME HAYSTACK THE DESKTOP PALETTE SEARCHES — and as of 2026-08-26
      // that is taken FROM the desktop rather than rebuilt beside it.
      //
      // 🪤 THE PARITY THIS COMMENT CLAIMED HAD ALREADY LAPSED. It listed name +
      // description + aliases, which WAS the desktop's haystack when it was
      // written. The desktop has since gained the scanned route map, the old
      // addresses of ~40 pages that moved into tabs, and the words of 283 jobs —
      // so the phone quietly fell 234 words behind while a comment above it said
      // the two were identical. A sentence is not a mechanism: read the
      // destination's own haystack, and the two cannot diverge again.
      data-more-hay={
        DESKTOP_HAY.get(item.href ?? '') ??
        [item.label, item.description, ADMIN_NAV_ALIASES[item.key] ?? '']
          .join(' ')
          .toLowerCase()
      }
    >
      <Link
        href={item.href}
        className="m-card relative flex h-full items-start gap-3 p-4 transition-colors hover:bg-[var(--m-paper)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--m-nav-active)]"
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
            style={{ color: 'var(--m-nav-active)' }}
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
        {count > 0 ? (
          <span
            className="absolute right-3 top-3 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 font-mono text-[11px] font-semibold"
            style={{ background: 'var(--m-mulberry)', color: '#fff' }}
          >
            <span aria-hidden>{count > 99 ? '99+' : count}</span>
            <span className="sr-only">{`${count} new`}</span>
          </span>
        ) : null}
      </Link>
    </li>
  );
}

export function MobileLandingGrid({
  title,
  note,
  items,
  groups,
  searchable,
  desktopVisible,
}: Props) {
  // Normalize to sections: explicit `groups` win; else a single unlabeled
  // section from the flat `items` (backward-compatible with directory/money).
  const sections: LandingGroup[] = groups ?? (items ? [{ label: '', items }] : []);
  const isEmpty = sections.every((s) => s.items.length === 0);

  return (
    <div
      data-more-root
      className={`mx-auto w-full px-4 py-6 sm:px-6 ${
        desktopVisible ? 'max-w-5xl lg:px-8 lg:py-10' : 'max-w-3xl lg:hidden'
      }`}
    >
      {/* The page starts at its content. This header used to draw all three
          retired rungs at once — a mono "Admin" eyebrow (killed 2026-07-21),
          a 30px `m-display-tight` name (killed 2026-08-21) and a subtitle
          sentence (killed 2026-08-18) — on the three surfaces that map the
          whole console. The name stays in the document at zero pixels; the
          cards and the search box are what the operator came for. */}
      <PageMasthead title={title} />
      {note ? <p className="mb-6 max-w-2xl text-sm text-ink/70">{note}</p> : null}

      {searchable && !isEmpty ? <MoreSearch placeholder="Search settings & insights" /> : null}

      {isEmpty ? (
        <div className="m-card p-8 text-center text-sm" style={{ color: 'var(--m-slate)' }}>
          Nothing here yet. The surfaces in this section appear once their
          features ship.
        </div>
      ) : (
        <>
          <div className="space-y-7">
            {sections.map((section, i) => (
              <section key={section.label || i} data-more-section className="space-y-3">
                {section.label ? (
                  <h2 className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
                    {section.label}
                  </h2>
                ) : null}
                <ul
                  className={`grid grid-cols-1 gap-3 sm:grid-cols-2${
                    desktopVisible ? ' lg:grid-cols-3' : ''
                  }`}
                >
                  {section.items.map((item) => (
                    <LandingCard key={item.key} item={item} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {searchable ? (
            <p
              data-more-empty
              hidden
              className="m-card p-8 text-center text-sm"
              style={{ color: 'var(--m-slate)' }}
            >
              No matches — try a different search.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

export type { LandingItem, LandingGroup };
