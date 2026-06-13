'use client';

/**
 * BottomNav — v2.1 Navigation Refactor Phase 0.
 *
 * WHY: CLAUDE.md 2026-05-28 11th row "v2.1 template package adoption" +
 * 14th 2026-05-28 row System Wiring Map audit. Mobile bottom-nav
 * primitive consumed by Phases 1-3 across the 3 doorways. Today each
 * doorway re-implements its own bottom nav (the customer side has the
 * 5-tab bar at apps/web/app/dashboard/[eventId]/_components/bottom-nav.tsx;
 * vendor + admin lean on the horizontal nav strip on desktop and have no
 * mobile bottom equivalent). This primitive lets Phases 1-3 ship a
 * coherent v2.1 mobile chrome across all 3 doorways.
 *
 * SCOPE: mobile-only (`lg:hidden`). Fixed bottom strip. Evenly
 * distributed grid, one column per item up to 6 (the customer doorway's
 * 6-tab row). Caller passes BottomNavItem[]. Renders nothing if empty;
 * warns to console if > 6 items.
 *
 * ACTIVE DETECTION: each item's `activeMatch` accepts a single prefix
 * string OR an array of prefixes (any-of). Match is exact-equal OR
 * `startsWith(prefix + '/')` — same trailing-slash rule as <SidebarItem>
 * to prevent `/budgets` mis-matching `/budget`.
 *
 * SAFE-AREA: pb-[env(safe-area-inset-bottom)] keeps the bar above the
 * iOS home indicator. Background uses var(--m-paper)/95 + backdrop-blur
 * so content scrolling beneath bleeds through the chrome.
 *
 * Z-INDEX: z-30 — same layer as <SidebarShell> sidebar so neither covers
 * the other when both render (they shouldn't, since sidebar is lg+ and
 * bottom-nav is lg-hidden, but explicit layering survives future css
 * refactors).
 *
 * GEOMETRY: 56px min height per tab + 44pt touch target. Icon 22px,
 * label 10px tracking-wide. Active: --m-orange icon + ink label
 * font-semibold. Inactive: --m-slate icon + --m-slate label.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import type { BottomNavItem, NavBadgeTone } from './types';

type Props = {
  items: BottomNavItem[];
};

export function BottomNav({ items }: Props) {
  const pathname = usePathname() ?? '';

  // Surface a console warning in dev when callers exceed the 6-tab budget.
  // The customer doorway uses 6 tabs (Home · Guests · Vendors · Website ·
  // Add-ons · More) and the owner wants them on ONE row, not wrapped to
  // two (CLAUDE.md 2026-05-31). Vendor + admin doorways have 5 items and
  // stay at 5 columns. Beyond 6, labels get cramped at common PH mobile
  // widths (360-414px) — flag so callers consolidate into a "More" tab.
  useEffect(() => {
    if (items.length > 6) {
      // eslint-disable-next-line no-console
      console.warn(
        `BottomNav: rendering ${items.length} items — > 6 will not fit gracefully on mobile.`,
      );
    }
  }, [items.length]);

  if (items.length < 1) return null;

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      style={{
        background: 'rgba(251, 248, 242, 0.95)', // --m-paper @ 95% alpha
        borderColor: 'var(--m-line)',
      }}
    >
      {/* Columns driven entirely by the inline gridTemplateColumns below —
          one column per item up to 6, so the customer's 6 tabs flow in a
          single row instead of wrapping the 6th onto a second row. */}
      <ul
        className="grid px-1 py-1"
        style={{
          gridTemplateColumns: `repeat(${Math.min(items.length, 6)}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item) => (
          <BottomNavTab key={item.key} item={item} pathname={pathname} />
        ))}
      </ul>
    </nav>
  );
}

function BottomNavTab({
  item,
  pathname,
}: {
  item: BottomNavItem;
  pathname: string;
}) {
  const matches = Array.isArray(item.activeMatch)
    ? item.activeMatch
    : [item.activeMatch];
  // Exact-match override for tabs whose route is a prefix of every other
  // tab's route (e.g., admin Home `/admin` shouldn't startsWith-match
  // `/admin/payments`). Mirrors the customer dashboard bottom-nav's
  // home-tab pattern at /apps/web/app/dashboard/[eventId]/_components/
  // bottom-nav.tsx:106.
  const isActive = item.activeMatchExact
    ? matches.some((prefix) => pathname === prefix)
    : matches.some(
        (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
      );

  const Icon = item.icon;

  return (
    <li>
      <Link
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        className={`flex min-h-[56px] min-h-[44pt] flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2${isActive ? ' sn-bounce' : ''}`}
        style={{
          color: isActive ? 'var(--m-ink)' : 'var(--m-slate)',
          outlineColor: 'var(--m-orange)',
        }}
      >
        <span className="relative inline-flex">
          <Icon
            aria-hidden
            className="h-[22px] w-[22px]"
            strokeWidth={1.75}
            style={{ color: isActive ? 'var(--m-orange)' : 'var(--m-slate)' }}
          />
          {item.badge && item.badge.count > 0 ? (
            <BadgeDot tone={item.badge.tone} count={item.badge.count} label={item.badge.label} />
          ) : null}
        </span>
        <span
          className="whitespace-nowrap text-[10px] tracking-wide"
          style={{ fontWeight: isActive ? 600 : 400 }}
        >
          {item.label}
        </span>
      </Link>
    </li>
  );
}

/**
 * Compact badge dot positioned over the top-right corner of the icon. Uses
 * the same tone palette as the sidebar badge but renders smaller — bottom-
 * nav real-estate is too tight for a full pill, so the dot + sr-only label
 * carries the count for assistive tech.
 */
function BadgeDot({
  tone,
  count,
  label,
}: {
  tone: NavBadgeTone;
  count: number;
  label?: string;
}) {
  const toneStyle: Record<NavBadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: '#E7E5E4', fg: '#44403C' },
    amber: { bg: '#FEF3C7', fg: '#78350F' },
    red: { bg: '#FEE2E2', fg: '#7F1D1D' },
    orange: { bg: 'var(--m-orange)', fg: '#FFFFFF' },
  };
  const { bg, fg } = toneStyle[tone];
  const display = count > 9 ? '9+' : String(count);

  return (
    <span
      aria-label={label ?? `${count} new`}
      className="absolute -right-1.5 -top-1 inline-flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-semibold leading-none"
      style={{ background: bg, color: fg }}
    >
      {display}
    </span>
  );
}
