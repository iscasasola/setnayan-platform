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
 * ⚙ SETTINGS IS A ROW (simpler supplier dashboard step 6, owner-APPROVED
 * 2026-10-14; prototype SCREENS.more = Event Hub · Settings · More tools).
 * `/vendor-dashboard/settings` holds Notifications, Plan, Getting paid, Helpers,
 * More tools, Help and Sign out as rows.
 *
 * ✂ RE-PLOT B FINISHED (owner "Yes to all", 2026-10-21 — items 1 and 3 of the
 * supplier-dashboard audit `shots-2026-10-21/supplier-dash-audit/AUDIT.md`;
 * DECISION_LOG 2026-10-08 answer 1 = B). More is **Event Hub · Settings**:
 *   · Messages LEFT — the envelope in the top bar lands on the IDENTICAL URL
 *     (`customerLandingHref('messages')`), so the row bought nothing. The old
 *     docblock's "until the envelope opens its own screen" was a wait for a
 *     screen the row never needed;
 *   · How is my business doing LEFT — it is Shop › How it is going now (the
 *     page draws the Shop switcher and lights Shop), and Today keeps its row;
 *   · More tools LEFT — ONE door, in Settings (the approved 2026-10-14
 *     prototype). The Shop fold that copied it went the same day;
 *   · Calendar · Money in left earlier — Customers › Dates / Money carry them;
 *   · Notifications · Plan — Settings rows (and the bell, and the avatar).
 */
import { CalendarCheck, Settings, type LucideIcon } from 'lucide-react';

export type VendorMoreRow = {
  key: string;
  label: string;
  /** One line under the label — what you find there, in plain words. */
  sub: string;
  href: string;
  Icon: LucideIcon;
  /**
   * The nav-registry slot whose admin rename follows this row. Only the Event
   * Hub row, which WAS a bar tab, carries one (`vendor.bottom-nav.onday`), so
   * an admin rename of that tab still reaches it now that it lives in More.
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
    key: 'settings',
    label: 'Settings',
    sub: 'Account · notifications · plan · getting paid · helpers · help',
    href: '/vendor-dashboard/settings',
    Icon: Settings,
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
  // ⚠ NOT /performance or /demand any more (2026-10-21, item 2): How it is going
  // is a Shop segment, so Shop is the tab lit there (`vendor-bottom-nav.tsx`,
  // `VENDOR_SHOP_EXTRA_MATCH` for the rail).
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
