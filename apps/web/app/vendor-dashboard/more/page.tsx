/**
 * /vendor-dashboard/more — vendor mobile overflow landing.
 *
 * WHY: CLAUDE.md tenth 2026-05-28 row v2.1 brief canonical lock + 14th
 * 2026-05-28 row System Wiring Map audit + Nav Phase 2 brief. The vendor
 * doorway's 5-item mobile BottomNav (Profile · Bookings · Messages ·
 * Marketing · More) lands here when the vendor taps More. We surface
 * every group + item from the canonical VENDOR_NAV_GROUPS so this is one
 * tap away from every surface that isn't a dedicated bottom tab.
 *
 * Desktop renders implicit via lg:hidden on VendorMobileLanding —
 * desktop vendors see the sidebar tree directly and never land here.
 * We still ship a desktop-safe render (the landing surface is reachable
 * by direct URL on any viewport per orphan-prevention) but it stays
 * inside the lg:hidden block so it's purely a mobile affordance.
 *
 * Per [[feedback_setnayan_orphan_prevention]] every card on this surface
 * maps 1:1 to a sidebar entry. The descriptions are brand-voice per
 * [[feedback_setnayan_no_dev_text_post_launch]] — no engineering jargon,
 * no schema names, no "Coming soon" placeholders.
 */

import { VENDOR_NAV_GROUPS } from '../_components/vendor-sidebar';
import { VendorMobileLanding } from '../_components/vendor-mobile-landing';

export const metadata = { title: 'More · Vendor · Setnayan' };

/**
 * Brand-voice descriptions for the /more landing cards. Keyed by
 * NavItem.key from VENDOR_NAV_GROUPS so a future label rename
 * (e.g., "Tax docs" → "Tax & receipts") doesn't desync the description.
 *
 * Profile + Bookings + Messages + Marketing appear in the BottomNav as
 * dedicated tabs but the /more surface intentionally includes them too —
 * vendor who lands here from deep links or shared URLs gets a complete
 * view of every surface, not just the overflow. Mirrors the customer
 * /more pattern (PR #625) where each landing page includes ALL group
 * items even though BottomNav also surfaces some at the strip level.
 */
const DESCRIPTIONS: Record<string, string> = {
  // Home group
  profile:
    'Your vendor profile — business name, services, public bio, and the verification badge state.',

  // Pipeline group
  bookings:
    'Active and pending bookings. Soft-hold, downpaid, delivered, and cancelled — all in one stream.',
  contracts:
    'Contracts you upload for your booked hosts. Setnayan hosts the PDFs; signatures stay between you and the couple.',
  services:
    'The services + packages you offer. Pricing, inclusions, and what hosts see on your public profile.',
  attributes:
    'Per-category attributes that drive marketplace filters — silhouettes, milk options, edit aesthetics.',

  // Communicate group
  messages:
    'Host chat threads, file shares, and the per-thread inbox.',

  // Marketing group
  marketing:
    'Boosted Ads + Sponsored Boost surfaces. Visibility levers for paid tiers.',
  verify:
    'Verification status, document checklist, and the lifetime badge after admin review.',
  reviews:
    'Past-host reviews and ratings. The trust signal that surfaces on your public profile.',
  'moodboard-library':
    'Your private moodboard assets — portfolio shots and palette references hosts pin to their event.',

  // Money group
  earnings:
    "What you've earned across direct bookings. Setnayan never takes a cut — this is your ledger.",
  tokens:
    'Token wallet balance and history. Purchased plus earned vouchers, with expiry windows.',
  manpower:
    'Manpower gigs — host-paid crew assignments. ₱15k offline cash to crew, 2-token handshake to Setnayan.',
  // 'tax-documents' RETIRED 2026-05-29 — Setnayan no longer withholds
  // vendor income tax under V2 publisher posture, so the only document
  // it ever issued (Form 2307) no longer applies. Vendors handle their
  // own Form 2307 as income recipient per RR 16-2023.
  'redeem-code':
    'Redeem a token-pack voucher code. Codes top up your purchased token balance immediately.',

  // Team group
  team:
    'Team members + Setnayan support. Add staff to manage replies, view bookings, or coordinate the day.',
};

export default function VendorMoreLanding() {
  return (
    <VendorMobileLanding
      title="More"
      subtitle="Every vendor surface, one tap away. Tabs at the bottom cover the daily driver — the rest live here."
      groups={VENDOR_NAV_GROUPS}
      descriptions={DESCRIPTIONS}
    />
  );
}
