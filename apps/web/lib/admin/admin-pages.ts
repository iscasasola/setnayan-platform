/**
 * admin-pages.ts — THE ADMIN, REORGANISED: seven places, eighteen pages, one dropdown each.
 *
 * Owner, 16–17 Nov 2026: *"Spend the other 20% for the admin dashboard full reorganization with the rule of the simple
 * and categorized toggle idea"* · *"yes i want the fewest possible. combine all that can combine to have a simpler
 * interface"* · *"Yes, all 5"* (calls 1–5, then 10–14). The drawing is `Setnayan-specs/prototypes/admin_reorg_2026-11-16/`
 * (v7, artifact P9ncoiiemWTMxMF3gGTq3J); this file encodes its `merges.py` MERGED table row for row.
 *
 *   Focus      the ask box + what needs you (the Focus | Full toggle's first half)
 *   Work       Queue · Kind ▾  (all 17 queues, disputes and fraud included)  ·  Messages · From ▾
 *   Money      To approve · Records · Prices · Offers & gifts (/admin/offers, NEW)
 *   People     Look up · Papers · Ties
 *   Catalogue  Services · Studio · How the app finds things
 *   Insights   one page, View ▾
 *   Setup      Team · Switches & delivery · Business, keys & privacy · Help   (under the avatar, owner-only)
 *
 * ─── A PAGE IS ONE JOB; ITS OLD PAGES ARE ITS VIEWS ─────────────────────────
 * Every set of pages that does one job is ONE page whose dropdown picks the view. No job is lost: each old page is a
 * view, and its old address forwards (middleware, `lib/legacy-redirects.ts` → `adminMergedForward` below) to the merged
 * page with that view preselected — the visitor's own query riding along, so an action's `?saved=1` still lands.
 * The merged page renders the old page's own body for that view, unchanged (see `app/admin/_components/merged-view.ts`).
 * A forward costs no route (the reason the forwards live in the middleware, not in pages or `next.config`).
 *
 * ─── WHY THIS IS A NEW FILE BESIDE `admin-tabs.ts` ─────────────────────────
 * `lib/admin/admin-tabs.ts` is the 13 Nov five-tab map. Three open PRs edit it (#7827 badges, #7693 catalogue,
 * #7585 team), so this build does not: the shell (bottom bar, desktop rail, pinned row, avatar) reads THIS file, and
 * `admin-tabs.ts` is folded into it once those land. Until then both are guarded — `admin-pages.test.ts` holds this one
 * to every `app/admin` page and every old address. `WAITS_ON` names each place that still points at an old screen.
 *
 * Words: supplier, never vendor (in anything a person reads). Plain data only — no icons, no React.
 */

import { claimScore, type AdminParams, type AdminTab, type AdminView } from './admin-tabs';

export type AdminPlaceKey = 'focus' | 'work' | 'money' | 'people' | 'catalogue' | 'insights' | 'setup';
export type AdminBarKey = Exclude<AdminPlaceKey, 'focus' | 'setup'>;

/** One view of a merged page. `olds` are the addresses that forward HERE (exact paths). */
export type AdminPageView = AdminView & {
  /** Old addresses (exact paths) the middleware forwards to `href`. */
  olds?: readonly string[];
  /** A heading inside the page's own dropdown (Queue's Kind ▾ is grouped as the Work landing draws it). */
  kindGroup?: string;
};

export type AdminMergedPage = {
  key: string;
  place: AdminPlaceKey;
  label: string;
  /** The page's own dropdown word — "Kind", "What", "Who"… `null` = one view, no dropdown. */
  picker: string | null;
  /** The page's address (its first view). `null` = being built in another PR (`waitsOn`), not drawn. */
  href: string | null;
  /** One line, as the drawing words it. */
  line: string;
  views: readonly AdminPageView[];
  /** Open-one pages (one shop, one case) that stay pages and open from this page's list with ‹ back. */
  openOne?: readonly string[];
  /** Open PRs that own a screen this page shows as it is today. */
  waitsOn?: readonly string[];
};

const v = (
  key: string,
  label: string,
  href: string,
  more: Omit<AdminPageView, 'key' | 'label' | 'href'> = {},
): AdminPageView => ({ key, label, href, ...more });

