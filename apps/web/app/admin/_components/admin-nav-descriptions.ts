/**
 * admin-nav-descriptions — brand-voice 1-line copy for the admin mobile
 * landing cards, keyed by NavItem.key from ADMIN_NAV_GROUPS.
 *
 * WHY: the desktop sidebar array (ADMIN_NAV_GROUPS in admin-sidebar.tsx) is the
 * SINGLE SOURCE OF TRUTH for admin nav structure — every group, item, href, and
 * icon. The mobile overflow landings (/admin/more · /admin/directory) render the
 * SAME groups + items in mobile orientation (owner directive 2026-07-04: "same
 * menu content on desktop and mobile, different orientation only"). But the nav
 * array stays lean — it carries no per-item descriptions. This module is that
 * separate descriptions lookup, mirroring the vendor doorway's DESCRIPTIONS map
 * (vendor-dashboard/more/page.tsx). Keyed by item.key so a label rename never
 * desyncs the copy; an item without an entry renders label-only (acceptable).
 *
 * Every description that existed on the pre-2026-07-04 hardcoded mobile lists
 * (the old /admin/more Content + System Settings sections and /admin/directory
 * Accounts list) is carried over verbatim here so nothing regresses. The rest
 * (the queue + Studio-marketing + App-Performance items that mobile never
 * surfaced before this parity pass) get brand-voice copy consistent with the
 * desktop sidebar comments + the /admin/work triage feed copy.
 */

import type { NavGroup, NavItem } from '@/app/_components/nav/types';
import type { LandingGroup, LandingItem } from './mobile-landing-grid';

