/**
 * admin-tabs.ts — THE ONE SOURCE for where every admin page lives.
 *
 * Owner, 13 Nov 2026: *"admin has been ok'ed"* — the approved drawing is
 * `Setnayan-specs/prototypes/admin_pub/` (map.html "Place map" is the table
 * this file encodes, row for row). DECISION_LOG 2026-11-13 "ADMIN DRAWING
 * APPROVED — BUILD IT" and "ADMIN FIVE TABS — OPEN QUESTIONS SETTLED".
 *
 *   Bottom bar   Work · Money · People · Catalogue · Insights   (no More tab)
 *   Avatar       Team · Admin log · Secrets · Email delivery · Switches ·
 *                Business — the admin-of-admin, under the avatar
 *
 * ─── WHAT THIS SLICE IS, AND IS NOT ──────────────────────────────────────
 * Slice 1 is the SHELL: navigation only. No page moved address — every
 * shipped `/admin/...` URL keeps working exactly as it did, and this file only
 * says which tab › view each one belongs to. So nothing needed a redirect; the
 * old addresses ARE the addresses. (The drawing's own rule, 2026-10-28: "all
 * mapping will be kept".)
 *
 * ─── A VIEW IS A PLACE, A ⚙ ROW IS A SETTING ─────────────────────────────
 *  - `views`    — what `Page · View ▾` offers (T2, the one selector).
 *  - `settings` — what the tab's ⚙ sheet offers (Money ⚙ › Receiving
 *                 accounts, Catalogue ⚙ › Menus & icons, …).
 * Both are homes: a route is "placed" when exactly one view, setting or avatar
 * row claims it. `admin-routes-all-have-a-tab.test.ts` walks `app/admin` and
 * fails when a page or route handler has no home here.
 *
 * ─── HOOKS FOR THE SLICES BUILT ELSEWHERE ────────────────────────────────
 * Team & permissions (areas × Basic/Escalated) and the Admin log have no page
 * yet — other sessions are building them. Their avatar rows are declared here
 * with `href: null` and `slice:` naming who builds them; the shell renders
 * NOTHING for a row without an address (a row that goes nowhere is a fake
 * door). The day the page ships, its builder sets `href` and the row appears.
 * The future `can(user, area, level)` helper will read `area` off each tab.
 *
 * Words: supplier, never vendor (in anything a person reads).
 * Plain data only — no icons, no React — so the server layout, the client bar
 * and the tests can all import it.
 */

export type AdminTabKey = 'work' | 'money' | 'people' | 'catalogue' | 'insights';

/** A place the admin can be. `match` entries are the addresses it owns:
 *  `'/admin/foo'` owns that path and everything under it; `'/admin/foo$'`
 *  owns that path ONLY (so `/admin` can never swallow an unplaced page); `'/admin/foo?tab=x'`
 *  owns that exact path when the query carries `tab=x`. The most specific
 *  claim wins, so `/admin/studio?tab=referrals` (Money) beats `/admin/studio`
 *  (Catalogue). */
export type AdminView = {
  key: string;
  label: string;
  /** Where the selector sends you. */
  href: string;
  /** Addresses this view owns. Defaults to `[href]`. */
  match?: string[];
  /** The work-queue key in `AdminQueueCounts` whose count belongs to this view. */
  queue?: string;
  /** One-line hint, for the ⓘ. */
  tip?: string;
  /** A heading in the open View ▾ list; consecutive views with the same group share it. */
  group?: string;
};

export type AdminTab = {
  key: AdminTabKey;
  label: string;
  /** Lucide icon name; the client bar maps it to a component. */
  icon: 'Inbox' | 'Banknote' | 'Users' | 'LayoutGrid' | 'LineChart';
  /** The tab's landing — its first view. */
  href: string;
  /** What the thumb-row search says it looks through (T6). */
  searchPlaceholder: string;
  /** The ⌘ thumb-row ＋, only where a page here creates something. */
  create?: { label: string; href: string };
  views: AdminView[];
  /** The tab's ⚙ sheet. Empty = no ⚙ (the gear never opens nothing). */
  settings: AdminView[];
};

