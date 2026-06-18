/**
 * /vendor-dashboard/more — vendor mobile overflow landing.
 *
 * WHY: CLAUDE.md tenth 2026-05-28 row v2.1 brief canonical lock + 14th
 * 2026-05-28 row System Wiring Map audit + Nav Phase 2 brief. The vendor
 * doorway's 5-item mobile BottomNav (Home · Bookings · Messages ·
 * Earnings · More) lands here when the vendor taps More. We surface
 * every group + item from the canonical VENDOR_NAV_GROUPS so this is one
 * tap away from every surface that isn't a dedicated bottom tab.
 *
 * Desktop renders implicit via lg:hidden on VendorMobileLanding —
 * desktop vendors see the sidebar tree directly and never land here. A
 * direct-URL desktop hit would otherwise see a blank page, so we render
 * a small <DesktopRedirect /> that bounces lg viewports back to the
 * dashboard root (the sidebar already surfaces every group there).
 *
 * Per [[feedback_setnayan_orphan_prevention]] every card on this surface
 * maps 1:1 to a sidebar entry. The descriptions are brand-voice per
 * [[feedback_setnayan_no_dev_text_post_launch]] — no engineering jargon,
 * no schema names, no "Coming soon" placeholders.
 */

import { VENDOR_NAV_GROUPS } from '../_components/vendor-sidebar';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { isMusicVendor } from '@/lib/songs';
import { VendorMobileLanding } from '../_components/vendor-mobile-landing';
import { DesktopRedirect } from './_components/desktop-redirect';
import { createClient } from '@/lib/supabase/server';
import { resolveVendorRole, filterVendorNavGroups } from '@/lib/vendor-role';

export const metadata = { title: 'More · Vendor · Setnayan' };

/**
 * Brand-voice descriptions for the /more landing cards. Keyed by
 * NavItem.key from VENDOR_NAV_GROUPS so a future label rename
 * (e.g., "Tax docs" → "Tax & receipts") doesn't desync the description.
 *
 * Profile + Bookings + Messages appear in the BottomNav as
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
  proposals:
    'Auto-filled proposals for booked clients — saved templates merge the couple\u2019s live event details into a printable quote.',
  services:
    'The services + packages you offer. Pricing, inclusions, and what hosts see on your public profile.',
  repertoire:
    'Your performance repertoire — the songs you play. Couples browse the Song Bank and find you through every track you list.',
  attributes:
    'Per-category attributes that drive marketplace filters — silhouettes, milk options, edit aesthetics.',

  // Communicate group
  messages:
    'Host chat threads, file shares, and the per-thread inbox.',

  verify:
    'Verification status, document checklist, and the lifetime badge after admin review.',
  reviews:
    'Past-host reviews and ratings. The trust signal that surfaces on your public profile.',
  'moodboard-library':
    'Your private moodboard assets — portfolio shots and palette references hosts pin to their event.',

  // Money group
  earnings:
    "What you've earned across direct bookings. Setnayan never takes a cut — this is your ledger.",
  'payment-options':
    'The ways couples can pay you directly — bank, e-wallet, QR, or a payment link. Setnayan takes 0% and never touches this money.',
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
  branches:
    'Your additional branch locations. Each Enterprise sub-location runs its own calendar and team under your account.',

  // Team group
  team:
    'Team members + Setnayan support. Add staff to manage replies, view bookings, or coordinate the day.',
};

export default async function VendorMoreLanding() {
  // Role-aware overflow — owner/admin see every group; agent/viewer see only
  // the scoped subset (Phase 1: Home). Mirrors the sidebar + bottom-nav filter.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [role, vendorProfile] = user
    ? await Promise.all([
        resolveVendorRole(supabase, user.id),
        fetchOwnVendorProfile(supabase, user.id).catch(() => null),
      ])
    : [null, null];
  // Service-aware: Repertoire tile only for music acts (owner directive
  // 2026-06-13) — mirrors the sidebar filter.
  const showRepertoire = isMusicVendor(vendorProfile?.services);
  const groups = filterVendorNavGroups(VENDOR_NAV_GROUPS, role).map((g) =>
    showRepertoire ? g : { ...g, items: g.items.filter((it) => it.key !== 'repertoire') },
  );

  return (
    <>
      {/* Desktop hits /more by direct URL → bounce to the dashboard root
          (the landing below is lg:hidden, so desktop would see a blank page). */}
      <DesktopRedirect />
      <VendorMobileLanding
        title="More"
        subtitle="Every vendor surface, one tap away. Tabs at the bottom cover the daily driver — the rest live here."
        groups={groups}
        descriptions={DESCRIPTIONS}
      />
    </>
  );
}
