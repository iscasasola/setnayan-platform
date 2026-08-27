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
  /*
    ⚠ NOT A LIVE QUEUE, and the old wording said it was. Owner, asked directly
    2026-08-19: *"we do not have a payout."* He is right, and the code agrees —
    `lib/admin/work-rows.ts` took payouts off the work list on 2026-08-04
    because it "can never accrue new work": the 2026-05-28 V2 cutover made
    Setnayan a software publisher rather than a marketplace intermediary, and
    couples pay vendors directly, off-platform. It fires only for pre-V2 orders
    still carrying a vendor id.

    🔑 A CARD THAT SAYS "READY TO RELEASE" DESCRIBES MONEY WAITING ON YOU. This
    one can never have any, so the sentence was work that does not exist —
    invented by the description, not by the product. Kept rather than deleted
    because the pre-V2 trail must stay readable during a dispute.
  */
  payouts: 'Closed trail from before Setnayan stopped handling vendor money — nothing new arrives here.',
  subscriptions: 'Vendor Pro / Enterprise upgrades awaiting confirmation.',
  'payment-options': 'Vendor payment destinations awaiting a fraud screen.',
  disputes: 'Open customer and vendor disputes.',
  /*
    ⚠ NOTHING IS AWAITING REVIEW HERE. The page's own docblock: *"Read-only by
    design — the parties act on their own surfaces; HQ only observes."* A guest
    count moves, the cost recalculates, the vendor accepts or declines the
    surcharge on their own screen, and a row lands here as a trail so a mediator
    can answer "why did this vendor's cost jump?" during a dispute.

    Owner 2026-08-19, asked whether pax changes should be automatic:
    *"automatic."* They already are. The vendor's `min_pax` is a BILLING FLOOR,
    not a refusal — the count may drop freely and the service still bills at the
    minimum — which is what makes fully-automatic safe.

    🔑 "AWAITING REVIEW" PUT WORK ON A SCREEN THAT HAS NONE. It is how a
    read-only trail came to look like ten uncounted queues in a review of the
    admin console.
  */
  'pax-changes': 'Trail of guest-count cost changes — applied automatically; HQ only observes.',
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
  'live-studio-channels':
    'The Setnayan-owned YouTube channels every Live Studio event streams on. Connect, verify, and release pool channels — couples never connect a Google account.',
  'background-videos':
    'Upload and manage the homepage hero + pillar loop videos — the live pipeline behind the public landing page.',
  'website-media':
    'Everything stored for the site’s own pictures and videos, and which files nothing points at any more. Download a copy, then free the space. Guest photos and documents are not shown here.',
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
  'search-memory':
    'Every phrasing the search box has answered with the assistant. Correct one that points somewhere wrong, or delete it.',

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
  'vendor-recommendations':
    'The vendor-leaf → recommendable-SKU map and its two-way curation review queue.',
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
  integrations:
    'Turn external services on — email, AI, social publishing, payments — without a redeploy.',
  secrets:
    'Every API key and password: how old it is, when to replace it, and a paste box to do it here.',
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


/**
 * Words a person would TYPE that are not in a page's name.
 *
 * 🔑 SEARCHING BY WHAT YOU ARE TRYING TO DO, NOT BY WHAT THE PAGE IS CALLED.
 * The owner typed "pending" and got *"Nothing called pending."* — correct, and
 * useless: three different pages hold pending work and none has that word in
 * its title. These are the words that bridge the two.
 *
 * ⚠ IT LIVES HERE, BESIDE THE DESCRIPTIONS, BECAUSE TWO SURFACES SEARCH: the
 * desktop palette and the phone's "All surfaces" map. It began inside the
 * palette, which is why the phone kept matching titles only — the owner's own
 * complaint was fixed on one device and left live on the other. One list, both
 * readers; never copy it.
 *
 * Hand-picked on purpose. A generated synonym list would match everything and
 * rank nothing.
 */
export const ADMIN_NAV_ALIASES: Record<string, string> = {
  payments: 'pending unpaid reconcile proof screenshot gcash bdo receipt money',
  payouts: 'release transfer send money vendor owed',
  verify: 'pending id identity dti sec documents badge legit',
  disputes: 'complaint refund argument conflict problem',
  fraud: 'scam suspicious fake abuse',
  'user-reports': 'report flag complaint abuse takedown',
  'account-deletions': 'erasure delete privacy gdpr ra10173 right to be forgotten',
  'data-privacy': 'npc privacy dpo consent ra10173 filing',
  approvals: 'pending sign off second admin two admin',
  subscriptions: 'pro plan upgrade billing recurring',
  // 'prices' and 'papic' added 2026-08-26 under this list's own rule — the owner
  // typed "show me the prices of papic" and "take me to the pricing for papic
  // services" and got nothing. Measured why: the plural 'prices' appeared in ZERO
  // admin haystacks (there is no stemmer anywhere in this repo), and 'papic'
  // appeared in exactly one — Papic storage, which is not the money. Both words
  // are true of this page: every Papic SKU is a row in this catalogue.
  pricing: 'price prices papic cost sku catalog catalogue amount',
  'price-bands': 'market range benchmark',
  secrets: 'keys api credentials rotate env',
  integrations: 'connect services resend openai gcash maya switches',
  compliance: 'npc bir legal privacy dpo',
  taxonomy: 'categories services vocabulary tags event types',
  menus: 'labels icons rename nav navigation',
  // The four phrasings that already reached this page while it was map-only,
  // kept working by hand: a menu item's searchable words are label + group
  // label + description + alias, and THE ROUTE IS NOT AMONG THEM — so the
  // '/admin/search-memory' string it used to match on disappears the moment it
  // becomes a menu row. Its two job phrases ("teach search phrase", "delete
  // search phrase") still attach by href and are not repeated here.
  'search-memory': 'learned taught teach correct phrases what has the search box learned ai memory',
  users: 'accounts people customers couples',
  vendors: 'suppliers shops businesses',
  venues: 'places locations',
  events: 'weddings bookings',
  help: 'support tickets questions',
  seo: 'search google ranking llms',
  receipts: 'invoice or bir official receipt',
  // ── RETIRED NAMES, KEPT FINDABLE (2026-08-26) ────────────────────────────
  // A menu item's searchable words are its label + its group's label + its
  // description + this alias line. THE ROUTE IS NOT AMONG THEM — only redirect
  // stubs contribute their address. So renaming a menu item silently deletes
  // its old name from the search box, and somebody who has typed "app
  // performance" for months gets nothing back with no clue why. These two
  // items were renamed to match the menus they open; their old names live on
  // here, and `the-menu-name-has-one-source.test.ts` fails if one goes missing.
  overview: 'overview hq pulse dashboard front page what needs me',
  'app-performance': 'app performance stats metrics speed health uptime',
};
