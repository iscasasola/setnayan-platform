'use client';

/**
 * AdminSidebarMenu — admin-local FLAT menu row for the 6-menu sidebar.
 *
 * WHY (flatten · owner 2026-07-15 "solid menu with no submenus"): the admin rail
 * used to render each of the six menus as an EXPANDABLE parent (a chevron toggle
 * revealing ~15-25 group children inline). The owner locked every desktop sidebar
 * to a flat list of top-level doorways — sub-navigation belongs INSIDE the page
 * (the tabbed studios, the /admin/work worklist, and the group LANDINGS each
 * enumerate their children as tiles/cards), never as expandable children in the
 * rail. This extends the vendor 5-page IA (2026-07-12) + the couple plain-leaf
 * decision (2026-07-10) to the admin doorway.
 *
 * So this row now renders a SINGLE Link to the menu's hub landing (`/admin`,
 * `/admin/accounts`, `/admin/studio`, `/admin/ugat`, `/admin/app-performance`,
 * `/admin/money`) — no chevron, no toggle, no inline sub-list.
 *
 * ACTIVE-STATE is still computed across the group's items. The six landings are
 * hub pages, but the group's child ROUTES live on DISJOINT path roots
 * (Money's landing is /admin/money, yet its children are /admin/pricing,
 * /admin/settings, /admin/token-purchases …). A single matchPrefix on the hub
 * can't cover them, so the row lights when the hub matches OR when ANY of the
 * group's items match the current route (query-aware). That keeps e.g.
 * /admin/pricing?tab=token-bands lighting "Money" and /admin/verify lighting
 * "Overview" — the child routes still light their parent doorway, they just no
 * longer render as rows. The rolled-up queue-count badge (AdminSidebar
 * aggregates it onto the parent, worst-urgency tone) still renders so SLA
 * pressure stays visible in the flat rail.
 *
 * The `children` array is retained on the menu purely as the active-detection +
 * badge-rollup input — it is NEVER rendered as a sub-list (that is the whole
 * point of the flatten). Scope: app/admin/** only; does NOT modify the shared
 * nav primitives.
 */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { NavItem, NavBadgeTone } from '@/app/_components/nav/types';
import { matchesPath } from '@/app/_components/nav/match-path';

type Props = {
  menu: NavItem;
  pathname: string;
};

export function AdminSidebarMenu({ menu, pathname }: Props) {
  const children = menu.children ?? [];
  const searchParams = useSearchParams();

  // The doorway lights when the hub itself matches OR any of the group's child
  // routes matches (the children live on disjoint path roots, so a single
  // matchPrefix can't cover them — see the file header).
  const inSection =
    matchesPath(menu, pathname, searchParams) ||
    children.some((child) => matchesPath(child, pathname, searchParams));

  const Icon = menu.icon;

  return (
    <li>
      <Link
        href={menu.href}
        aria-current={inSection ? 'page' : undefined}
        title={menu.description ?? menu.label}
        className={`relative flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 hover:bg-[var(--m-sidebar-hover)]${inSection ? ' sn-bounce' : ''}`}
        style={{
          color: inSection ? 'var(--m-sidebar-fg)' : 'var(--m-sidebar-fg-soft)',
          background: inSection ? 'var(--m-sidebar-accent-soft)' : 'transparent',
          outlineColor: 'var(--m-sidebar-accent)',
        }}
      >
        {inSection ? (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-sm"
            style={{ background: 'var(--m-sidebar-accent)' }}
          />
        ) : null}
        <Icon
          aria-hidden
          className="h-6 w-6 shrink-0"
          strokeWidth={1.75}
          style={{ color: inSection ? 'var(--m-sidebar-accent-fg)' : 'var(--m-sidebar-fg-soft)' }}
        />
        <span className="truncate [[data-sidebar-collapsed='1']_&]:hidden">
          {menu.label}
        </span>
        {menu.badge && menu.badge.count > 0 ? (
          <Badge tone={menu.badge.tone} count={menu.badge.count} label={menu.badge.label} />
        ) : null}
      </Link>
    </li>
  );
}

/**
 * Compact count badge — mirrors <SidebarItem>'s Badge tone map so the admin
 * menu rows read identically to the shared primitive.
 */
function Badge({
  tone,
  count,
  label,
}: {
  tone: NavBadgeTone;
  count: number;
  label?: string;
}) {
  const tones: Record<NavBadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: 'bg-stone-100', fg: 'text-stone-700' },
    amber: { bg: 'bg-warn-100', fg: 'text-warn-900' },
    red: { bg: 'bg-red-100', fg: 'text-red-900' },
    orange: { bg: '', fg: '' },
  };
  const { bg, fg } = tones[tone];
  const display = count > 99 ? '99+' : String(count);

  if (tone === 'orange') {
    return (
      <span
        aria-label={label ?? `${count} new`}
        className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none [[data-sidebar-collapsed='1']_&]:hidden"
        style={{ background: 'color-mix(in srgb, var(--m-orange) 22%, transparent)', color: 'var(--m-orange-3)' }}
      >
        {display}
      </span>
    );
  }

  return (
    <span
      aria-label={label}
      className={`ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none ${bg} ${fg} [[data-sidebar-collapsed='1']_&]:hidden`}
    >
      {display}
    </span>
  );
}