// ─── the eighteen pages ────────────────────────────────────────────────────

export const ADMIN_MERGED_PAGES: readonly AdminMergedPage[] = [
  {
    key: 'focus',
    place: 'focus',
    label: 'Focus',
    picker: null,
    href: '/admin',
    line: 'The ask box + what needs you. Unchanged.',
    views: [v('focus', 'Focus home', '/admin', { match: ['/admin$'] })],
  },

  // ── WORK ──
  {
    key: 'queue',
    place: 'work',
    label: 'Queue',
    picker: 'Kind',
    href: '/admin/work?view=all',
    line: 'Every request people sent, one list, oldest first. Each item still opens its own card.',
    views: [
      v('all', 'All', '/admin/work?view=all', {
        match: ['/admin/work?view=all', '/admin/queues', '/admin/more'],
        olds: ['/admin/queues', '/admin/more'],
        tip: 'Everything waiting on you, most urgent first.',
      }),
      v('approvals', 'Approvals', '/admin/work?view=approvals', { kindGroup: 'Requests to decide', queue: 'approvals', olds: ['/admin/approvals'] }),
      v('completions', 'Completions', '/admin/work?view=completions', { kindGroup: 'Requests to decide', queue: 'completions', olds: ['/admin/completions'] }),
      v('pax-changes', 'Pax changes', '/admin/work?view=pax-changes', { kindGroup: 'Requests to decide', queue: 'pax-changes', olds: ['/admin/pax-changes'] }),
      v('corrections', 'Profile corrections', '/admin/work?view=corrections', { kindGroup: 'Requests to decide', queue: 'corrections', olds: ['/admin/corrections'] }),
      v('force-majeure', 'Force majeure', '/admin/work?view=force-majeure', {
        kindGroup: 'Requests to decide',
        queue: 'force-majeure',
        olds: ['/admin/force-majeure'],
        match: ['/admin/work?view=force-majeure', '/admin/force-majeure'],
      }),
      v('music-maker', 'Music Maker', '/admin/work?view=music-maker', { kindGroup: 'Requests to decide', queue: 'pakanta', olds: ['/admin/pakanta'] }),
      v('user-reports', 'User reports', '/admin/work?view=user-reports', { kindGroup: 'Reports & safety', queue: 'user-reports', olds: ['/admin/user-reports'] }),
      v('disputes', 'Disputes', '/admin/work?view=disputes', { kindGroup: 'Reports & safety', queue: 'disputes', olds: ['/admin/disputes'] }),
      v('fraud', 'Fraud', '/admin/work?view=fraud', { kindGroup: 'Reports & safety', queue: 'fraud', olds: ['/admin/fraud'] }),
      v('chat-flags', 'Chat flags', '/admin/work?view=chat-flags', { kindGroup: 'Reports & safety', queue: 'chat-flags', olds: ['/admin/chat-flags'] }),
      v('repost', 'Repost watch', '/admin/work?view=repost', { kindGroup: 'Reports & safety', queue: 'repost-watch', olds: ['/admin/repost-watch'] }),
      v('integrity', 'Integrity watch', '/admin/work?view=integrity', { kindGroup: 'Reports & safety', queue: 'integrity-watch', olds: ['/admin/integrity-watch'] }),
      v('ai-abuse', 'AI abuse', '/admin/work?view=ai-abuse', { kindGroup: 'Reports & safety', queue: 'concierge-abuse', olds: ['/admin/concierge-abuse'] }),
      v('reviews', 'Review appeals', '/admin/work?view=reviews', { kindGroup: 'Reviews & writing', queue: 'reviews', olds: ['/admin/reviews'] }),
      v('editorial', 'Editorial', '/admin/work?view=editorial', {
        kindGroup: 'Reviews & writing',
        queue: 'editorial-review',
        olds: ['/admin/editorial-review'],
        match: ['/admin/work?view=editorial', '/admin/editorial-review'],
      }),
      v('account-deletions', 'Account deletions', '/admin/work?view=account-deletions', { kindGroup: 'Removals', queue: 'account-deletions', olds: ['/admin/account-deletions'] }),
      v('event-removals', 'Event removals', '/admin/work?view=event-removals', { kindGroup: 'Removals', queue: 'event-deletions', olds: ['/admin/event-deletions'] }),
    ],
    openOne: ['/admin/force-majeure/[flagId]', '/admin/editorial-review/[editorialId]'],
  },
  {
    key: 'messages',
    place: 'work',
    label: 'Messages',
    picker: 'From',
    href: '/admin/help',
    line: 'One inbox: help messages and demo-shop inquiries.',
    views: [
      v('help', 'Help messages', '/admin/help', { queue: 'help' }),
      v('demo-inquiries', 'Demo-shop inquiries', '/admin/help?view=demo-inquiries', {
        olds: ['/admin/demo-vendors/inquiries'],
        match: ['/admin/help?view=demo-inquiries', '/admin/demo-vendors/inquiries'],
      }),
    ],
    openOne: ['/admin/demo-vendors/inquiries/[threadId]'],
  },

  // ── MONEY ──
  {
    key: 'to-approve',
    place: 'money',
    label: 'To approve',
    picker: 'What',
    href: '/admin/payments',
    line: 'Every money item that waits for an admin press. One card each.',
    views: [
      v('payments', 'Payments to confirm', '/admin/payments', { queue: 'payments', match: ['/admin/payments$'] }),
      v('refunds', 'Refunds', '/admin/payments?view=refunds', {
        queue: 'supplier-refunds',
        olds: ['/admin/payments/supplier-refunds'],
        match: ['/admin/payments?view=refunds', '/admin/payments/supplier-refunds'],
      }),
      v('payouts', 'Payouts', '/admin/payments?view=payouts', { queue: 'payouts', olds: ['/admin/payouts'] }),
      v('fees', 'Fees owed', '/admin/payments?view=fees', { queue: 'booking-fees', olds: ['/admin/booking-fees'] }),
      v('payment-options', 'Payment options', '/admin/payments?view=payment-options', { queue: 'payment-options', olds: ['/admin/payment-options'] }),
      v('subscriptions', 'Subscriptions', '/admin/payments?view=subscriptions', { queue: 'subscriptions', olds: ['/admin/subscriptions'] }),
    ],
  },
  {
    key: 'records',
    place: 'money',
    label: 'Records',
    picker: 'Show',
    href: '/admin/money?view=everything',
    line: 'Read-only: all money in and out, and every receipt.',
    views: [
      v('everything', 'Everything', '/admin/money?view=everything'),
      v('receipts', 'Receipts', '/admin/money?view=receipts', { olds: ['/admin/receipts'] }),
    ],
  },
  {
    key: 'prices',
    place: 'money',
    label: 'Prices',
    picker: 'What',
    href: '/admin/pricing',
    line: 'Every price in one place (already merged on the site; two old addresses forward).',
    views: [
      v('prices', 'Prices', '/admin/pricing', { match: ['/admin/pricing', '/admin/pricing?tab=pricing', '/admin/addons'] }),
      v('ai-prices', 'Setnayan AI prices', '/admin/pricing?tab=setnayan-ai'),
      v('papic-shots', 'Papic shot prices', '/admin/pricing?tab=papic-shots'),
      v('bands', 'Market price bands', '/admin/pricing?tab=price-bands', { match: ['/admin/pricing?tab=price-bands', '/admin/price-bands'] }),
      v('free-windows', 'Free windows', '/admin/pricing?tab=free-windows'),
    ],
    waitsOn: ['#7693 (pricing/page.tsx)', '#7874 (pricing/_components)'],
  },
  {
    key: 'offers',
    place: 'money',
    label: 'Offers & gifts',
    picker: 'What',
    href: '/admin/offers',
    line: 'Everything Setnayan gives away.',
    views: [
      v('launch-offer', 'Launch offer', '/admin/offers', { match: ['/admin/offers$'], olds: ['/admin/launch-offer'] }),
      v('discount-codes', 'Discount codes', '/admin/offers?view=discount-codes', {
        olds: ['/admin/discount-codes'],
        // the studio's old tab answers here too (owner call 12)
        match: ['/admin/offers?view=discount-codes', '/admin/discount-codes', '/admin/studio?tab=discount-codes'],
      }),
      v('referrals', 'Referrals', '/admin/offers?view=referrals', {
        olds: ['/admin/referrals'],
        match: ['/admin/offers?view=referrals', '/admin/referrals', '/admin/studio?tab=referrals'],
      }),
      v('gifts', 'Gifts & comps', '/admin/offers?view=gifts', { olds: ['/admin/gifts'] }),
      v('founder-seats', 'Founder seats', '/admin/offers?view=founder-seats', { olds: ['/admin/founder-seats'] }),
      // 🏅 Carried from #7827 (controller 17 Nov). The monthly Spotlight Awards fold into it (DECISION_LOG dd7d05f1 (4)),
      // so their old addresses — the page and the Studio tab — open it too.
      v('badges', 'Badges & seals', '/admin/offers?view=badges', {
        olds: ['/admin/badges', '/admin/spotlight-awards'],
        match: ['/admin/offers?view=badges', '/admin/badges', '/admin/spotlight-awards', '/admin/studio?tab=spotlight-awards'],
      }),
    ],
    openOne: ['/admin/discount-codes/new', '/admin/discount-codes/[id]/edit'],
  },

  // ── PEOPLE ──
  {
    key: 'look-up',
    place: 'people',
    label: 'Look up',
    picker: 'Who',
    href: '/admin/accounts',
    line: 'One search for any person, shop, event or venue; each opens its own page.',
    views: [
      v('everyone', 'Everyone', '/admin/accounts', { match: ['/admin/accounts'] }),
      v('people', 'People', '/admin/accounts?tab=users', { match: ['/admin/accounts?tab=users', '/admin/users'] }),
      v('shops', 'Shops', '/admin/accounts?tab=vendors', { match: ['/admin/accounts?tab=vendors', '/admin/vendors'] }),
      v('events', 'Events', '/admin/accounts?tab=events', { match: ['/admin/accounts?tab=events', '/admin/events'] }),
      v('venues', 'Venues', '/admin/accounts?tab=venues', { match: ['/admin/accounts?tab=venues', '/admin/venues'] }),
      v('demo-shops', 'Demo shops', '/admin/accounts?tab=demo-vendors', {
        match: ['/admin/accounts?tab=demo-vendors', '/admin/demo-vendors'],
      }),
    ],
    openOne: [
      '/admin/users/[userId]',
      '/admin/vendors/[vendorProfileId]',
      '/admin/vendors/[vendorProfileId]/edit',
      '/admin/vendors/[vendorProfileId]/plan',
      '/admin/vendors/[vendorProfileId]/team',
      '/admin/events/[eventId]',
      '/admin/venues/[id]',
      '/admin/venues/new',
    ],
  },
  {
    key: 'papers',
    place: 'people',
    label: 'Papers',
    picker: 'Which',
    href: '/admin/verify',
    line: 'Every paper waiting for an eye.',
    views: [
      v('three-papers', 'Three papers (shops)', '/admin/verify', { queue: 'verify' }),
      v('id-documents', 'ID documents', '/admin/verification-docs'),
    ],
    // verify/page.tsx and verification-docs/page.tsx are being changed in these PRs, so both keep their own address
    // today and the dropdown links to each as it is.
    waitsOn: ['#7875', '#7793', '#7890 (verify/page.tsx)', '#7874 (verification-docs/page.tsx)'],
  },
  {
    key: 'ties',
    place: 'people',
    label: 'Ties',
    picker: 'Show',
    href: '/admin/vendor-partnerships',
    line: 'How shops are linked to each other.',
    views: [
      v('partnerships', 'Partnerships', '/admin/vendor-partnerships', { queue: 'vendor-partnerships' }),
      v('recommendations', 'Recommendations', '/admin/vendor-partnerships?view=recommendations', {
        olds: ['/admin/vendor-recommendations'],
      }),
    ],
  },

  // ── CATALOGUE ──
  {
    key: 'services',
    place: 'catalogue',
    label: 'Services',
    picker: 'What',
    href: '/admin/categories',
    line: 'The taxonomy, its new-name requests, and the budget numbers built on it.',
    views: [
      v('categories', 'Categories', '/admin/categories'),
      v('event-types', 'Event types', '/admin/categories?list=event-types'),
      v('religions', 'Religions', '/admin/categories?list=religions'),
      v('hub-tools', 'Hub tools', '/admin/categories?list=hub-tools'),
      v('requests', 'Requests', '/admin/categories/requests', {
        queue: 'service-requests',
        match: ['/admin/categories/requests', '/admin/categories?show=requests'],
      }),
      v('budget', 'Budget benchmarks', '/admin/budget-planner'),
    ],
    openOne: ['/admin/categories/requests/[requestId]'],
    // categories/page.tsx and budget-planner/page.tsx are being changed there; both keep their address today.
    waitsOn: ['#7693 (categories/page.tsx, the new /admin/catalogue home)', '#7874 (budget-planner/page.tsx)'],
  },
  {
    key: 'studio',
    place: 'catalogue',
    label: 'Studio',
    picker: 'What',
    href: '/admin/studio',
    line: 'Every template, media file, story and social post. Two groups become one page.',
    views: [
      v('website', 'Website', '/admin/studio?tab=website', { kindGroup: 'Templates & media', match: ['/admin/studio', '/admin/studio?tab=website', '/admin/website'] }),
      v('reveal', 'Reveal Studio', '/admin/studio?tab=reveal-studio', { kindGroup: 'Templates & media', match: ['/admin/studio?tab=reveal-studio', '/admin/reveal-studio'] }),
      v('patiktok', 'Patiktok', '/admin/studio?tab=patiktok', { kindGroup: 'Templates & media', match: ['/admin/studio?tab=patiktok', '/admin/patiktok'] }),
      v('inspiration', 'Inspiration', '/admin/studio?tab=moodboard-library', {
        kindGroup: 'Templates & media',
        match: ['/admin/studio?tab=moodboard-library', '/admin/moodboard-library'],
      }),
      v('front-door-videos', 'Front-door videos', '/admin/studio?tab=background-videos', {
        kindGroup: 'Templates & media',
        olds: ['/admin/background-videos'],
      }),
      v('website-media', 'Website media', '/admin/studio?tab=website-media', { kindGroup: 'Templates & media', olds: ['/admin/website-media'] }),
      v('hub-music', 'Hub music', '/admin/studio?tab=hub-music', { kindGroup: 'Templates & media', olds: ['/admin/hub-music'] }),
      v('songs', 'Songs', '/admin/studio?tab=songs', { kindGroup: 'Templates & media', match: ['/admin/studio?tab=songs', '/admin/songs'] }),
      v('real-stories', 'Real Stories (retired)', '/admin/studio?tab=real-stories', {
        kindGroup: 'Stories & social',
        match: ['/admin/studio?tab=real-stories', '/admin/real-stories'],
      }),
      v('storytellers', 'Storytellers', '/admin/studio?tab=storytellers', { kindGroup: 'Stories & social' }),
      v('recaps', 'Recaps', '/admin/studio?tab=recaps', { kindGroup: 'Stories & social', match: ['/admin/studio?tab=recaps', '/admin/recaps'] }),
      v('journal-spotlights', 'Journal Spotlights', '/admin/studio?tab=journal-spotlights', {
        kindGroup: 'Stories & social',
        match: ['/admin/studio?tab=journal-spotlights', '/admin/journal-spotlights'],
      }),
      v('social-queue', 'Social queue', '/admin/studio?tab=social-queue', {
        kindGroup: 'Stories & social',
        queue: 'social-queue',
        match: ['/admin/studio?tab=social-queue', '/admin/social-queue'],
      }),
    ],
  },
  {
    key: 'finds',
    place: 'catalogue',
    label: 'How the app finds things',
    picker: 'What',
    href: '/admin/ugat',
    line: 'Maps, menus, search and onboarding.',
    views: [
      v('menus', 'Menus & icons', '/admin/ugat', { match: ['/admin/ugat', '/admin/ugat?tab=menus', '/admin/menus'] }),
      v('screens', 'Screens map', '/admin/ugat?tab=screens', { match: ['/admin/ugat?tab=screens', '/admin/ugat/map'] }),
      v('onboarding', 'Onboarding questions', '/admin/ugat?tab=onboarding', { match: ['/admin/ugat?tab=onboarding', '/admin/onboarding'] }),
      v('search', 'Search settings', '/admin/ugat?tab=search', { olds: ['/admin/search-memory'] }),
      v('brain', 'AI brain (old)', '/admin/ugat?tab=brain', { match: ['/admin/ugat?tab=brain', '/admin/brain'] }),
    ],
  },

  // ── INSIGHTS ──
  {
    key: 'insights',
    place: 'insights',
    label: 'Insights',
    picker: 'View',
    href: '/admin/app-performance?tab=overview',
    line: 'One read-only page; the View ▾ picks the chart.',
    views: [
      v('overview', 'Overview', '/admin/app-performance?tab=overview', { kindGroup: 'Growth', match: ['/admin/app-performance?tab=overview', '/admin/insights'] }),
      v('visits', 'Visits', '/admin/app-performance?tab=visits', { kindGroup: 'Growth' }),
      v('growth', 'Sign-ups & growth', '/admin/app-performance?tab=growth', { kindGroup: 'Growth', match: ['/admin/app-performance?tab=growth', '/admin/growth'] }),
      v('funnels', 'Funnels', '/admin/app-performance?tab=funnels', { kindGroup: 'Growth', match: ['/admin/app-performance?tab=funnels', '/admin/funnels'] }),
      v('intelligence', 'Intelligence', '/admin/app-performance?tab=intelligence', {
        kindGroup: 'Growth',
        match: ['/admin/app-performance?tab=intelligence', '/admin/intelligence'],
      }),
      v('seo', 'SEO & GEO', '/admin/app-performance?tab=seo', { kindGroup: 'Growth', match: ['/admin/app-performance?tab=seo', '/admin/seo'] }),
      v('demand', 'Demand', '/admin/app-performance?tab=demand', { kindGroup: 'Growth', olds: ['/admin/demand'] }),
      v('problems', 'Problems', '/admin/app-performance?tab=connection-logs', {
        kindGroup: 'App health',
        queue: 'problems',
        match: ['/admin/app-performance?tab=connection-logs', '/admin/connection-logs'],
      }),
      v('slow-loads', 'Slow loads', '/admin/app-performance?tab=slow-loads', { kindGroup: 'App health' }),
      v('browser-blocks', 'Browser blocks', '/admin/app-performance?tab=browser-blocks', { kindGroup: 'App health' }),
      v('interconnections', 'Interconnections', '/admin/app-performance?tab=interconnections', { kindGroup: 'App health' }),
      v('offline', 'Offline daemon', '/admin/app-performance?tab=offline', { kindGroup: 'App health', match: ['/admin/app-performance?tab=offline', '/admin/offline'] }),
      v('costs', 'Expenses & hiring', '/admin/app-performance?tab=operations', {
        kindGroup: 'Costs',
        match: ['/admin/app-performance?tab=operations', '/admin/operations-hiring'],
      }),
      v('papic-storage', 'Papic storage', '/admin/app-performance?tab=papic-storage', { kindGroup: 'Costs', olds: ['/admin/papic-storage'] }),
    ],
  },

  // ── SETUP (owner-only, under the avatar) ──
  {
    key: 'team',
    place: 'setup',
    label: 'Team',
    picker: 'Show',
    href: null,
    line: 'Who can do what, and who did it.',
    views: [],
    waitsOn: ['#7585 (Team & permissions, Admin log)'],
  },
  {
    key: 'switches',
    place: 'setup',
    label: 'Switches & delivery',
    picker: 'What',
    href: '/admin/switches',
    line: 'Everything you switch on or off, and how mail goes out.',
    views: [
      v('switches', 'Switches · Demo mode', '/admin/switches', {
        match: ['/admin/switches', '/admin/settings?tab=demo-mode', '/admin/settings/demo-mode'],
      }),
      v('email', 'Email delivery', '/admin/switches?view=email', {
        olds: ['/admin/email-delivery'],
        match: ['/admin/switches?view=email', '/admin/email-delivery', '/admin/settings?tab=notifications', '/admin/notifications'],
      }),
      v('live-watch', 'Live Watch channels', '/admin/switches?view=live-watch', { olds: ['/admin/live-studio-channels'] }),
      v('colours', 'Colours', '/admin/switches?view=colours', { olds: ['/admin/colours'] }),
    ],
  },
  {
    key: 'business',
    place: 'setup',
    label: 'Business, keys & privacy',
    picker: 'What',
    href: '/admin/business',
    line: 'The business, its keys and filings, and where money lands.',
    views: [
      v('business', 'Business & compliance', '/admin/business', {
        match: ['/admin/business', '/admin/settings', '/admin/settings?tab=settings', '/admin/settings?tab=compliance', '/admin/compliance'],
      }),
      v('accounts', 'Receiving accounts (GCash · BDO QR)', '/admin/business?view=accounts', { olds: ['/admin/settings/payment-methods'] }),
      v('secrets', 'Secrets', '/admin/business?view=secrets', { olds: ['/admin/secrets'] }),
      v('integrations', 'Integrations', '/admin/business?view=integrations', { olds: ['/admin/integrations'] }),
      v('privacy', 'Privacy & NPC filing', '/admin/business?view=privacy', {
        olds: ['/admin/data-privacy'],
        match: ['/admin/business?view=privacy', '/admin/data-privacy', '/admin/npc-readiness'],
      }),
      v('data-sheet', 'Data sheet', '/admin/business?view=data-sheet', { olds: ['/admin/compliance/data-sheet'] }),
    ],
  },
  {
    key: 'help',
    place: 'setup',
    label: 'Help',
    picker: null,
    href: '/admin/ask',
    line: 'What can I ask? — also the ? in the ask box.',
    views: [v('ask', 'What can I ask? + A4', '/admin/ask')],
  },
];

