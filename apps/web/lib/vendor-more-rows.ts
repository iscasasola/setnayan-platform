/**
 * lib/vendor-more-rows.ts — what the supplier's "More" holds, ONCE.
 *
 * Owner-APPROVED 2026-10-01 (DECISION_LOG "THE SUPPLIER PHONE APP — APPROVED,
 * WITH THE THREE RECOMMENDED ANSWERS", answer 1): the bar is **Today · Customers
 * · Shop · More**, and Insights + Event Hub + Messages live in More. The
 * prototype (`supplier_app_simple_2026-10-01_fable.html`, frame 5) draws More as
 * a small sheet, one line each.
 *
 * Read by THREE surfaces, so they can never list different rows:
 *   · the phone bar's More sheet (`vendor-bottom-nav.tsx` → the host's shipped
 *     `more-services-sheet.tsx`, #6205 — reused, not copied);
 *   · the desktop rail's More row, which opens `/vendor-dashboard/more`;
 *   · that `/vendor-dashboard/more` page itself (a server component).
 *
 * 🔑 A PLAIN MODULE, ON PURPOSE. No `'use client'`: the /more page is a server
 * component and must read the VALUES (a client module's exports reach a server
 * component as references, not data). Lucide icons are plain components, safe
 * on both sides; nothing here calls `navIconComponent`, so
 * `vendor-nav-boundary.test.ts` has nothing to fear from it.
 *
 * ⚠ THE DOORS ARE THE SHIPPED ROUTES. `/vendor-dashboard/calendar`, `/messages`
 * and `/payday` are redirect stubs into the Customers hub with their section
 * named — linking the stub keeps one owner for where each section lives.
 *
 * ⚠ "SETTINGS" IS NOT A ROW. The prototype draws one "Settings · Notifications,
 * plan, team, sign out" row, but the supplier side has no settings page: those
 * are three pages (Notifications here, the Plan hub here, Team inside Shop) and
 * sign-out is the account menu. A "Settings" row would have to open one of them
 * and pretend it was all four, so the rows name the pages that exist.
 */
import {
  BarChart2,
  Bell,
  CalendarCheck,
  CalendarDays,
  Gem,
  MessageSquare,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export type VendorMoreRow = {
  key: string;
  label: string;
  /** One line under the label — what you find there, in plain words. */
  sub: string;
  href: string;
  Icon: LucideIcon;
  /**
   * The nav-registry slot whose admin rename follows this row. Only the two
   * rows that WERE bar tabs carry one (`vendor.bottom-nav.performance` ·
   * `vendor.bottom-nav.onday`), so an admin rename of those tabs still reaches
   * them now that they live in More.
   */
  slot?: string;
  /** The Plan hub is web-only in the App Store / Play Store shell. */
  webOnly?: boolean;
};

export const VENDOR_MORE_ROWS: readonly VendorMoreRow[] = [
  {
    key: 'calendar',
    label: 'Calendar',
    sub: 'Your dates, blocked days and who holds them.',
    href: '/vendor-dashboard/calendar',
    Icon: CalendarDays,
  },
  {
    key: 'payday',
    label: 'Earnings & payday',
    sub: 'What came in, what is due, when it lands.',
    href: '/vendor-dashboard/payday',
    Icon: Wallet,
  },
  {
    key: 'messages',
    label: 'Messages',
    sub: 'Every conversation in one inbox.',
    href: '/vendor-dashboard/messages',
    Icon: MessageSquare,
  },
  {
    key: 'performance',
    label: 'Insights',
    sub: 'How you are doing, and where the demand is.',
    href: '/vendor-dashboard/performance',
    Icon: BarChart2,
    slot: 'vendor.bottom-nav.performance',
  },
  {
    key: 'on-the-day',
    label: 'Event Hub',
    sub: 'Run the day: schedule, list and headcount.',
    href: '/vendor-dashboard/on-the-day',
    Icon: CalendarCheck,
    slot: 'vendor.bottom-nav.onday',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    sub: 'What we tell you, and how.',
    href: '/vendor-dashboard/notifications',
    Icon: Bell,
  },
  {
    key: 'plan',
    label: 'Plan',
    sub: 'Your plan, and what it unlocks.',
    href: '/vendor-dashboard/subscription',
    Icon: Gem,
    webOnly: true,
  },
];

/**
 * The routes that light "More" — the More page and every row's own room.
 *
 * ⚠ NOT the three redirect stubs (calendar · messages · payday): each forwards
 * into Customers, so Customers is the tab that is lit once you land. Listing
 * them here would light two tabs on one URL.
 *
 * ⚠ NOT the Plan hub either: on the phone it stays under Shop (as shipped), and
 * on the laptop the rail's own Plan row is lit there — two rows matching one
 * URL at the same specificity is how a rail lights the wrong one.
 */
export const VENDOR_MORE_MATCH: readonly string[] = [
  '/vendor-dashboard/more',
  '/vendor-dashboard/performance',
  '/vendor-dashboard/demand',
  '/vendor-dashboard/funnel',
  '/vendor-dashboard/on-the-day',
  '/vendor-dashboard/notifications',
];

/** The rows THIS person sees: the registry's words and hides, the store shell. */
export function vendorMoreRows(opts: {
  storeShell: boolean;
  navSlots?: Record<string, { label: string; isHidden: boolean }>;
}): VendorMoreRow[] {
  return VENDOR_MORE_ROWS.flatMap((row) => {
    if (row.webOnly && opts.storeShell) return [];
    const slot = row.slot ? opts.navSlots?.[row.slot] : undefined;
    if (!slot) return [row];
    if (slot.isHidden) return [];
    return [{ ...row, label: slot.label }];
  });
}
