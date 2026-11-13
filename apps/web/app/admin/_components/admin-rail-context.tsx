'use client';

/**
 * admin-rail-context.tsx — Setnayan HQ's own menu, inside the ONE shell.
 *
 * One Shell slice 3 (`ONE_SHELL_PLAN_2026-08-13.md` § 2). Owner, 2026-08-13,
 * over three YouTube screenshots in which the left rail never leaves: *"the
 * sidebar should stay. look at here as we navigate around. what you did was
 * jumping back to the old dashboards."* `DECISION_LOG.md` 2026-08-13.
 *
 * ─── IT PUSHES, IT DOES NOT SWAP ──────────────────────────────────────────
 * This is the `railContext` slot of the shared shell. Everything above it —
 * Home, Stories, Marketplace, and the person's own My Home rows — STAYS
 * EXACTLY WHERE IT WAS when you walk into HQ. That is the entire difference
 * between one shell and two, and it is why this is a fragment of rows rather
 * than a component that owns a rail.
 *
 * ─── THE FIVE TABS, FROM THE ONE SOURCE (owner 13 Nov 2026) ──────────────
 * 🔒 The approved admin (`Setnayan-specs/prototypes/admin_pub/`, DECISION_LOG
 * 2026-11-13 "ADMIN DRAWING APPROVED — BUILD IT") is five tabs — Work · Money ·
 * People · Catalogue · Insights — and on a computer they are this rail (the
 * drawing's Place map: "desktop/tablet: the five tabs as the left rail", owner
 * 2026-10-28). The rows come from `lib/admin/admin-tabs.ts`, the same list the
 * phone bar draws, so the two can never name a place differently. The old six
 * groups + "All surfaces" (`ADMIN_NAV_GROUPS`) no longer draw the rail; every
 * page they reached is a view of one of the five tabs, picked from the pinned
 * row's `Page · View ▾` (`admin-routes-all-have-a-tab.test.ts`).
 *
 * ─── WHY THE ROWS WEAR `.fd-*` AND NOT `--m-sidebar-*` ────────────────────
 * The rail is chrome and paints the front door's cream (`.fd[data-chrome='app']
 * .fd-rail`). The old admin row styled itself from `--m-sidebar-fg` /
 * `--m-sidebar-accent-soft`, which are the tokens of the panel that is gone —
 * on this surface they would read as a second rail pasted inside the first.
 * One shell means one row grammar: `.fd-row` + `data-on`, exactly as the
 * account rows above it.
 *
 * ⚠ THE 72px ICON STRIP DROPS THE COUNT — DECIDED, NOT DISCOVERED.
 * Between 1024px and 1280px the rail is a 72px icon strip and the stylesheet
 * hides `.fd-ct` (and shows `.fd-icon-caption`). So the queue badge is not
 * visible there. That is the SAME behaviour the old rail had when collapsed to
 * 64px (its Badge carried `[[data-sidebar-collapsed='1']_&]:hidden`), so
 * nothing regressed — and it is only acceptable because SLA pressure has a
 * second, always-visible channel: the overdue / due-soon pill in the admin top
 * bar, which renders on every admin page at every width. `admin-rail-context.
 * test.ts` pins that pill for exactly this reason. If the pill ever goes, this
 * badge must stop being a `.fd-ct`.
 */

import Link from 'next/link';

import type { NavBadgeTone } from '@/app/_components/nav/types';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type { AdminQueueCounts } from '@/lib/admin/queue-counts';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import { ADMIN_TABS, activeAdminTabKey } from '@/lib/admin/admin-tabs';

import { ADMIN_TAB_ICON, workBadge } from './admin-bottom-nav';
import { useAdminAddress } from './admin-tab-rows';
import { formatCount } from '@/lib/format-number';

/** The rail's own count colours. Neutral is the rail's meta ink; amber and red
 *  are the semantic tokens the top-bar pill and the queue tiles already use, so
 *  one urgency reads the same everywhere. */
const BADGE_TONE: Record<NavBadgeTone, string> = {
  neutral: 'text-ink/60',
  amber: 'text-warn-800',
  red: 'text-red-800',
  orange: 'text-ink/60',
};

export function AdminRailContext({
  navSlots,
  queueCounts,
  overdue = 0,
  dueSoon = 0,
  unreadable = 0,
  at,
}: {
  navSlots?: Record<string, NavSlotLite>;
  queueCounts?: AdminQueueCounts;
  /** Lab only — an address drawn on fixtures. */
  at?: string;
  overdue?: number;
  dueSoon?: number;
  unreadable?: number;
}) {
  /*
    QUERY-AWARE, because the admin's own routes are: `/admin/studio?tab=referrals`
    is Money while `/admin/studio` is Catalogue. `useSearchParams()` returns null
    on the first static paint, which the matcher reads as "no params" — it
    resolves on hydration.
  */
  const { pathname, params } = useAdminAddress(at);
  const activeKey = activeAdminTabKey(pathname, params);
  const badge = workBadge(queueCounts, overdue, dueSoon, unreadable);

  return (
    <>
      <div className="fd-rdiv" />
      <div className="fd-rlabel">
        Setnayan HQ <small>the console</small>
      </div>
      {ADMIN_TABS.map((tab) => {
        // The same registry slot the phone bar reads, so a rename reads the same at every width.
        const slot = navSlots?.[`admin.bottom-nav.${tab.key}`];
        if (slot?.isHidden) return null;
        const label = slot?.label ?? tab.label;
        const Icon = slot ? navIconComponent(slot.icon) : ADMIN_TAB_ICON[tab.icon];
        const active = activeKey === tab.key;
        const b = tab.key === 'work' ? badge : null;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            title={label}
            /*
              `data-on` is the stylesheet's hook; `aria-current` is the half a screen
              reader gets. NEITHER IS EVER A LITERAL — a hardcoded `data-on="true"`
              would light this row on every admin page. `admin-rail-context.test.ts`
              fails if a literal returns.
            */
            className="fd-row"
            data-on={active ? 'true' : 'false'}
            aria-current={active ? 'page' : undefined}
            data-admin-rail={tab.key}
          >
            <span className="fd-gi inline-flex items-center justify-center" aria-hidden>
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </span>
            <span className="fd-label-text">{label}</span>
            {/* One word per tab, so the 72px strip's caption IS the name — never a second copy of it. */}
            <span className="fd-icon-caption">{label}</span>
            {b ? (
              <span className={`fd-ct fd-mono font-semibold ${BADGE_TONE[b.tone]}`} aria-label={b.label}>
                {b.text ?? (b.count > 99 ? '99+' : formatCount(b.count))}
              </span>
            ) : null}
          </Link>
        );
      })}
    </>
  );
}
