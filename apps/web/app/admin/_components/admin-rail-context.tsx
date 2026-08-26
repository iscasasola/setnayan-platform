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
 * ─── THE SIX ROWS ARE NOT REDRAWN HERE ────────────────────────────────────
 * 🔒 `ADMIN_NAV_GROUPS` → `adminRailMenus()` in `admin-sidebar.tsx` is THE
 * source: six groups rendered FLAT as six top-level rows (owner 2026-07-15,
 * *"solid menu with no submenus"*) — Today · People & shops · Studio · Set up ·
 * Numbers · Money — then "All surfaces", which is a LINK to /admin/more and is
 * deliberately NOT a seventh group. This file chooses the ELEMENT, never the
 * membership. If a row is wrong, the fix is in the groups.
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
import { usePathname, useSearchParams } from 'next/navigation';

import type { NavBadgeTone, NavItem } from '@/app/_components/nav/types';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type {
  AdminQueueCounts,
  AdminQueueDueState,
} from '@/lib/admin/queue-counts';

import { adminRailMenus, activeAdminMenuKey } from './admin-sidebar';

/**
 * The word under the icon at the 72px strip. The full label is often two words
 * ("People & shops", "All surfaces") and the strip is one ellipsised line, so a
 * caption that is just the label truncates — rows that read the same at a
 * glance. These are the distinguishing word, chosen the way the shared rows
 * choose theirs.
 *
 * A key with no entry falls back to the label; a missing caption costs
 * legibility at one breakpoint, never a row.
 *
 * 🛑 THIS IS A SECOND COPY OF EVERY MENU NAME, AND IT SILENTLY OUT-RANKED THE
 * FIRST. Between 1024px and 1280px the stylesheet hides `.fd-label-text` and
 * shows `.fd-icon-caption`, so on that width THIS MAP IS THE MENU — the group
 * label is in the markup and invisible. The 2026-08-25 recut renamed the six
 * groups in `ADMIN_NAV_GROUPS` and did not touch this, so the owner opened the
 * console the next morning and reported, correctly, *"it still looks the
 * same"*: he was reading the captions. A caption must be a contiguous word-run
 * of its own group's label, and `the-menu-name-has-one-source.test.ts` fails
 * if it is not — so the next rename cannot leave this behind in silence.
 */
const STRIP_CAPTION: Record<string, string> = {
  queues: 'Today',
  directory: 'People',
  media: 'Studio',
  ugat: 'Set up',
  funnels: 'Numbers',
  'settings-group': 'Money',
  'all-surfaces': 'All',
};

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
  queueStates,
}: {
  navSlots?: Record<string, NavSlotLite>;
  queueCounts?: AdminQueueCounts;
  queueStates?: Record<string, AdminQueueDueState>;
}) {
  const pathname = usePathname() ?? '/admin';
  /*
    QUERY-AWARE, because the admin's own routes are. The Accounts and Studio
    hubs ship sibling tabs (`/admin/accounts?tab=users` vs `?tab=events`) and
    the shipped matcher reads them; dropping the params here would light the
    same row for both, which is the double-lighting `match-path.ts` was written
    to end. `useSearchParams()` returns null on the first static paint and the
    matcher documents that as "no params present" — it resolves on hydration.
  */
  const searchParams = useSearchParams();

  const menus = adminRailMenus({ navSlots, queueCounts, queueStates });
  const activeKey = activeAdminMenuKey(menus, pathname, searchParams);

  return (
    <>
      <div className="fd-rdiv" />
      <div className="fd-rlabel">
        Setnayan HQ <small>the console</small>
      </div>
      {menus.map((menu) => (
        <AdminRailRow key={menu.key} menu={menu} active={activeKey === menu.key} />
      ))}
    </>
  );
}

function AdminRailRow({ menu, active }: { menu: NavItem; active: boolean }) {
  const Icon = menu.icon;
  return (
    <Link
      href={menu.href}
      title={menu.description ?? menu.label}
      /*
        `data-on` is the stylesheet's hook; `aria-current` is the half a screen
        reader gets, and a rail that only looks right is only half right.
        NEITHER IS EVER A LITERAL — the front-door rail shipped with `Home`
        hardcoded `data-on="true"`, which was harmless on the one URL it
        rendered on and would have lit Home on all 296 pages the moment the
        same rail moved inside the app. `admin-rail-context.test.ts` fails if a
        literal returns.
      */
      className="fd-row"
      data-on={active ? 'true' : 'false'}
      aria-current={active ? 'page' : undefined}
    >
      <span className="fd-gi inline-flex items-center justify-center" aria-hidden>
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
      <span className="fd-label-text">{menu.label}</span>
      <span className="fd-icon-caption">{STRIP_CAPTION[menu.key] ?? menu.label}</span>
      {menu.badge && menu.badge.count > 0 ? (
        <span
          className={`fd-ct fd-mono font-semibold ${BADGE_TONE[menu.badge.tone]}`}
          aria-label={menu.badge.label}
        >
          {menu.badge.count > 99 ? '99+' : menu.badge.count}
        </span>
      ) : null}
    </Link>
  );
}
