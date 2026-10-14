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
 * ⚠ THE DOORS NAME THEIR SECTION. Messages and Earnings & payday link the
 * Customers hub at their own fold through `customerLandingHref` (the anchors
 * module — ONE table, also read by Today's tiles, the Next card and the old
 * redirect stubs). They used to link the bare `/messages` and `/payday` stubs,
 * which dropped the supplier at the top of the roster. Calendar still links its
 * stub: `/vendor-dashboard/calendar` already lands on the month grid.
 *
 * ⚙ SETTINGS IS A ROW NOW (simpler supplier dashboard step 6, owner-APPROVED
 * 2026-10-14; prototype SCREENS.more = Event Hub · Settings · More tools). Until
 * then there was no settings page, so a Settings row would have pretended; now
 * `/vendor-dashboard/settings` exists and holds Notifications, Plan, Getting
 * paid, Helpers, More tools, Help and Sign out as rows. The rows that left:
 *   · Calendar · Money in · Messages — Customers › Dates / Money and the
 *     envelope in the top bar carry them (each was already one tap there);
 *   · Notifications · Plan — Settings rows (and the bell, and the avatar);
 * "How is my business doing" stays here until Shop › How it is going lands
 * (the prototype's shopSeg — another step owns Shop).
 */
import { BarChart2, CalendarCheck, Settings, Wrench, type LucideIcon } from 'lucide-react';

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
    key: 'on-the-day',
    label: 'Event Hub',
    sub: 'Run the day: schedule, list and headcount.',
    href: '/vendor-dashboard/on-the-day',
    Icon: CalendarCheck,
    slot: 'vendor.bottom-nav.onday',
  },
  {
    key: 'performance',
    label: 'How is my business doing',
    sub: 'Who looked at you, who asked, who booked.',
    href: '/vendor-dashboard/performance',
    Icon: BarChart2,
    slot: 'vendor.bottom-nav.performance',
  },
  {
    key: 'settings',
    label: 'Settings',
    sub: 'Account · notifications · plan · getting paid · helpers · help',
    href: '/vendor-dashboard/settings',
    Icon: Settings,
  },
  {
    key: 'more-tools',
    label: 'More tools',
    sub: 'What couples see · with others · protection',
    href: '/vendor-dashboard/settings#more-tools',
    Icon: Wrench,
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
  '/vendor-dashboard/on-the-day',
  '/vendor-dashboard/notifications',
  '/vendor-dashboard/settings',
  '/vendor-dashboard/help',
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
