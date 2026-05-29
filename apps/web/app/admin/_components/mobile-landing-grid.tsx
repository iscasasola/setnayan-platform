/**
 * MobileLandingGrid — v2.1 Navigation Phase 3 (admin mobile overflow).
 *
 * WHY: CLAUDE.md 2026-05-23 row 2 admin doorway mobile lock specifies 4
 * mobile-overflow landing pages (/admin/queues + /admin/directory +
 * /admin/money + /admin/more) reachable from BottomNav. Each landing
 * page renders a .m-card grid of surface entries with icon + label +
 * 1-line description. This component is the shared renderer so all 4
 * pages consume the same NavItem[] shape from admin-sidebar.tsx — single
 * source of truth.
 *
 * SCOPE: server component, no client interactivity. Each card is a
 * <Link> with .m-card chrome from globals.css. Stacks single-column on
 * narrow phones, 2-column on tablet. Hidden via lg:hidden on desktop
 * because the sidebar handles overflow on that breakpoint.
 *
 * EMPTY-STATE: if items is empty, renders a polite brand-voice "Coming
 * soon" copy per [[feedback_setnayan_no_dev_text_post_launch]]. Should
 * not fire in V1 since all 4 landing pages have non-empty NavItem[]
 * lists in the admin-sidebar.tsx config.
 *
 * Per [[feedback_setnayan_orphan_prevention]] every NavItem on a landing
 * page maps 1:1 to a sidebar entry — no orphan surfaces introduced.
 */

import Link from 'next/link';
import type { NavItem } from '@/app/_components/nav/types';

type LandingItem = NavItem & {
  /** 1-line description rendered below the label on the landing card. */
  description: string;
};

type Props = {
  /** Page heading rendered above the grid. */
  title: string;
  /** Page sub-heading — 1 sentence brand-voice context. */
  subtitle: string;
  /** Cards to render. Must be non-empty in V1. */
  items: LandingItem[];
};

export function MobileLandingGrid({ title, subtitle, items }: Props) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:hidden">
      <header className="mb-6 space-y-2">
        <p
          className="m-label-mono"
          style={{ color: 'var(--m-slate-2)' }}
        >
          Admin
        </p>
        <h1
          className="m-display-tight text-3xl"
          style={{ color: 'var(--m-ink)' }}
        >
          {title}
        </h1>
        <p
          className="text-sm"
          style={{ color: 'var(--m-slate)' }}
        >
          {subtitle}
        </p>
      </header>

      {items.length === 0 ? (
        <div
          className="m-card p-8 text-center text-sm"
          style={{ color: 'var(--m-slate)' }}
        >
          Nothing here yet. The surfaces in this section appear once their
          features ship.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((item) => {
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
      )}
    </div>
  );
}

export type { LandingItem };