// ─── the five bar tabs + Setup ─────────────────────────────────────────────

type BarMeta = Pick<AdminTab, 'label' | 'icon' | 'href' | 'searchPlaceholder' | 'create'>;

/** Each tab's landing is the tab's own dashboard (the drawing's v5 landings), at an address it already had. */
const BAR: Record<AdminBarKey, BarMeta> = {
  work: { label: 'Work', icon: 'Inbox', href: '/admin/work', searchPlaceholder: 'Search work, people, shops, pages' },
  money: { label: 'Money', icon: 'Banknote', href: '/admin/money', searchPlaceholder: 'Search payments, references, receipts' },
  people: {
    label: 'People',
    icon: 'Users',
    href: '/admin/directory',
    searchPlaceholder: 'Search people, shops, events, venues',
    create: { label: 'Add a venue', href: '/admin/venues/new' },
  },
  catalogue: { label: 'Catalogue', icon: 'LayoutGrid', href: '/admin/categories', searchPlaceholder: 'Search categories, prices, templates' },
  insights: { label: 'Insights', icon: 'LineChart', href: '/admin/app-performance', searchPlaceholder: 'Search numbers, problems, reports' },
};

export const ADMIN_BAR_ORDER: readonly AdminBarKey[] = ['work', 'money', 'people', 'catalogue', 'insights'];

