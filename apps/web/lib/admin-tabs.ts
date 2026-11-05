/**
 * admin-tabs.ts — every admin route, and the ONE tab it belongs to.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Owner, 2026-10-28 (DECISION_LOG "ADMIN DESIGN APPROVED — FIVE TABS, EACH ONE
 * PAGE"): the admin becomes five tabs — Work · Money · People · Catalogue ·
 * Insights — plus the avatar menu for running admin itself (Team & permissions ·
 * Admin log · Secrets & integrations · Email delivery). The decision names its
 * own first build step: "a reviewed map of all admin routes → tab (redirect
 * stubs marked) + a CI guard failing any new admin page without a tab." This is
 * that map. It changes NO navigation and NO screen — the five-tab shell reads it
 * in the next step.
 *
 * ── WHAT IS AND IS NOT HAND-WRITTEN ─────────────────────────────────────────
 * The INVENTORY of admin pages is a fact of the filesystem and is never typed
 * here as a source of truth: `every-admin-page-has-a-tab.test.ts` walks
 * `app/admin/**\/page.tsx` and refuses any page this list does not name, any
 * entry naming a page that does not exist, and any stub whose recorded target
 * disagrees with the file or lands somewhere that is not a live page. Only the
 * TAB is hand-written, because which tab a page lives under is a product
 * decision, not a fact. (The same split `lib/admin-map/scan-admin-routes.ts`
 * makes for the ⌘K palette: the existence of a page is scanned; the words for it
 * are curated.)
 *
 * ── HOW TO READ AN ENTRY ────────────────────────────────────────────────────
 *   route   the folder's URL, dynamic segments kept as written on disk
 *           (`/admin/users/[userId]`) — a detail page has a home tab too.
 *   tab     where it lives in the five-tab admin.
 *   stubTo  set ONLY for a redirect stub (a page that renders nothing and just
 *           forwards). The value is exactly what the file forwards to. A stub's
 *           tab is the tab of the CONTENT it names, which can differ from the tab
 *           of the page it forwards to: `/admin/referrals` forwards into Studio
 *           (Catalogue) but referrals are Money.
 *   note    why, where the placement is not obvious or moved from the planning
 *           chat's first guess.
 *
 * `retire` is a holding tab, not a destination: the route keeps working today
 * (`/admin/more` IS the live More tab) and is removed only after the five tabs
 * have replaced what it does. Nothing here deletes anything.
 */

export const ADMIN_TABS = [
  'work',
  'money',
  'people',
  'catalogue',
  'insights',
  'avatar',
  'retire',
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number];

export type AdminTabEntry = {
  route: string;
  tab: AdminTab;
  /** Redirect stubs only: the exact address the file forwards to. */
  stubTo?: string;
  /** `retire` entries only: when it goes. Today: after the five-tab shell ships. */
  retire?: 'later';
  note?: string;
};

