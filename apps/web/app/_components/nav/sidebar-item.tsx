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
 */

import Link from 'next/link';
import type { NavItem, NavBadgeTone } from './types';

type Props = {
  item: NavItem;
  pathname: string;
};

export function SidebarItem({ item, pathname }: Props) {
  const matchPrefix = item.matchPrefix ?? item.href;
  // Exact equality OR strict prefix-match with trailing slash so /budgets
  // doesn't silently light up a /budget item. Mirrors the established
  // active-detection rule from existing bottom-nav.tsx + admin-nav.tsx.
  const isActive =
    pathname === item.href || pathname.startsWith(matchPrefix + '/');

  const Icon = item.icon;

  return (
    <li>
      <Link
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        title={item.description ?? item.label}
        className={`relative flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 hover:bg-[var(--m-paper)]${isActive ? ' sn-bounce' : ''}`}
        style={{
          color: isActive ? 'var(--m-ink)' : 'var(--m-slate)',
          background: isActive ? 'var(--m-orange-4)' : 'transparent',
          outlineColor: 'var(--m-orange)',
        }}
      >
        {isActive ? (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-sm"
            style={{ background: 'var(--m-orange)' }}
          />
        ) : null}
        <Icon
          aria-hidden
          className="h-6 w-6 shrink-0"
          strokeWidth={1.75}
          style={{ color: isActive ? 'var(--m-orange)' : 'var(--m-slate)' }}
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