export const ADMIN_NAV_DESCRIPTIONS: Record<string, string> = {
  // ── Overview group (key 'queues') ─────────────────────────────────────
  overview: 'The admin pulse — the at-a-glance snapshot of what needs you across every queue.',
  'work-home':
    'Every act-now queue in one ranked worklist, most-urgent first. Your daily command center.',
  verify: 'Vendors awaiting the verification badge.',
  'vendor-partnerships':
    'Vendor-to-vendor partnership claims awaiting two-admin verification.',
  payments: 'Order payments awaiting reconciliation.',
  payouts: 'Vendor payouts ready to release.',
  'token-purchases': 'Vendor token-pack purchases awaiting confirmation.',
  subscriptions: 'Vendor Pro / Enterprise upgrades awaiting confirmation.',
  'payment-options': 'Vendor payment destinations awaiting a fraud screen.',
  disputes: 'Open customer and vendor disputes.',
  'pax-changes': 'Guest-count change requests awaiting review.',
  'force-majeure': 'Event-impacting flags to triage.',
  completions: 'Booking completions awaiting the final handshake.',
  reviews: 'Review appeals awaiting a decision.',
  'concierge-abuse': 'Trial-cycling flags to review.',
  'account-deletions': 'Self-serve account-deletion requests to review.',
  'user-reports': 'Reported guest-gallery content awaiting moderation.',
  'repost-watch':
    'Cross-vendor image matches flagged for review — detect only, never auto-takedown.',
  corrections: 'Verified-shop correction requests to apply or decline.',
  'integrity-watch':
    'Review-fraud and ghost-listing screener — detect and review only.',
  fraud:
    'Scored vendors from the fake-results hunt — investigate, then dismiss, un-suspend, or confirm a wipe + ban.',
  approvals: 'A colleague is waiting on your second sign-off.',
  pakanta: "Each couple's custom-song brief for the music team to write.",
  'editorial-review': 'Wedding editorials awaiting an editorial pass before publish.',
  help: 'Open help-center tickets.',

  // ── Accounts group (key 'directory') ──────────────────────────────────
  users:
    'All accounts across customer, vendor, and admin roles. Issue comp grants, reset passwords, suspend.',
  'founder-seats':
    'Up to 10 owner-granted founder accounts — all features comped, token-free vendor inquiries, founder badge.',
  vendors:
    'Vendor profiles directory. Edit business details, override visibility, and review tier state.',
  'demo-vendors':
    'Demo / placeholder vendor records used for pilot showcase. Manage seeded entries here.',
  events:
    'All weddings on the platform with host roster, date, and venue. Drill into individual event state.',
  venues:
    'Venue directory. Add a new venue, edit existing, or open a venue page for review.',

  // ── Studio group (key 'media') — Content lane then Marketing lane ──────
  website:
    'Marketing site widget visibility and content toggles. Manage the public homepage and footer.',
  'background-videos':
    'Upload and manage the homepage hero + pillar loop videos — the live pipeline behind the public landing page.',
  'hero-video':
    'The /login left-panel hero still — upload a video; its first frame becomes the sign-in page image. (The public homepage hero runs on Background videos, not this.)',
  'reveal-studio': 'The Save-the-Date cinematic reveal openings — design and manage.',
  'real-stories':
    'Feature and order which consented wedding editorials surface on the public /realstories page, and pick the hero.',
  recaps:
    'Every couple-published living recap, with the RA 10173 takedown lever.',
  patiktok: 'The Patiktok template library and render-job monitor.',
  songs:
    'The owned music-track library that scores rendered videos. Manage tracks and categories.',
  'moodboard-library':
    'Curated location and figure imagery for the 3-pillar mood board. Manage palettes and tags.',
  'social-queue':
    'Ready-to-post couple creations and vendor features, plus take-downs.',
  'spotlight-awards': 'The vendor Spotlight Awards program — nominate and feature.',
  'journal-spotlights': 'Journal Spotlight features — curate and order.',
  'discount-codes': 'Promo and discount codes — create, cap, and expire.',
  referrals: 'The referral program — invites, rewards, and payouts.',

  // ── Ugat Console group (key 'ugat') ───────────────────────────────────
  menus:
    'The single source for the name and icon of every menu across all account types.',
  taxonomy:
    'Canonical vendor service categories and the sub-category card tree.',
  onboarding:
    'New-account onboarding settings grouped by type — background music and future per-flow knobs.',
  'wedding-traditions':
    'Per-religion wedding-traditions content shown on the couple paperwork guide. Edit items, or reset to the latest starter content.',
  brain:
    'Curated knowledge feeding the Setnayan AI chat. Browse chunks by topic.',
  ugat: 'The live entity map — every platform entity type, its live count, and the audited connections between them.',

  // ── App Performance group (key 'funnels') ─────────────────────────────
  'app-performance':
    'Your platform at a glance — growth, health, and where to focus next.',
  growth: 'The growth dashboard — sign-ups, activation, and retention.',
  intelligence: 'Market intelligence — demand signals and category trends.',
  demand:
    'Demand Radar — all-markets demand: month heat, top regions, hot looks, and event types. The admin view of the vendor Market Intel feature (Pro-and-up).',
  seo: 'SEO & GEO — nightly llms.txt-vs-catalog drift audit, route/token coverage, and Search Console trend.',
  funnels: 'Conversion funnels — where couples and vendors drop off.',
  'operations-hiring': 'Operations and hiring metrics — throughput and capacity.',
  'connection-logs': 'Integration and connection logs for debugging.',
  offline: 'The offline reconciliation daemon status and history.',

  // ── Money group (key 'settings-group') — money config then settings tail
  pricing:
    'The admin-managed retail catalog — every SKU price lives here, never in code.',
  'custom-plans':
    'Negotiated Custom vendor plans — dial a quote, apply a partner discount, send it for apply-then-pay approval.',
  addons: 'Attachable add-on SKUs and their availability.',
  'vendor-recommendations':
    'The vendor-leaf → recommendable-SKU map and its two-way curation review queue.',
  'token-bands':
    'Per-inquiry token burn — flat 1 everywhere since the 2026-07-11 lock. Edit only to change the platform-wide burn.',
  'price-bands': 'Price bands used across the catalog.',
  'budget-planner': 'The couple budget-planner reference table and defaults.',
  receipts: 'Issued receipts and BIR-facing records.',
  'payment-methods':
    'The BDO / GCash receiving accounts shown on payment instructions.',
  settings:
    'Platform identity, business details, and Sentry smoke-test. Edit gated to internal admins.',
  compliance:
    'The RA 10173 / NPC registration facts — PIC identity, DPO designation, breach plan, and sub-processors. Sensitive IDs stay in the database.',
  notifications:
    'Cross-actor signal reader — customer→vendor and admin signals in one inbox.',
  'demo-mode':
    'Pilot demo-mode toggle. Surfaces seeded showcase data and hides retired SKU surfaces.',
  'my-account':
    'Your personal account — display name, change password, and sign out other devices.',
};

/** Map a single NavItem → the LandingItem card shape (attach its description). */
function toLandingItem(item: NavItem): LandingItem {
  return {
    ...item,
    description: ADMIN_NAV_DESCRIPTIONS[item.key] ?? '',
  };
}

/**
 * Adapt the canonical ADMIN_NAV_GROUPS (NavGroup[]) into the labeled-section
 * LandingGroup[] the MobileLandingGrid renders — one section per desktop group,
 * items + descriptions attached, group labels preserved verbatim. This is the
 * ONE adapter that keeps the mobile More landing a mirror of the desktop
 * sidebar: pass ADMIN_NAV_GROUPS and every group + item flows through unchanged.
 */
export function adaptAdminGroupsToLanding(groups: NavGroup[]): LandingGroup[] {
  return groups.map((group) => ({
    label: group.label,
    items: group.items.map(toLandingItem),
  }));
}

/**
 * Flatten one desktop group's items → LandingItem[] for a flat (single-section)
 * mobile landing like /admin/directory. `groupKey` is the NavGroup.key on
 * ADMIN_NAV_GROUPS (e.g. 'directory' for Accounts). Returns [] if not found.
 */
export function adaptAdminGroupItems(
  groups: NavGroup[],
  groupKey: string,
): LandingItem[] {
  const group = groups.find((g) => g.key === groupKey);
  return group ? group.items.map(toLandingItem) : [];
}