export type AdminAvatarRow = {
  key: string;
  label: string;
  /** `null` = the page is being built in another slice; the row is not drawn. */
  href: string | null;
  match?: string[];
  /** The slice that will give this row an address. */
  slice?: string;
};

export const ADMIN_TABS: readonly AdminTab[] = [
  {
    key: 'work',
    label: 'Work',
    icon: 'Inbox',
    href: '/admin',
    searchPlaceholder: 'Search work, people, shops, pages',
    views: [
      {
        key: 'work',
        // The drawing's word for the landing (start.html VIEWS: "All").
        label: 'All',
        href: '/admin',
        // `/admin/more` and `/admin/queues` are retired hubs (the five tabs and
        // View ▾ replace them) — they still answer, and they light Work.
        match: ['/admin$', '/admin/work', '/admin/queues', '/admin/more'],
        tip: 'Everything waiting on you, most urgent first.',
      },
      { key: 'approvals', label: 'Approvals', group: 'Every shipped queue', href: '/admin/approvals', queue: 'approvals' },
      { key: 'messages', label: 'Messages', group: 'Every shipped queue', href: '/admin/help', queue: 'help' },
      { key: 'account-deletions', label: 'Account deletions', group: 'Every shipped queue', href: '/admin/account-deletions', queue: 'account-deletions' },
      { key: 'event-removals', label: 'Event removals', group: 'Every shipped queue', href: '/admin/event-deletions', queue: 'event-deletions' },
      { key: 'disputes', label: 'Disputes', group: 'Every shipped queue', href: '/admin/disputes', queue: 'disputes' },
      { key: 'force-majeure', label: 'Force majeure', group: 'Every shipped queue', href: '/admin/force-majeure', queue: 'force-majeure' },
      { key: 'user-reports', label: 'User reports', group: 'Every shipped queue', href: '/admin/user-reports', queue: 'user-reports' },
      { key: 'fraud', label: 'Fraud queue', group: 'Every shipped queue', href: '/admin/fraud' },
      { key: 'ai-abuse', label: 'Setnayan AI abuse', group: 'Every shipped queue', href: '/admin/concierge-abuse', queue: 'concierge-abuse' },
      { key: 'integrity', label: 'Integrity watch', group: 'Every shipped queue', href: '/admin/integrity-watch', queue: 'integrity-watch' },
      { key: 'repost', label: 'Repost watch', group: 'Every shipped queue', href: '/admin/repost-watch' },
      { key: 'chat-flags', label: 'Chat contact flags', group: 'Every shipped queue', href: '/admin/chat-flags', queue: 'chat-flags' },
      { key: 'reviews', label: 'Review moderation', group: 'Every shipped queue', href: '/admin/reviews', queue: 'reviews' },
      { key: 'editorial', label: 'Editorial review', group: 'Every shipped queue', href: '/admin/editorial-review' },
      { key: 'completions', label: 'Completions', group: 'Every shipped queue', href: '/admin/completions', queue: 'completions' },
      { key: 'corrections', label: 'Profile corrections', group: 'Every shipped queue', href: '/admin/corrections', queue: 'corrections' },
      { key: 'pax', label: 'Pax changes', group: 'Every shipped queue', href: '/admin/pax-changes' },
      { key: 'music-maker', label: 'Music Maker queue', group: 'Every shipped queue', href: '/admin/pakanta' },
    ],
    settings: [],
  },
  {
    key: 'money',
    label: 'Money',
    icon: 'Banknote',
    href: '/admin/payments',
    searchPlaceholder: 'Search payments, references, receipts',
    views: [
      {
        key: 'to-confirm',
        label: 'To confirm',
        href: '/admin/payments',
        queue: 'payments',
        tip: 'Payments with a receipt waiting to be checked against the bank.',
      },
      { key: 'fees', label: 'Fees owed', href: '/admin/booking-fees', queue: 'booking-fees' },
      { key: 'refunds', label: 'Refunds', href: '/admin/payments/supplier-refunds' },
      { key: 'payouts', label: 'Payouts', href: '/admin/payouts', queue: 'payouts' },
      { key: 'receipts', label: 'Receipts', href: '/admin/receipts' },
      { key: 'subs', label: 'Subscriptions', href: '/admin/subscriptions', queue: 'subscriptions' },
      { key: 'payment-options', label: 'Payment options', href: '/admin/payment-options', queue: 'payment-options' },
      { key: 'everything', label: 'Everything', href: '/admin/money' },
    ],
    settings: [
      { key: 'accounts', label: 'Receiving accounts', href: '/admin/settings/payment-methods' },
      { key: 'launch-offer', label: 'Launch offer', href: '/admin/launch-offer' },
      {
        key: 'codes',
        label: 'Discount codes',
        href: '/admin/studio?tab=discount-codes',
        match: ['/admin/studio?tab=discount-codes', '/admin/discount-codes'],
      },
      {
        key: 'referrals',
        label: 'Referrals',
        href: '/admin/studio?tab=referrals',
        match: ['/admin/studio?tab=referrals', '/admin/referrals'],
      },
      { key: 'free-windows', label: 'Free windows', href: '/admin/pricing?tab=free-windows' },
    ],
  },
  {
    key: 'people',
    label: 'People',
    icon: 'Users',
    href: '/admin/accounts',
    searchPlaceholder: 'Search people, shops, events, venues',
    create: { label: 'Add a venue', href: '/admin/venues/new' },
    views: [
      {
        key: 'everything',
        label: 'Everything',
        href: '/admin/accounts',
        // the retired phone card grid answers and lights People
        match: ['/admin/accounts', '/admin/directory'],
      },
      { key: 'people', label: 'People', href: '/admin/accounts?tab=users', match: ['/admin/accounts?tab=users', '/admin/users'] },
      { key: 'shops', label: 'Shops', href: '/admin/accounts?tab=vendors', match: ['/admin/accounts?tab=vendors', '/admin/vendors'] },
      { key: 'events', label: 'Events', href: '/admin/accounts?tab=events', match: ['/admin/accounts?tab=events', '/admin/events'] },
      { key: 'venues', label: 'Venues', href: '/admin/accounts?tab=venues', match: ['/admin/accounts?tab=venues', '/admin/venues'] },
      {
        key: 'demo-shops',
        label: 'Demo shops',
        href: '/admin/accounts?tab=demo-vendors',
        match: ['/admin/accounts?tab=demo-vendors', '/admin/demo-vendors'],
      },
      { key: 'verify', label: 'To verify', href: '/admin/verify', queue: 'verify' },
      { key: 'id-documents', label: 'ID documents', href: '/admin/verification-docs' },
      { key: 'partnerships', label: 'Partnerships', href: '/admin/vendor-partnerships', queue: 'vendor-partnerships' },
      { key: 'founder-seats', label: 'Founder seats', href: '/admin/founder-seats' },
      { key: 'gifts', label: 'Gifts & comps', href: '/admin/gifts' },
    ],
    settings: [
      {
        key: 'demo-mode',
        label: 'Demo mode',
        href: '/admin/settings?tab=demo-mode',
        match: ['/admin/settings?tab=demo-mode', '/admin/settings/demo-mode'],
      },
    ],
  },
  {
    key: 'catalogue',
    label: 'Catalogue',
    icon: 'LayoutGrid',
    href: '/admin/categories',
    searchPlaceholder: 'Search categories, prices, templates',
    views: [
      { key: 'categories', label: 'Categories', href: '/admin/categories' },
      { key: 'event-types', label: 'Event types', href: '/admin/categories?list=event-types' },
      { key: 'religions', label: 'Religions', href: '/admin/categories?list=religions' },
      { key: 'hub-tools', label: 'Hub tools', href: '/admin/categories?list=hub-tools' },
      {
        key: 'service-requests',
        label: 'Service requests',
        href: '/admin/categories/requests',
        match: ['/admin/categories/requests', '/admin/categories?show=requests'],
      },
      {
        key: 'prices',
        label: 'Prices',
        href: '/admin/pricing',
        match: ['/admin/pricing', '/admin/pricing?tab=pricing', '/admin/addons'],
      },
      { key: 'ai-prices', label: 'Setnayan AI prices', href: '/admin/pricing?tab=setnayan-ai' },
      { key: 'papic-shots', label: 'Papic shot prices', href: '/admin/pricing?tab=papic-shots' },
      {
        key: 'market-bands',
        label: 'Market price bands',
        href: '/admin/pricing?tab=price-bands',
        match: ['/admin/pricing?tab=price-bands', '/admin/price-bands'],
      },
      { key: 'budget', label: 'Budget benchmarks', href: '/admin/budget-planner' },
      { key: 'recommendations', label: 'Supplier recommendations', href: '/admin/vendor-recommendations' },
      { key: 'studio', label: 'Templates, media & stories', href: '/admin/studio' },
      { key: 'website', label: 'Website', href: '/admin/studio?tab=website', match: ['/admin/studio?tab=website', '/admin/website'] },
      {
        key: 'reveal',
        label: 'Reveal Studio',
        href: '/admin/studio?tab=reveal-studio',
        match: ['/admin/studio?tab=reveal-studio', '/admin/reveal-studio'],
      },
      { key: 'patiktok', label: 'Patiktok', href: '/admin/studio?tab=patiktok', match: ['/admin/studio?tab=patiktok', '/admin/patiktok'] },
      { key: 'hub-music', label: 'Event Hub music', href: '/admin/hub-music' },
      { key: 'songs', label: 'Songs', href: '/admin/studio?tab=songs', match: ['/admin/studio?tab=songs', '/admin/songs'] },
      {
        key: 'inspiration',
        label: 'Inspiration library',
        href: '/admin/studio?tab=moodboard-library',
        match: ['/admin/studio?tab=moodboard-library', '/admin/moodboard-library'],
      },
      { key: 'front-door-videos', label: 'Front-door videos', href: '/admin/background-videos' },
      { key: 'website-media', label: 'Website media', href: '/admin/website-media' },
      { key: 'colours', label: 'Colours', href: '/admin/colours' },
      {
        key: 'real-stories',
        label: 'Real Stories',
        href: '/admin/studio?tab=real-stories',
        match: ['/admin/studio?tab=real-stories', '/admin/real-stories'],
      },
      { key: 'storytellers', label: 'Storytellers', href: '/admin/studio?tab=storytellers' },
      { key: 'recaps', label: 'Recaps', href: '/admin/studio?tab=recaps', match: ['/admin/studio?tab=recaps', '/admin/recaps'] },
      {
        key: 'spotlight-awards',
        label: 'Spotlight Awards',
        href: '/admin/studio?tab=spotlight-awards',
        match: ['/admin/studio?tab=spotlight-awards', '/admin/spotlight-awards'],
      },
      {
        key: 'journal-spotlights',
        label: 'Journal Spotlights',
        href: '/admin/studio?tab=journal-spotlights',
        match: ['/admin/studio?tab=journal-spotlights', '/admin/journal-spotlights'],
      },
      {
        key: 'social-queue',
        label: 'Social queue',
        href: '/admin/studio?tab=social-queue',
        match: ['/admin/studio?tab=social-queue', '/admin/social-queue'],
      },
    ],
    settings: [
      {
        key: 'onboarding',
        label: 'Onboarding questions',
        href: '/admin/ugat?tab=onboarding',
        match: ['/admin/ugat?tab=onboarding', '/admin/onboarding'],
      },
      {
        key: 'search',
        label: 'Search settings',
        href: '/admin/search-memory',
        match: ['/admin/search-memory', '/admin/ugat?tab=brain', '/admin/brain'],
      },
      { key: 'menus', label: 'Menus & icons', href: '/admin/ugat?tab=menus', match: ['/admin/ugat?tab=menus', '/admin/menus'] },
      { key: 'screens', label: 'Screens map', href: '/admin/ugat/map', match: ['/admin/ugat/map', '/admin/ugat?tab=screens'] },
      // The Root map shell itself (its four tabs are the rows above).
      { key: 'root-map', label: 'Root map', href: '/admin/ugat' },
      // A route handler: the press downloads the file.
      { key: 'export', label: 'Export categories (CSV)', href: '/admin/categories/export' },
    ],
  },
  {
    key: 'insights',
    label: 'Insights',
    icon: 'LineChart',
    href: '/admin/app-performance',
    searchPlaceholder: 'Search numbers, problems, reports',
    views: [
      {
        key: 'overview',
        label: 'Overview',
        href: '/admin/app-performance',
        match: ['/admin/app-performance', '/admin/app-performance?tab=overview'],
      },
      { key: 'visits', label: 'Visits', href: '/admin/app-performance?tab=visits' },
      {
        key: 'growth',
        label: 'Sign-ups & growth',
        href: '/admin/app-performance?tab=growth',
        match: ['/admin/app-performance?tab=growth', '/admin/growth'],
      },
      {
        key: 'intelligence',
        label: 'Intelligence',
        href: '/admin/app-performance?tab=intelligence',
        match: ['/admin/app-performance?tab=intelligence', '/admin/intelligence', '/admin/insights'],
      },
      { key: 'seo', label: 'SEO & GEO', href: '/admin/app-performance?tab=seo', match: ['/admin/app-performance?tab=seo', '/admin/seo'] },
      {
        key: 'funnels',
        label: 'Funnels',
        href: '/admin/app-performance?tab=funnels',
        match: ['/admin/app-performance?tab=funnels', '/admin/funnels'],
      },
      {
        key: 'problems',
        label: 'Problems',
        href: '/admin/app-performance?tab=connection-logs',
        match: ['/admin/app-performance?tab=connection-logs', '/admin/connection-logs'],
      },
      { key: 'slow-loads', label: 'Slow loads', href: '/admin/app-performance?tab=slow-loads' },
      { key: 'browser-blocks', label: 'Browser blocks', href: '/admin/app-performance?tab=browser-blocks' },
      { key: 'interconnections', label: 'Interconnections', href: '/admin/app-performance?tab=interconnections' },
      {
        key: 'offline',
        label: 'Offline daemon',
        href: '/admin/app-performance?tab=offline',
        match: ['/admin/app-performance?tab=offline', '/admin/offline'],
      },
      { key: 'demand', label: 'Demand', href: '/admin/demand' },
      {
        key: 'costs',
        label: 'Expenses & hiring',
        href: '/admin/app-performance?tab=operations',
        match: ['/admin/app-performance?tab=operations', '/admin/operations-hiring'],
      },
      { key: 'papic-storage', label: 'Papic storage', href: '/admin/papic-storage' },
      { key: 'live-watch', label: 'Live Watch channels', href: '/admin/live-studio-channels' },
      {
        key: 'privacy',
        label: 'Privacy & NPC',
        href: '/admin/data-privacy',
        match: ['/admin/data-privacy', '/admin/npc-readiness', '/admin/compliance/data-sheet'],
      },
    ],
    settings: [],
  },
] as const;