/** The tab landings — each tab's own address, before a page is picked. Lit by its tab, owned by no page. */
export const ADMIN_TAB_LANDING: Record<AdminBarKey, string | null> = {
  work: '/admin/work',
  money: '/admin/money',
  people: '/admin/directory',
  insights: '/admin/app-performance',
  // The Catalogue home is #7693's new page (/admin/catalogue). Until it lands the tab opens Services.
  catalogue: null,
};

export function pagesIn(place: AdminPlaceKey): AdminMergedPage[] {
  return ADMIN_MERGED_PAGES.filter((p) => p.place === place);
}

/** The heading a page's views sit under in the tab's ▾ list — "Queue · Kind ▾", as drawn. */
export function pageGroupLabel(p: AdminMergedPage): string {
  return p.picker ? `${p.label} · ${p.picker} ▾` : p.label;
}

/**
 * The five bar tabs in the shape the shell already draws (`AdminTab`): each tab's views are its pages' views, grouped
 * under the page. Catalogue keeps one ⚙ row — the categories CSV export, a download rather than a place.
 */
export const ADMIN_BAR_TABS: readonly AdminTab[] = ADMIN_BAR_ORDER.map((key) => ({
  key,
  ...BAR[key],
  views: pagesIn(key)
    .filter((p) => p.href)
    .flatMap((p) => p.views.map((view) => ({ ...view, key: `${p.key}.${view.key}`, group: pageGroupLabel(p) }))),
  settings: key === 'catalogue' ? [{ key: 'export', label: 'Export categories (CSV)', href: '/admin/categories/export' }] : [],
}));

