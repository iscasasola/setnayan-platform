/**
 * SidebarItem — v2.1 Navigation Refactor Phase 0.
 *
 * WHY: CLAUDE.md 2026-05-28 11th row "v2.1 template package adoption" +
 * 14th 2026-05-28 row System Wiring Map audit. Single-item primitive
 * consumed by Phases 1-3 sidebar trees across the 3 doorways. Owns the
 * per-link rendering: icon (24px) + label + optional badge + active
 * accent treatment. Stays a server component because all interaction
 * is delegated to <Link> (no useState/useEffect required).
 *
 * SCOPE: single nav item row. Active detection happens here against
 * the caller-provided pathname (server-rendered against the request
 * URL). Sidebar collapsed-state hiding of the label happens via CSS
 * arbitrary-variant selectors on the parent `[data-sidebar-collapsed="1"]`
 * — no prop drilling.
 *
 * ACTIVE TREATMENT: 3px left accent bar in --m-orange + tint background
 * (--m-orange-4) + ink text color + orange icon. Inactive: slate text +
 * slate icon + transparent bg. Hover: paper-3 tint. Matches the v2.1
 * editorial restraint of the template — no heavy fills, no shadows on
 * active state.
 *
 * BADGE TONES (NavBadgeTone union from types.ts):
 *   - 'neutral' — stone tint (generic count)
 *   - 'amber'   — warning (pending queue)
 *   - 'red'     — error / urgent
 *   - 'orange'  — brand accent (new highlight)
 *
 * MIN-HEIGHT 44px per WCAG 2.5.5 / Apple HIG touch-target floor.
 *
 * NESTED SUB-ITEMS (owner 2026-06-17 "let the subnav expand from the side nav"):
 * when `item.children` is present the item is an expandable PARENT — the
 * desktop-sidebar home of what the mobile <SubNav> pill shows. It auto-expands
 * (no manual toggle) while the active route is INSIDE the section — the parent
 * OR any child matches the path — and collapses otherwise. The most-specific
 * (longest matchPrefix) child is the active LEAF and carries the full active
 * treatment (orange accent bar + tint); the parent then reads as the active
 * ANCESTOR (orange icon + ink label, no bar) so only one row owns the accent.
 * Children render indented + one size down. The whole sub-list hides when the
 * sidebar is collapsed to its 64px icon rail (no room) via the same
 * arbitrary-variant selector the labels use.
 */

import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { NavItem, NavBadgeTone } from './types';

type Props = {
  item: NavItem;
  pathname: string;
};

/**
 * True when `pathname` is within this item's route — exact href OR strict
 * prefix-match with a trailing slash (so /budgets doesn't light /budget).
 * Mirrors the established active-detection rule from bottom-nav.tsx +
 * admin-nav.tsx.
 */
function matchesPath(item: NavItem, pathname: string): boolean {
  const matchPrefix = item.matchPrefix ?? item.href;
  return pathname === item.href || pathname.startsWith(matchPrefix + '/');
}

/**
 * The most-specific matching child's key, or null. "Most specific" = longest
 * matchPrefix, so /guests/invite lights Invite (not Build, even though /guests
 * is a prefix of it) — the same longest-wins rule as lib/guest-journey.
 */
function activeChildKey(children: NavItem[], pathname: string): string | null {
  let bestKey: string | null = null;
  let bestLen = -1;
  for (const child of children) {
    const matchPrefix = child.matchPrefix ?? child.href;
    if (matchesPath(child, pathname) && matchPrefix.length > bestLen) {
      bestLen = matchPrefix.length;
      bestKey = child.key;
    }
  }
  return bestKey;
}

