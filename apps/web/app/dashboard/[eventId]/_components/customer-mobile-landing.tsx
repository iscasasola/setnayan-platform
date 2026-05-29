/**
 * CustomerMobileLanding — v2.1 Navigation Phase 1 (customer mobile overflow).
 *
 * WHY: CLAUDE.md tenth 2026-05-28 row v2.1 brief canonical lock + 14th
 * 2026-05-28 row System Wiring Map audit. The customer doorway's 5-item
 * BottomNav (Today · Home · Guests · Website · More) routes everything
 * not in the first 4 tabs through a /more landing page. This component
 * renders the landing as a section-grouped card grid — single source of
 * truth across desktop sidebar + mobile overflow + per-section landings.
 *
 * Mirrors apps/web/app/admin/_components/mobile-landing-grid.tsx (PR #606)
 * but lives in the dashboard/[eventId]/_components/ folder so the
 * customer doorway owns its own copy — keeps the admin pattern from
 * leaking into the customer surface + lets the customer landing add
 * per-section group headings ("Plan · Spend · Communicate · ..."). The
 * admin equivalent renders a flat card grid because each landing page
 * is already a single group; the customer /more landing surfaces 7
 * groups in one place, so a grouped layout is the natural shape.
 *
 * SCOPE: server component, no client interactivity. Each card is a
 * <Link> with .m-card chrome from globals.css. Stacks single-column on
 * narrow phones, 2-column on tablet. Hidden via lg:hidden on desktop
 * because the sidebar handles overflow on that breakpoint.
 *
 * Per [[feedback_setnayan_orphan_prevention]] every card on this surface
 * maps 1:1 to a sidebar entry from buildCustomerNavGroups — no orphan
 * surfaces introduced. The matching is shape-driven: caller passes the
 * NavGroup[] and this renderer surfaces every NavItem in it.
 *
 * BRAND-VOICE descriptions per
 * [[feedback_setnayan_no_dev_text_post_launch]] — no schema names, no
 * engineering jargon, no "Coming soon" placeholders. Descriptions are
 * provided as a `descriptions` lookup map keyed by NavItem.key so the
 * sidebar tree (which doesn't carry descriptions) and the landing surface
 * (which needs them for the 2-line cards) stay decoupled.
 */

import Link from 'next/link';
import type { NavGroup } from '@/app/_components/nav/types';

type Props = {
  /** Page heading rendered above the grid. */
  title: string;
  /** Page sub-heading — 1 sentence brand-voice context. */
  subtitle: string;
  /** NavGroup[] from buildCustomerNavGroups — the canonical sidebar tree. */
  groups: NavGroup[];
  /**
   * Lookup map keyed by NavItem.key returning the 1-line brand-voice
   * description rendered below the label on each card. Items without an
   * entry render without a description (defensively styled — but the V1
   * config below covers every key).
   */
  descriptions: Record<string, string>;
};

export function CustomerMobileLanding({ title, subtitle, groups, descriptions }: Props) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:hidden">
      <header className="mb-6 space-y-2">
        <p className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
          Event
        </p>
        <h1 className="m-display-tight text-3xl" style={{ color: 'var(--m-ink)' }}>
          {title}
        </h1>
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          {subtitle}
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`more-group-${group.key}`}>
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
    </div>
  );
}
