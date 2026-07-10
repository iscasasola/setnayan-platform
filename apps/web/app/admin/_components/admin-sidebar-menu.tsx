'use client';

/**
 * AdminSidebarMenu — admin-local expandable menu row for the 6-menu sidebar.
 *
 * WHY (declutter · owner 2026-07-10 "this is the admin?"): the 6-menu respine
 * (PR #2965) rendered every parent via the SHARED <SidebarItem>, whose sub-list
 * auto-expands whenever the active route is inside the section. Because the
 * admin LANDS on /admin — which IS the Overview ('queues') section's own hub —
 * the Overview parent matched on arrival and auto-exploded its ~18 queue
 * children, so the clean six-menu rail read as a long cluttered list that just
 * duplicated the queue TILES already on the /admin page.
 *
 * This admin-local primitive keeps the exact SidebarItem look (parent row +
 * indented children + rolled-up badge) but adds two things the shared route-only
 * primitive can't express without touching a component the OTHER doorways
 * import:
 *
 *   1. A real expand/collapse TOGGLE (the chevron is a button, not just an
 *      indicator), persisted per-section under the same
 *      `setnayan.nav.section.<key>.open` localStorage key the SidebarSection
 *      primitive uses ('1' = open, '0' = closed). An explicit user choice wins.
 *
 *   2. A per-menu DEFAULT open-state. With no stored preference the menu follows
 *      the route (auto-expand while active) — EXCEPT a menu flagged
 *      `collapsedWhenActive` (Overview/'queues'), which defaults COLLAPSED even
 *      on its own active landing. That is the declutter: the admin lands on six
 *      clean parent menus, the queues stay reachable via the page tiles + the
 *      work list, and the user can still open the section from its toggle.
 *
 * The rolled-up queue-count badge that AdminSidebar aggregates onto the parent
 * (worst-urgency tone) still renders while collapsed, so folding the queues
 * never hides SLA pressure.
 *
 * Scope: app/admin/** only. Does NOT modify the shared nav primitives — it
 * composes matchesPath + the shared types, and mirrors <SidebarItem>'s markup.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { NavItem, NavBadgeTone } from '@/app/_components/nav/types';
import { matchesPath, type ParamGetter } from '@/app/_components/nav/match-path';

type Props = {
  menu: NavItem;
  pathname: string;
  /**
   * When true, the menu defaults to COLLAPSED even while the active route is
   * inside it (the Overview/'queues' declutter). A stored user preference still
   * overrides this. When false (the other five menus) the default is the
   * shipped auto-expand-on-active behavior.
   */
  collapsedWhenActive?: boolean;
};

/**
 * The most-specific matching child's key, or null. "Most specific" = longest
 * matchPrefix — mirrors <SidebarItem> so only ONE child lights among siblings.
 */
function activeChildKey(
  children: NavItem[],
  pathname: string,
  currentParams: ParamGetter | null,
): string | null {
  let bestKey: string | null = null;
  let bestLen = -1;
  for (const child of children) {
    const matchPrefix = child.matchPrefix ?? child.href;
    if (matchesPath(child, pathname, currentParams) && matchPrefix.length > bestLen) {
      bestLen = matchPrefix.length;
      bestKey = child.key;
    }
  }
  return bestKey;
}

