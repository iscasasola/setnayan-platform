/**
 * /dashboard/[eventId]/more — customer mobile overflow landing.
 *
 * WHY: the customer doorway's 5-item mobile BottomNav (Home · Guests ·
 * Services · Website · More) lands here when the host taps More. This grid
 * surfaces every event surface that ISN'T already one of those four
 * always-visible tabs — true overflow only.
 *
 * DE-DUPE (owner directive 2026-06-03 · "less stressful" pass): the four
 * bottom-nav destinations (Home · Guests · Services · Website) used to
 * render as cards here too, which contradicted this page's own "the rest
 * live here" promise and doubled the visual load on a host who's already
 * stretched. They're filtered out via BOTTOM_NAV_KEYS below.
 *
 * Today's Focus was RETIRED 2026-06-03 — the 9/65-card planning wizard is
 * superseded by onboarding (upfront scoping) + the per-service deadline
 * timeline (lib/upcoming-items.ts → Home). Its entry is gone from
 * buildCustomerNavGroups, so it no longer appears on this grid (or the
 * desktop sidebar); /today now redirects to event-home.
 *
 * Desktop never lands here — CustomerMobileLanding is lg:hidden and desktop
 * users get the full sidebar tree (customer-sidebar.tsx), which still shows
 * EVERY surface including the four tabs. The de-dupe is mobile-only.
 *
 * Server-Component note: import buildCustomerNavGroups from the NEUTRAL
 * customer-nav-config module, not the 'use client' sidebar file — a Server
 * Component importing from a 'use client' module turns the import into a
 * CLIENT REFERENCE that crashes at server-render (Sentry ref 19475950). For
 * the same reason BOTTOM_NAV_KEYS is mirrored here as plain strings rather
 * than imported from customer-bottom-nav.tsx (also a 'use client' module) —
 * keep it in sync with buildCustomerBottomNav there.
 *
 * Brand-voice descriptions per [[feedback_setnayan_no_dev_text_post_launch]]
 * — no engineering jargon, no schema names, no "Coming soon" placeholders.
 */

import type { NavGroup } from '@/app/_components/nav/types';
import { buildCustomerNavGroups } from '../_components/customer-nav-config';
import { CustomerMobileLanding } from '../_components/customer-mobile-landing';

export const metadata = { title: 'More · Setnayan' };

/**
 * NavItem keys already surfaced as always-visible bottom-nav tabs
 * (customer-bottom-nav.tsx · buildCustomerBottomNav). Filtered out of the
 * /more grid so it shows ONLY true overflow. Mirror of the bottom-nav key
 * set — keep in sync with buildCustomerBottomNav there.
 */
const BOTTOM_NAV_KEYS = new Set(['home', 'guests', 'vendors', 'website']);

/**
 * Brand-voice descriptions for the /more landing cards, keyed by
 * NavItem.key from buildCustomerNavGroups so a label rename doesn't desync
 * the description. Covers exactly the items that render after the
 * BOTTOM_NAV_KEYS filter — the four bottom-tab keys carry no entry here.
 */
const DESCRIPTIONS: Record<string, string> = {
  // Plan group
  seating:
    'Tables, place cards, and the seating chart editor. Drag to swap, long-press for guest details.',
  schedule:
    'Day-of timeline. Blocks for ceremony, reception, vendor windows, and crew set-up.',
  'find-date':
    'Weigh auspicious dates, long weekends, and guest availability to settle on the day.',

  // Spend group
  budget:
    'Per-vendor budget plus Setnayan add-ons. Track what is paid, due, and still on the table.',

  // Communicate group
  messages:
    'Vendor chat threads, file shares, and the per-vendor message inbox.',
  contracts:
    'Vendor contracts kept for your reference. Setnayan stores the PDFs — signatures stay with you.',

  // Share group
  'add-ons':
    'Extra Setnayan services for your day — Papic, Panood, Save-the-Date, and more.',
  'mood-board':
    'Palette, location feel, and dress codes. The styling brain for the whole day.',

  // After group
  activity:
    'A running history — every action across hosts, vendors, and Setnayan, in order.',
  disputes:
    'Open a refund or raise an issue with a vendor — Setnayan steps in to help.',
  'event-qr':
    'The master QR code. Crew scans this on arrival to register their device for capture.',

  // Settings group
  personalization:
    'Everything from your onboarding — names, region, style, budget, date, and more. Refine what we match on.',
  hosts:
    'Invite parents, planner, or maid-of-honor as moderators. Set per-host permissions.',
  profile:
    'Your account, password, sign-in methods, and privacy controls.',
};

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function CustomerMoreLanding({ params }: Props) {
  const { eventId } = await params;

  // De-dupe: drop the four always-visible bottom-nav tabs from the grid,
  // then drop any group the filter leaves empty. The shared builder stays
  // intact for the desktop sidebar, which still surfaces every entry.
  const groups: NavGroup[] = buildCustomerNavGroups(eventId)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !BOTTOM_NAV_KEYS.has(item.key)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <CustomerMobileLanding
      title="More"
      subtitle="Everything that isn't a bottom tab — one tap away."
      groups={groups}
      descriptions={DESCRIPTIONS}
    />
  );
}