export const ADMIN_TAB_MAP: readonly AdminTabEntry[] = [
  // ── WORK — things waiting on an admin: confirm, review, reply, decide ──────
  { route: '/admin', tab: 'work', note: 'Today — the admin home; becomes the Work tab.' },
  { route: '/admin/work', tab: 'work' },
  { route: '/admin/queues', tab: 'work', stubTo: '/admin/work' },
  { route: '/admin/approvals', tab: 'work' },
  { route: '/admin/disputes', tab: 'work' },
  { route: '/admin/completions', tab: 'work' },
  { route: '/admin/pax-changes', tab: 'work' },
  { route: '/admin/force-majeure', tab: 'work' },
  { route: '/admin/force-majeure/[flagId]', tab: 'work' },
  { route: '/admin/reviews', tab: 'work' },
  { route: '/admin/concierge-abuse', tab: 'work' },
  { route: '/admin/fraud', tab: 'work' },
  { route: '/admin/integrity-watch', tab: 'work' },
  { route: '/admin/user-reports', tab: 'work', note: 'Reports.' },
  { route: '/admin/chat-flags', tab: 'work', note: 'Flagged chats.' },
  { route: '/admin/repost-watch', tab: 'work' },
  { route: '/admin/account-deletions', tab: 'work', note: 'A queue of deletion requests.' },
  { route: '/admin/event-deletions', tab: 'work', note: 'A queue of event removals.' },
  { route: '/admin/help', tab: 'work', note: 'Help inbox.' },
  { route: '/admin/editorial-review', tab: 'work' },
  { route: '/admin/editorial-review/[editorialId]', tab: 'work' },
  { route: '/admin/verify', tab: 'work', note: 'From suppliers: documents to check.' },
  { route: '/admin/verification-docs', tab: 'work', note: 'From suppliers: documents to check.' },
  { route: '/admin/vendor-partnerships', tab: 'work', note: 'From suppliers: partnership checks.' },
  { route: '/admin/corrections', tab: 'work', note: 'From suppliers: profile change requests.' },
  {
    route: '/admin/demo-vendors/inquiries',
    tab: 'work',
    note: 'Messages: couples wrote to a demo supplier and the team replies as it.',
  },
  { route: '/admin/demo-vendors/inquiries/[threadId]', tab: 'work' },
  {
    route: '/admin/pakanta',
    tab: 'work',
    note: 'MOVED from Catalogue: it is the songwriting + delivery queue for paid orders, not catalogue set-up.',
  },

  // ── MONEY — what came in, what is owed, what goes out ──────────────────────
  { route: '/admin/money', tab: 'money', note: 'Today the Money landing.' },
  {
    route: '/admin/payments',
    tab: 'money',
    note: 'To confirm + received. Work surfaces its to-confirm rows; the ledger itself is Money.',
  },
  { route: '/admin/receipts', tab: 'money' },
  { route: '/admin/subscriptions', tab: 'money' },
  { route: '/admin/booking-fees', tab: 'money' },
  { route: '/admin/payouts', tab: 'money' },
  { route: '/admin/payment-options', tab: 'money', note: 'Money ⚙ — our receiving accounts.' },
  { route: '/admin/settings/payment-methods', tab: 'money' },
  { route: '/admin/launch-offer', tab: 'money', note: 'Money ⚙.' },
  {
    route: '/admin/discount-codes',
    tab: 'money',
    stubTo: '/admin/studio?tab=discount-codes',
    note: 'Money ⚙. Forwards into Studio today.',
  },
  { route: '/admin/discount-codes/new', tab: 'money' },
  { route: '/admin/discount-codes/[id]/edit', tab: 'money' },
  {
    route: '/admin/custom-plans',
    tab: 'money',
    stubTo: '/admin/pricing?tab=custom-plans',
    note: 'Custom plans suppliers request and pay for.',
  },
  {
    route: '/admin/referrals',
    tab: 'money',
    stubTo: '/admin/studio?tab=referrals',
    note: 'Forwards into Studio today.',
  },

  // ── PEOPLE — one search of people, shops and events ───────────────────────
  { route: '/admin/accounts', tab: 'people', note: 'People & shops — users · suppliers · events · venues · demo suppliers.' },
  { route: '/admin/users', tab: 'people', stubTo: '/admin/accounts?tab=users' },
  { route: '/admin/users/[userId]', tab: 'people' },
  { route: '/admin/vendors', tab: 'people', stubTo: '/admin/accounts?tab=vendors' },
  { route: '/admin/vendors/[vendorProfileId]', tab: 'people', note: 'A shop — opens over the page.' },
  { route: '/admin/vendors/[vendorProfileId]/edit', tab: 'people' },
  { route: '/admin/vendors/[vendorProfileId]/plan', tab: 'people' },
  { route: '/admin/vendors/[vendorProfileId]/team', tab: 'people' },
  { route: '/admin/events', tab: 'people', stubTo: '/admin/accounts?tab=events' },
  { route: '/admin/events/[eventId]', tab: 'people' },
  { route: '/admin/venues', tab: 'people', stubTo: '/admin/accounts?tab=venues', note: 'A tab of People & shops today.' },
  { route: '/admin/venues/new', tab: 'people' },
  { route: '/admin/venues/[id]', tab: 'people' },
  { route: '/admin/demo-vendors', tab: 'people', stubTo: '/admin/accounts?tab=demo-vendors', note: 'People ⚙ — demo suppliers.' },
  { route: '/admin/founder-seats', tab: 'people', note: 'People ⚙.' },
  { route: '/admin/gifts', tab: 'people', note: 'Gifts & comps to people and shops.' },

  // ── CATALOGUE — what the app offers, and how it looks ─────────────────────
  {
    route: '/admin/categories',
    tab: 'catalogue',
    note: 'The four-level taxonomy, event types and Hub tools all live on this one page.',
  },
  { route: '/admin/pricing', tab: 'catalogue', note: 'The price list.' },
  { route: '/admin/addons', tab: 'catalogue', stubTo: '/admin/pricing' },
  { route: '/admin/price-bands', tab: 'catalogue', stubTo: '/admin/pricing?tab=price-bands' },
  { route: '/admin/budget-planner', tab: 'catalogue' },
  {
    route: '/admin/vendor-recommendations',
    tab: 'catalogue',
    note: 'What each kind of supplier is offered to recommend — a catalogue map, not money.',
  },
  { route: '/admin/studio', tab: 'catalogue', note: 'Templates & media; several of its tabs are mapped elsewhere by content.' },
  { route: '/admin/website', tab: 'catalogue', stubTo: '/admin/studio?tab=website' },
  { route: '/admin/recaps', tab: 'catalogue', stubTo: '/admin/studio?tab=recaps' },
  { route: '/admin/real-stories', tab: 'catalogue', stubTo: '/admin/studio?tab=real-stories' },
  { route: '/admin/reveal-studio', tab: 'catalogue', stubTo: '/admin/studio?tab=reveal-studio' },
  { route: '/admin/patiktok', tab: 'catalogue', stubTo: '/admin/studio?tab=patiktok' },
  { route: '/admin/songs', tab: 'catalogue', stubTo: '/admin/studio?tab=songs' },
  { route: '/admin/moodboard-library', tab: 'catalogue', stubTo: '/admin/studio?tab=moodboard-library' },
  { route: '/admin/journal-spotlights', tab: 'catalogue', stubTo: '/admin/studio?tab=journal-spotlights' },
  { route: '/admin/social-queue', tab: 'catalogue', stubTo: '/admin/studio?tab=social-queue' },
  { route: '/admin/spotlight-awards', tab: 'catalogue', stubTo: '/admin/studio?tab=spotlight-awards', note: 'A Studio redirect stub.' },
  { route: '/admin/hub-music', tab: 'catalogue' },
  { route: '/admin/background-videos', tab: 'catalogue', note: 'Design kit › Backgrounds extends this.' },
  { route: '/admin/website-media', tab: 'catalogue' },
  { route: '/admin/brain', tab: 'catalogue', stubTo: '/admin/ugat?tab=brain' },
  { route: '/admin/onboarding', tab: 'catalogue', stubTo: '/admin/ugat?tab=onboarding', note: 'Catalogue ⚙ — onboarding questions.' },
  { route: '/admin/menus', tab: 'catalogue', stubTo: '/admin/ugat?tab=menus', note: 'Menus & icons.' },

  // ── INSIGHTS — numbers, read-only ─────────────────────────────────────────
  { route: '/admin/app-performance', tab: 'insights' },
  { route: '/admin/growth', tab: 'insights', stubTo: '/admin/app-performance?tab=growth', note: 'Sign-ups.' },
  { route: '/admin/funnels', tab: 'insights', stubTo: '/admin/app-performance?tab=funnels' },
  { route: '/admin/intelligence', tab: 'insights', stubTo: '/admin/app-performance?tab=intelligence' },
  { route: '/admin/insights', tab: 'insights', stubTo: '/admin/app-performance?tab=intelligence' },
  { route: '/admin/seo', tab: 'insights', stubTo: '/admin/app-performance?tab=seo' },
  { route: '/admin/offline', tab: 'insights', stubTo: '/admin/app-performance?tab=offline' },
  { route: '/admin/operations-hiring', tab: 'insights', stubTo: '/admin/app-performance?tab=operations' },
  {
    route: '/admin/connection-logs',
    tab: 'insights',
    stubTo: '/admin/app-performance?tab=connection-logs',
    note: 'MOVED from People: it is the "Problems" tab of App performance — app errors, not people.',
  },
  { route: '/admin/demand', tab: 'insights' },
  { route: '/admin/papic-storage', tab: 'insights', note: 'Costs — a read-only storage readout.' },
  { route: '/admin/ugat', tab: 'insights' },
  { route: '/admin/ugat/map', tab: 'insights' },

  // ── AVATAR — running admin itself ─────────────────────────────────────────
  { route: '/admin/secrets', tab: 'avatar', note: 'Secrets & integrations.' },
  { route: '/admin/integrations', tab: 'avatar', note: 'Secrets & integrations.' },
  {
    route: '/admin/live-studio-channels',
    tab: 'avatar',
    note: 'Secrets & integrations — the Setnayan-owned YouTube channel pool and its Google grants.',
  },
  { route: '/admin/notifications', tab: 'avatar', stubTo: '/admin/settings?tab=notifications', note: 'Email delivery.' },
  {
    route: '/admin/settings',
    tab: 'avatar',
    note: 'Platform settings (business details, VAT) with compliance, demo mode and notifications as tabs.',
  },
  { route: '/admin/settings/demo-mode', tab: 'avatar', stubTo: '/admin/settings?tab=demo-mode', note: 'Per-admin session switch.' },
  {
    route: '/admin/npc-readiness',
    tab: 'avatar',
    stubTo: '/admin/data-privacy?tab=checklist',
  },
  { route: '/admin/data-privacy', tab: 'avatar', note: 'Follows npc-readiness, which forwards here.' },
  { route: '/admin/compliance', tab: 'avatar', stubTo: '/admin/settings?tab=compliance' },
  { route: '/admin/compliance/data-sheet', tab: 'avatar' },
  {
    route: '/admin/search-memory',
    tab: 'avatar',
    note: "What the admin's own search box has learned — it teaches admin, it is not catalogue search.",
  },

  // ── RETIRE — keeps working until the five tabs replace it ────────────────
  {
    route: '/admin/more',
    tab: 'retire',
    retire: 'later',
    note: 'The live More tab today. Goes once the five tabs exist.',
  },
  {
    route: '/admin/directory',
    tab: 'retire',
    retire: 'later',
    note: 'A phone-only card landing mirroring the People & shops menu group — the same job as /admin/more; People becomes one page.',
  },
];

/** The tab for a route, or `null` when the map does not name it. */
export function adminTabFor(route: string): AdminTab | null {
  return ADMIN_TAB_MAP.find((e) => e.route === route)?.tab ?? null;
}