export function AdminSidebarMenu({ menu, pathname, collapsedWhenActive = false }: Props) {
  const children = menu.children ?? [];
  const searchParams = useSearchParams();

  const routeActiveKey = activeChildKey(children, pathname, searchParams);
  const inSection = matchesPath(menu, pathname, searchParams) || routeActiveKey !== null;

  // Default open-state: follow the route (auto-expand while active) unless this
  // menu is flagged to stay folded on its own landing.
  const defaultOpen = collapsedWhenActive ? false : inSection;
  const storageKey = `setnayan.nav.section.${menu.key}.open`;
  const panelId = `admin-nav-${menu.key}-items`;

  const [open, setOpen] = useState(defaultOpen);

  // After mount (and on route change), a stored preference wins; otherwise the
  // menu follows the route-driven default. `defaultOpen` is in the dep list so
  // navigating into/out of a section re-applies the default for menus the user
  // has never explicitly toggled.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(storageKey);
    } catch {
      // localStorage blocked — silently follow the default.
    }
    if (stored === '1') setOpen(true);
    else if (stored === '0') setOpen(false);
    else setOpen(defaultOpen);
  }, [storageKey, defaultOpen]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, next ? '1' : '0');
      } catch {
        // No-op — the in-memory toggle still works this session.
      }
      return next;
    });
  };

  const Icon = menu.icon;
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <li>
      {/* Parent row — the Link owns the whole row (navigates to the menu hub);
          the chevron TOGGLE is an absolutely-positioned sibling button over the
          right edge (valid HTML — never a <button> nested inside the <a>). */}
      <div className="relative flex items-center rounded-md transition-colors hover:bg-[var(--m-sidebar-hover)]">
        <Link
          href={menu.href}
          aria-current={inSection ? 'page' : undefined}
          title={menu.description ?? menu.label}
          className="flex min-h-[44px] flex-1 items-center gap-3 rounded-md py-2.5 pl-3 pr-9 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 [[data-sidebar-collapsed='1']_&]:pr-3"
          style={{
            color: inSection ? 'var(--m-sidebar-fg)' : 'var(--m-sidebar-fg-soft)',
            outlineColor: 'var(--m-sidebar-accent)',
          }}
        >
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
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`${open ? 'Collapse' : 'Expand'} ${menu.label}`}
          className="absolute inset-y-0 right-0 flex items-center rounded-md px-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 hover:bg-[var(--m-sidebar-bg-2)] [[data-sidebar-collapsed='1']_&]:hidden"
          style={{ outlineColor: 'var(--m-sidebar-accent)' }}
        >
          <Chevron
            aria-hidden
            className="h-3.5 w-3.5 shrink-0"
            strokeWidth={2}
            style={{ color: 'var(--m-sidebar-fg-muted)' }}
          />
        </button>
      </div>

      {/* Sub-list — present only when open, and hidden on the collapsed 64px
          icon rail (no room), same arbitrary-variant selector the labels use. */}
      {open ? (
        <ul
          id={panelId}
          className="mt-0.5 flex flex-col gap-0.5 [[data-sidebar-collapsed='1']_&]:hidden"
        >
          {children.map((child) => (
            <NestedRow
              key={child.key}
              item={child}
              active={child.key === routeActiveKey}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * A single indented child row — mirrors <SidebarItem>'s nested SidebarRow
 * (40px min-height, pl-9 indent, one size down). `active` is decided by the
 * parent (longest-match among siblings).
 */
function NestedRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const dim = item.muted && !active;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        title={item.description ?? item.label}
        className={`relative flex min-h-[40px] items-center gap-3 rounded-md py-2 pl-9 pr-3 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 hover:bg-[var(--m-sidebar-hover)]${active ? ' sn-bounce' : ''}`}
        style={{
          color: active ? 'var(--m-sidebar-fg)' : 'var(--m-sidebar-fg-soft)',
          background: active ? 'var(--m-sidebar-accent-soft)' : 'transparent',
          opacity: dim ? 0.5 : 1,
          outlineColor: 'var(--m-sidebar-accent)',
        }}
      >
        {active ? (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-sm"
            style={{ background: 'var(--m-sidebar-accent)' }}
          />
        ) : null}
        <Icon
          aria-hidden
          className="h-5 w-5 shrink-0"
          strokeWidth={1.75}
          style={{ color: active ? 'var(--m-sidebar-accent-fg)' : 'var(--m-sidebar-fg-soft)' }}
        />
        <span className="truncate [[data-sidebar-collapsed='1']_&]:hidden">
          {item.label}
        </span>
        {item.badge && item.badge.count > 0 ? (
          <Badge tone={item.badge.tone} count={item.badge.count} label={item.badge.label} />
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