/** Admin-of-admin — under the avatar, never a tab (owner 2026-11-13). */
export const ADMIN_AVATAR_ROWS: readonly AdminAvatarRow[] = [
  // Areas × Basic/Escalated is being built in the Team slice; its page sets href.
  { key: 'team', label: 'Team & permissions', href: null, slice: 'admin-team-areas-levels' },
  // A page over admin_audit_log, built with the Team slice (who-did-it).
  { key: 'admin-log', label: 'Admin log', href: null, slice: 'admin-team-areas-levels' },
  {
    key: 'secrets',
    label: 'Secrets & integrations',
    href: '/admin/secrets',
    match: ['/admin/secrets', '/admin/integrations'],
  },
  {
    key: 'email-delivery',
    label: 'Email delivery',
    href: '/admin/settings?tab=notifications',
    match: ['/admin/settings?tab=notifications', '/admin/notifications'],
  },
  {
    key: 'switches',
    label: 'Switches',
    href: '/admin/settings?tab=settings',
    match: ['/admin/settings', '/admin/settings?tab=settings'],
  },
  {
    key: 'business',
    label: 'Business & compliance',
    href: '/admin/settings?tab=compliance',
    match: ['/admin/settings?tab=compliance', '/admin/compliance'],
  },
];

// ─── the matcher ─────────────────────────────────────────────────────────