/** Setup — the avatar's pages (owner-only). A page another PR is still building has no address and is not drawn. */
export const ADMIN_SETUP_PAGES: readonly AdminMergedPage[] = pagesIn('setup');

// ─── the matcher ───────────────────────────────────────────────────────────

export type AdminShellPlace =
  | { kind: 'focus' }
  | { kind: 'landing'; tab: AdminTab }
  | { kind: 'tab'; tab: AdminTab; page: AdminMergedPage; view: AdminView; isSetting: boolean }
  | { kind: 'setup'; page: AdminMergedPage; view: AdminPageView };

type Claim = { pattern: string; place: AdminShellPlace };

function claims(): Claim[] {
  const out: Claim[] = [{ pattern: '/admin$', place: { kind: 'focus' } }];
  for (const tab of ADMIN_BAR_TABS) {
    const landing = ADMIN_TAB_LANDING[tab.key];
    if (landing) out.push({ pattern: `${landing}$`, place: { kind: 'landing', tab } });
    for (const page of pagesIn(tab.key)) {
      for (const view of page.views) {
        const shaped = tab.views.find((x) => x.key === `${page.key}.${view.key}`)!;
        for (const pattern of view.match ?? [view.href]) out.push({ pattern, place: { kind: 'tab', tab, page, view: shaped, isSetting: false } });
      }
    }
    for (const s of tab.settings) out.push({ pattern: s.href, place: { kind: 'tab', tab, page: pagesIn(tab.key)[0]!, view: s, isSetting: true } });
  }
  for (const page of ADMIN_SETUP_PAGES) {
    for (const view of page.views) {
      for (const pattern of view.match ?? [view.href]) out.push({ pattern, place: { kind: 'setup', page, view } });
    }
  }
  return out;
}