export function SidebarItem({ item, pathname }: Props) {
  const children = item.children ?? [];

  // Leaf (no children) — unchanged behavior. Vendor + admin sidebars and most
  // customer rows hit this path.
  if (children.length === 0) {
    return <SidebarRow item={item} active={matchesPath(item, pathname)} />;
  }

  // Parent with a sub-journey — the desktop expansion of the mobile <SubNav>.
  const activeKey = activeChildKey(children, pathname);
  const inSection = matchesPath(item, pathname) || activeKey !== null;

  return (
    <li>
      <ParentRow item={item} inSection={inSection} />
      {/* Sub-list: present only while in-section (auto-expand-on-active), and
          hidden entirely on the collapsed 64px rail (icons-only, no room). */}
      {inSection ? (
        <ul className="mt-0.5 flex flex-col gap-0.5 [[data-sidebar-collapsed='1']_&]:hidden">
          {children.map((child) => (
            <SidebarRow
              key={child.key}
              item={child}
              active={child.key === activeKey}
              nested
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * A single nav row — used for both leaves and nested children. `nested` shrinks
 * + indents the row so children read as subordinate to their parent. `active`
 * is computed by the caller (a leaf matches its own path; a nested child wins
 * the longest-match among siblings).
 */
function SidebarRow({
  item,
  active,
  nested = false,
}: {
  item: NavItem;
  active: boolean;
  nested?: boolean;
}) {
  const Icon = item.icon;
  // A muted ("not yet") row reads dimmed — but never while it's the active row.
  const dim = item.muted && !active;

  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        title={item.description ?? item.label}
        className={`relative flex items-center gap-3 rounded-md font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 hover:bg-[var(--m-paper)] ${
          nested
            ? 'min-h-[40px] py-2 pl-9 pr-3 text-[13px]'
            : 'min-h-[44px] px-3 py-2.5 text-sm'
        }${active ? ' sn-bounce' : ''}`}
        style={{
          color: active ? 'var(--m-ink)' : 'var(--m-slate)',
          background: active ? 'var(--m-orange-4)' : 'transparent',
          opacity: dim ? 0.5 : 1,
          outlineColor: 'var(--m-orange)',
        }}
      >
        {active ? (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-sm"
            style={{ background: 'var(--m-orange)' }}
          />
        ) : null}
        <Icon
          aria-hidden
          className={`${nested ? 'h-5 w-5' : 'h-6 w-6'} shrink-0`}
          strokeWidth={1.75}
          style={{ color: active ? 'var(--m-orange)' : 'var(--m-slate)' }}
        />
        {/* Label hides when sidebar collapsed via parent shell's data attr.
            Arbitrary-variant selector keeps this a server component. */}
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
 * The expandable PARENT row. A real link to its own href (e.g. tapping "Guests"
 * lands on the first stage), styled as the active ANCESTOR when in-section
 * (orange icon + ink label, no accent bar — the bar belongs to the active leaf
 * below). The chevron is an expand INDICATOR, not a toggle: expansion follows
 * the route (owner-picked auto-expand-on-active), so navigating into the
 * section is what reveals the children. Chevron + label hide on the collapsed
 * rail.
 */
function ParentRow({ item, inSection }: { item: NavItem; inSection: boolean }) {
  const Icon = item.icon;
  const Chevron = inSection ? ChevronDown : ChevronRight;

  return (
    <Link
      href={item.href}
      title={item.description ?? item.label}
      className="relative flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 hover:bg-[var(--m-paper)]"
      style={{
        color: inSection ? 'var(--m-ink)' : 'var(--m-slate)',
        background: 'transparent',
        outlineColor: 'var(--m-orange)',
      }}
    >
      <Icon
        aria-hidden
        className="h-6 w-6 shrink-0"
        strokeWidth={1.75}
        style={{ color: inSection ? 'var(--m-orange)' : 'var(--m-slate)' }}
      />
      <span className="truncate [[data-sidebar-collapsed='1']_&]:hidden">
        {item.label}
      </span>
      {item.badge && item.badge.count > 0 ? (
        <Badge tone={item.badge.tone} count={item.badge.count} label={item.badge.label} />
      ) : null}
      <Chevron
        aria-hidden
        className="ml-auto h-3.5 w-3.5 shrink-0 [[data-sidebar-collapsed='1']_&]:hidden"
        strokeWidth={2}
        style={{ color: 'var(--m-slate-2)' }}
      />
    </Link>
  );
}

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
    amber: { bg: 'bg-amber-100', fg: 'text-amber-900' },
    red: { bg: 'bg-red-100', fg: 'text-red-900' },
    // Brand-accent variant uses --m-orange tokens directly — not Tailwind
    // amber-orange — so the badge stays palette-consistent with the
    // active-state treatment.
    orange: { bg: '', fg: '' },
  };
  const { bg, fg } = tones[tone];

  // Hidden when collapsed — same arbitrary-variant pattern as the label.
  // Caller can override with `label` prop for sr-only accessible text.
  const display = count > 99 ? '99+' : String(count);

  if (tone === 'orange') {
    return (
      <span
        aria-label={label ?? `${count} new`}
        className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none [[data-sidebar-collapsed='1']_&]:hidden"
        style={{
          background: 'rgba(201, 107, 58, 0.15)',
          color: 'var(--m-orange-2)',
        }}
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