/** Minimal read-only surface of URLSearchParams. */
export type AdminParams = { get(key: string): string | null };

export type AdminPlace =
  | { kind: 'tab'; tab: AdminTab; view: AdminView; isSetting: boolean }
  | { kind: 'avatar'; row: AdminAvatarRow };

/** How strongly `pattern` claims `pathname`+`params`; 0 = no claim.
 *  A query claim needs an exact path; a bare path claims itself and below. */
export function claimScore(pattern: string, pathname: string, params?: AdminParams | null): number {
  if (pattern.endsWith('$')) {
    return pathname === pattern.slice(0, -1) ? 1_000 + pattern.length : 0;
  }
  const q = pattern.indexOf('?');
  if (q !== -1) {
    const path = pattern.slice(0, q);
    if (pathname !== path) return 0;
    const want = new URLSearchParams(pattern.slice(q + 1));
    let n = 0;
    for (const [k, v] of want.entries()) {
      if ((params?.get(k) ?? null) !== v) return 0;
      n += 1;
    }
    return 10_000 * n + path.length;
  }
  if (pathname === pattern) return 1_000 + pattern.length;
  if (pathname.startsWith(pattern + '/')) return pattern.length;
  return 0;
}

/** Every claim, in one flat list — the tests read this too. */
export function allAdminClaims(): { pattern: string; place: AdminPlace }[] {
  const out: { pattern: string; place: AdminPlace }[] = [];
  for (const tab of ADMIN_TABS) {
    for (const [list, isSetting] of [
      [tab.views, false],
      [tab.settings, true],
    ] as const) {
      for (const view of list) {
        for (const pattern of view.match ?? [view.href]) {
          out.push({ pattern, place: { kind: 'tab', tab, view, isSetting } });
        }
      }
    }
  }
  for (const row of ADMIN_AVATAR_ROWS) {
    for (const pattern of row.match ?? (row.href ? [row.href] : [])) {
      out.push({ pattern, place: { kind: 'avatar', row } });
    }
  }
  return out;
}

/** Where `pathname` lives: the most specific claim wins. `null` = no home,
 *  which for an `/admin` address is a bug the route guard catches. */
export function adminPlaceFor(pathname: string, params?: AdminParams | null): AdminPlace | null {
  let best: AdminPlace | null = null;
  let bestScore = 0;
  for (const { pattern, place } of allAdminClaims()) {
    const s = claimScore(pattern, pathname, params);
    if (s > bestScore) {
      best = place;
      bestScore = s;
    }
  }
  return best;
}

/** The tab to light in the bar; avatar pages and strangers light none. */
export function activeAdminTabKey(pathname: string, params?: AdminParams | null): AdminTabKey | null {
  const place = adminPlaceFor(pathname, params);
  return place?.kind === 'tab' ? place.tab.key : null;
}

export function adminTab(key: AdminTabKey): AdminTab {
  const tab = ADMIN_TABS.find((t) => t.key === key);
  if (!tab) throw new Error(`unknown admin tab ${key}`);
  return tab;
}