const CLAIMS = claims();

/** Every claim, flat — the tests read this. */
export function allAdminShellClaims(): readonly Claim[] {
  return CLAIMS;
}

/** Where an address lives in the reorganised admin: the most specific claim wins. `null` = no home. */
export function adminShellPlaceFor(pathname: string, params?: AdminParams | null): AdminShellPlace | null {
  let best: AdminShellPlace | null = null;
  let bestScore = 0;
  for (const { pattern, place } of CLAIMS) {
    const s = claimScore(pattern, pathname, params);
    if (s > bestScore) {
      best = place;
      bestScore = s;
    }
  }
  return best;
}

/** The bar tab to light; Setup and strangers light none. `/admin` lights Work — in Full mode it IS the Work dashboard,
 *  and in Focus the bar is not drawn. */
export function activeAdminBarKey(pathname: string, params?: AdminParams | null): AdminBarKey | null {
  const place = adminShellPlaceFor(pathname, params);
  if (place?.kind === 'focus') return 'work';
  return place && (place.kind === 'tab' || place.kind === 'landing') ? (place.tab.key as AdminBarKey) : null;
}

// ─── the forwards ──────────────────────────────────────────────────────────

/** Every old address → the merged view it forwards to (exact paths). */
export const ADMIN_MERGED_FORWARDS: ReadonlyMap<string, string> = new Map(
  ADMIN_MERGED_PAGES.flatMap((p) => p.views.flatMap((view) => (view.olds ?? []).map((old) => [old, view.href] as const))),
);

/**
 * Where an old admin address forwards, with the visitor's query carried over (the target's own `view`/`tab` wins), or
 * `null` when `path` is not one of them. Pure — the middleware pays one Map lookup.
 */
export function adminMergedForward(path: string, search = ''): string | null {
  const target = ADMIN_MERGED_FORWARDS.get(path);
  if (!target) return null;
  const q = target.indexOf('?');
  const out = new URLSearchParams(q === -1 ? '' : target.slice(q + 1));
  const visitor = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const [k, val] of visitor) if (!out.has(k)) out.append(k, val);
  const base = q === -1 ? target : target.slice(0, q);
  const qs = out.toString();
  return qs ? `${base}?${qs}` : base;
}

/** The `?view=` a merged page was opened on (first value), or `undefined`. */
export function mergedViewKey(sp: Record<string, string | string[] | undefined>): string | undefined {
  const raw = sp.view;
  return Array.isArray(raw) ? raw[0] : raw;
}
