/**
 * VendorMobileLanding — v2.1 Navigation Phase 2 (vendor mobile overflow).
 *
 * WHY: CLAUDE.md tenth 2026-05-28 row v2.1 brief canonical lock + 14th
 * 2026-05-28 row System Wiring Map audit. The vendor doorway's 5-item
 * BottomNav (Profile · Bookings · Messages · Marketing · More) routes
 * everything not in the first 4 tabs through a /more landing page.
 * This component renders the landing as a section-grouped card grid —
 * single source of truth across desktop sidebar + mobile overflow.
 *
 * Mirrors apps/web/app/dashboard/[eventId]/_components/
 * customer-mobile-landing.tsx (Nav Phase 1 · PR #625) — same shape,
 * vendor-doorway copy. Lives in vendor-dashboard/_components/ so the
 * vendor doorway owns its own copy and the customer pattern doesn't
 * leak.
 *
 * SCOPE: server component, no client interactivity. Each card is a
 * <Link> with .m-card chrome from globals.css. Stacks single-column on
 * narrow phones, 2-column on tablet. Hidden via lg:hidden on desktop
 * because the sidebar handles overflow on that breakpoint.
 *
 * Per [[feedback_setnayan_orphan_prevention]] every card on this surface
 * maps 1:1 to a sidebar entry from VENDOR_NAV_GROUPS — no orphan
 * surfaces introduced. The matching is shape-driven: caller passes the
 * NavGroup[] and this renderer surfaces every NavItem in it.
 *
 * BRAND-VOICE descriptions per
 * [[feedback_setnayan_no_dev_text_post_launch]] — no schema names, no
 * engineering jargon, no "Coming soon" placeholders. Descriptions are
 * provided as a `descriptions` lookup map keyed by NavItem.key so the
 * sidebar tree (which doesn't carry descriptions) and the landing
 * surface (which needs them for the 2-line cards) stay decoupled.
 */

import Link from 'next/link';
import type { NavGroup } from '@/app/_components/nav/types';
import { MoreSearch } from '@/app/_components/more-search';

type Props = {
  /** Page heading rendered above the grid. */
  title: string;
  /** Page sub-heading — 1 sentence brand-voice context. */
  subtitle: string;
  /** NavGroup[] from VENDOR_NAV_GROUPS — the canonical sidebar tree. */
  groups: NavGroup[];
  /**
   * Lookup map keyed by NavItem.key returning the 1-line brand-voice
   * description rendered below the label on each card. Items without an
   * entry render without a description (defensively styled — but the V1
   * config below covers every key).
   */
  descriptions: Record<string, string>;
  /** Show a client filter input that searches cards by label. */
  searchable?: boolean;
};

export function VendorMobileLanding({ title, subtitle, groups, descriptions, searchable }: Props) {
  return (
    <div data-more-root className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:hidden">
      <header className="mb-6 space-y-2">
        <p className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
          Vendor
        </p>
        <h1 className="m-display-tight text-3xl" style={{ color: 'var(--m-ink)' }}>
          {title}
        </h1>
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          {subtitle}
        </p>
      </header>

      {searchable ? <MoreSearch placeholder="Search your tools" /> : null}

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section
            key={group.key}
            data-more-section
            aria-labelledby={`more-group-${group.key}`}
          >
            <h2
              id={`more-group-${group.key}`}
              className="m-label-mono mb-2 px-1"
              style={{ color: 'var(--m-slate-2)' }}
            >
              {group.label}
            </h2>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {group.items.map((item) => {
                const Icon = item.icon;
                const description = descriptions[item.key];
                return (
                  <li key={item.key} data-more-card data-more-label={item.label}>
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
                        {description ? (
                          <span
                            className="text-xs leading-relaxed"
                            style={{ color: 'var(--m-slate)' }}
                          >
                            {description}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {searchable ? (
        <p
          data-more-empty
          hidden
          className="m-card mt-5 p-8 text-center text-sm"
          style={{ color: 'var(--m-slate)' }}
        >
          No matches — try a different search.
        </p>
      ) : null}
    </div>
  );
}
