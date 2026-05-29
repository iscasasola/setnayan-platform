/**
 * /dashboard/[eventId]/more — customer mobile overflow landing.
 *
 * WHY: CLAUDE.md tenth 2026-05-28 row v2.1 brief canonical lock + 14th
 * 2026-05-28 row System Wiring Map audit + this PR's Nav Phase 1 brief.
 * The customer doorway's 5-item mobile BottomNav (Today · Home · Guests ·
 * Website · More) lands here when the host taps More. We surface every
 * group + item from the canonical buildCustomerNavGroups so this is one
 * tap away from every surface that isn't a dedicated bottom tab.
 *
 * Desktop redirects implicit via lg:hidden on CustomerMobileLanding —
 * desktop users see the sidebar tree directly and never land here. We
 * still ship a desktop-safe render (the landing surface is reachable
 * by direct URL on any viewport per orphan-prevention) but it stays
 * inside the lg:hidden block so it's purely a mobile affordance.
 *
 * Per [[feedback_setnayan_orphan_prevention]] every card on this surface
 * maps 1:1 to a sidebar entry. The descriptions are brand-voice per
 * [[feedback_setnayan_no_dev_text_post_launch]] — no engineering jargon,
 * no schema names, no "Coming soon" placeholders.
 */

import { buildCustomerNavGroups } from '../_components/customer-sidebar';
import { CustomerMobileLanding } from '../_components/customer-mobile-landing';

export const metadata = { title: 'More · Setnayan' };

/**
 * Brand-voice descriptions for the /more landing cards. Keyed by
 * NavItem.key from buildCustomerNavGroups so a future label rename
 * (orange-line tone preserved) doesn't desync the description.
 *
 * Today + Home appear in the BottomNav as dedicated tabs but the /more
 * surface intentionally includes them too — host who lands here from
 * deep links or shared URLs gets a complete view of every surface,
 * not just the overflow. Mirrors the admin pattern where each landing
 * page (queues/directory/money) includes ALL group items even though
 * BottomNav also surfaces some at the strip level.
 */
const DESCRIPTIONS: Record<string, string> = {
  // Today group
  'todays-focus':
    "The 65-card wizard. Today's pick plus a few coming up — the daily working surface.",
  home:
    'Event home — plan grid, activity feed, next 15 steps, and the upcoming-week tray.',

  // Plan group
  guests:
    'Guest list, RSVPs, dietary needs, +1s, and per-guest workspace with chat + history.',
  seating:
    "Tables, place cards, and the seating chart editor. Drag to swap, long-press for guest details.",
  schedule:
    'Day-of timeline. Blocks for ceremony, reception, vendor windows, and crew set-up.',
  vendors:
    'Your booked vendors and the per-vendor workspaces — chat, payment plan, files, and the day-of brief.',

  // Spend group
  budget:
    'Per-vendor budget plus Setnayan add-ons. Track what is paid, due, and still on the table.',
  orders:
    'Your Setnayan add-on orders. Status, reference codes, and reconciliation timelines.',
  receipts:
    'BIR-compliant receipts for every Setnayan purchase across all your events.',

  // Communicate group
  messages:
    'Vendor chat threads, file shares, and the per-vendor message inbox.',
  contracts:
    'Vendor contracts uploaded for your reference. Setnayan hosts the PDFs — signatures stay with you.',

  // Share group
  website:
    'Your public event website — URL, QR, RSVP form, and day-of guest landing preview.',
  'add-ons':
    'Setnayan apparatus you can add to your event — software services we publish.',
  'mood-board':
    'Palette, location feel, and dress codes. The styling brain for the whole day.',

  // After group
  activity:
    'A full event log — every action across hosts, vendors, and Setnayan, in order.',
  disputes:
    'Open a refund, request a dispute, or flag a force-majeure. Setnayan mediates.',
  'event-qr':
    'The master QR code. Crew scans this on arrival to register their device for capture.',

  // Settings group
  hosts:
    'Invite parents, planner, or maid-of-honor as moderators. Set per-host permissions.',
  profile:
    'Your account, password, OAuth providers, privacy controls, and Today’s Focus settings.',
};

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function CustomerMoreLanding({ params }: Props) {
  const { eventId } = await params;
  const groups = buildCustomerNavGroups(eventId);

  return (
    <CustomerMobileLanding
      title="More"
      subtitle="Every event surface, one tap away. Tabs at the bottom cover the daily driver — the rest live here."
      groups={groups}
      descriptions={DESCRIPTIONS}
    />
  );
}
