/**
 * page-home.ts — THE ONE "PAGE → ITS HOME" MAP. Where every page's back link goes, or that it draws none.
 *
 * Owner, 28 Oct 2026 (DECISION_LOG "EVERY PAGE GOES BACK TO THE RIGHT HOME AND FOLLOWS THE DESIGN RULES"),
 * verbatim: *"so many of the pages has or might have wrong back links. it should be fixed. some also does
 * not need back links."* · *"the goal of fixing all design rules is that when we decide to change its look
 * to make the app feel new everytime, we want everything mapped and following rules and templates"*.
 *
 * 🔑 WHY THIS EXISTS. The audit (`audits/back_links_design_rules_2026-10-28/` in the corpus) found 25 wrong
 * back links and 11 sideways ones, and one root cause: there was no CURRENT list of where each page lives.
 * `lib/nav-registry-defaults.ts` (June) names menu SLOTS, not pages' homes, and is superseded here for that
 * question — it is left in place for what it does do (the admin /admin/menus label + icon overrides). The
 * Ugat screens map counts an old page as fine while anything still links to it — which is exactly how the
 * Groups page kept sending people to the retired `/dashboard/samahan`. So: one map, read by `BackButton`
 * itself (`<BackButton route="/dashboard/[eventId]/story" params={{ eventId }} />`), held by
 * `lib/every-back-goes-home.test.ts` against every page on disk and against today's bars.
 *
 * ── HOW A ROUTE FINDS ITS HOME ─────────────────────────────────────────────────────────────────────────
 * Routes are Next route PATTERNS as written on disk (`/dashboard/[eventId]/guests/new`, route groups
 * dropped). In order:
 *   1. a BAR ROOT draws no back — the bar IS its way around (`BAR_ROOTS`, held equal to the shipped bars);
 *   2. an EXACT entry in `HOMES`;
 *   3. the most specific PATTERN entry in `HOMES` (`/x/*` = one more segment, `/x/**` = any depth);
 *   4. a one-time `[token]` page draws no back (a link that works once has nowhere to go back to);
 *   5. otherwise the page it sits under — its URL parent.
 * The guard proves every page on disk lands on a real, live page (never a redirect stub, never a retired
 * page) or on an honest "no back".
 *
 * ── THE BARS (today's, 28 Oct 2026) ────────────────────────────────────────────────────────────────────
 *   account  Home `/dashboard` · Discover `/` (owner 11 Nov 2026, "HOME IS THE PROFILE" — Events · People · Shop ·
 *            Memories are Home's sections, `/dashboard?seg=…`; the old `/dashboard/library|people` forward there)
 *            (`app/dashboard/(launcher)/_components/account-bottom-nav.tsx`)
 *   event    Home · Guests · Suppliers · Hub · Memories (`lib/customer-menu.ts` `buildEventMenuSections`)
 *   supplier Today · Clients · Shop · Portfolio (`app/vendor-dashboard/_components/vendor-nav-destinations.ts`, THE ONE BUILD 8 Nov)
 *   admin    Today · People · Money · More (`app/admin/_components/admin-bottom-nav.tsx`)
 *
 * Pure and dependency-free: a server page, a client component and the guard all ask the same function.
 */

export type NoBackReason =
  /** A tab of a bar — the bar is the way around. */
  | 'bar-root'
  /** A one-time / one-link token page: a link that works once has nowhere to go back to. */
  | 'token'
  /** A full-screen flow that carries its own exit ✕ (a broadcast output, a wall display). */
  | 'own-exit'
  /** A developer lab (`/dev/*`) — production 404s it. */
  | 'lab'
  /** The page works its back out per visit (who sent you here) in a named module — never a fixed home. */
  | 'computed';

export type PageHome =
  | { kind: 'home'; home: string; label: string }
  | { kind: 'none'; reason: NoBackReason; by?: string };

type Entry = { home: string; label?: string } | { none: NoBackReason; by?: string };

/** Every tab of every bar. No back on any of them. Held equal to the shipped bars by the guard. */
export const BAR_ROOTS = {
  account: ['/', '/dashboard'],
  event: [
    '/dashboard/[eventId]',
    '/dashboard/[eventId]/guests',
    '/dashboard/[eventId]/vendors',
    '/dashboard/[eventId]/memories',
    '/dashboard/[eventId]/launch',
  ],
  supplier: [
    '/vendor-dashboard',
    '/vendor-dashboard/customers',
    '/vendor-dashboard/shop',
    '/vendor-dashboard/collections',
  ],
  admin: ['/admin', '/admin/directory', '/admin/money', '/admin/more'],
} as const;

const ROOTS = new Set<string>(Object.values(BAR_ROOTS).flat());

/** A home's own name, for a back link that is not given one. */
const LABELS: Record<string, string> = {
  '/': 'Discover',
  '/dashboard': 'Home',
  '/dashboard?hub=1': 'Home',
  '/dashboard?seg=memories': 'Memories',
  '/dashboard?seg=people': 'People',
  '/dashboard?seg=people&view=samahan': 'Groups',
  '/dashboard?seg=people&view=alaga': 'Loved ones',
  '/dashboard/profile': 'Settings',
  '/dashboard/create-event': 'New event',
  '/dashboard/[eventId]': 'Today',
  '/dashboard/[eventId]/guests': 'Guests',
  '/dashboard/[eventId]/vendors': 'Suppliers',
  '/dashboard/[eventId]/launch': 'Hub',
  '/dashboard/[eventId]/memories': 'Memories',
  '/dashboard/[eventId]/galleries': 'Memories',
  '/[slug]': 'Event Hub',
  '/vendor-dashboard': 'Today',
  '/vendor-dashboard/customers': 'Clients',
  '/vendor-dashboard/shop': 'Shop',
  '/vendor-dashboard/collections': 'Portfolio',
  // The supplier's Hub room is no tab any more (THE ONE BUILD) — its own heading's word ("Hub", never the couple's
  // "Event Hub" — owner 2026-11-05), for the live console's ‹.
  '/vendor-dashboard/on-the-day': 'Hub',
  '/admin': 'Today',
  '/admin/more': 'All surfaces',
  '/admin/ugat': 'Root map',
  '/explore': 'Suppliers',
  '/login': 'Sign in',
};

const E = '/dashboard/[eventId]';
const ADMIN_ACCOUNTS = (tab: string) => `/admin/accounts?tab=${tab}`;
/** `customerLandingHref` (app/vendor-dashboard/customers/anchors.ts) — the folds the old supplier rooms became. */
const CUSTOMERS_CONTRACTS = '/vendor-dashboard/customers?seg=money&open=contracts#customer-tools';

/**
 * The homes that are NOT simply the URL parent. Every line is a decision; the 28 Oct audit rows it settles
 * are named. A page missing here falls back to rule 4 / 5 above.
 */
export const HOMES: Readonly<Record<string, Entry>> = {
  // Compare's home is Discover's supplier view since /explore folded into Discover (2026-11-12, DECISION_LOG
  // "DISCOVER WITH SUPPLIERS — PROTOTYPE APPROVED"): its old parent `/explore` now only redirects.
  '/explore/compare': { home: '/?browse=1', label: 'Suppliers' },
  /* ── account ─────────────────────────────────────────────────────────────────────────────────────── */
  // Settings is where API keys are opened (audit ✅ "looked odd but fine").
  '/dashboard/api-keys': { home: '/dashboard/profile' },
  // Groups live in People since the People & Groups merge — `/dashboard/samahan` is the retired index.
  '/dashboard/samahan': { home: '/dashboard?seg=people&view=samahan' },
  '/dashboard/samahan/**': { home: '/dashboard?seg=people&view=samahan' },
  // 🏠 An alaga's page belongs to Home › People › Loved ones (its URL parent only forwards there).
  '/dashboard/people/[dependentId]': { home: '/dashboard?seg=people&view=alaga' },
  // A person's public profile is opened from People (`app/u/_components/profile-back.tsx`).
  '/u/[userSlug]': { home: '/dashboard?seg=people' },
  '/u/[userSlug]/c/[chapterId]': { home: '/u/[userSlug]', label: 'Profile' },
  // The claim link is made and shared from People; the issuer who opens it lands back there (audit ⚠, kept).
  '/claim/[token]': { home: '/dashboard?seg=people' },

  /* ── sign in ──────────────────────────────────────────────────────────────────────────────────────── */
  // A password reset belongs to signing in (audit ✅).
  '/forgot-password': { home: '/login' },
  '/reset-password': { home: '/login' },
  // Its docblock: signing in is the step that un-sticks a stalled claim (audit ⚠, kept).
  '/vendor/claim/[token]/finalize': { home: '/login' },

  /* ── first run ────────────────────────────────────────────────────────────────────────────────────── */
  // The create-event picker opens each onboarding (`event_type_vocab.onboarding_href`) (audit ⚠, kept).
  '/onboarding/simple': { home: '/dashboard/create-event' },
  '/onboarding/[type]': { home: '/dashboard/create-event' },
  // The wedding flow's "you already have a wedding" screen leaves to the Events tab — the account bar's own
  // Events href (audit ⚠, kept).
  '/onboarding/wedding': { home: '/dashboard?hub=1' },

  /* ── an event (the couple) ────────────────────────────────────────────────────────────────────────── */
  // HOME holds every service page since More left the bar (`customer-menu.ts`: Home `alsoMatch` /studio).
  [`${E}/studio/*`]: { home: E },
  [`${E}/studio/papic/*`]: { home: E },
  [`${E}/studio/panood/*`]: { home: E },
  [`${E}/studio/about/[addon]`]: { home: E },
  // The after-day Papic recap belongs with the event's photos (audit ⚠, kept).
  [`${E}/studio/papic/recap`]: { home: `${E}/memories` },
  // Its doorway is Galleries (2026-09-30), which the Memories tab lights (audit ⚠, kept).
  [`${E}/studio/photo-delivery`]: { home: `${E}/galleries` },
  // HUB holds the old /website family and Post Event (`customer-menu.ts`: Hub `matchPrefix` /website,
  // `alsoMatch` /story). `/website` itself is a redirect to the Hub (audit ❌ ×4, fixed).
  [`${E}/website/*`]: { home: `${E}/launch` },
  [`${E}/story`]: { home: `${E}/launch` },
  [`${E}/studio/guest-columns`]: { home: `${E}/launch` },
  // The living hero is opened from the hero photo page — its real door (audit ⚠, kept).
  [`${E}/website/living-hero`]: { home: `${E}/website/hero-photo`, label: 'Hero photo' },
  // SUPPLIERS lights every /vendors page; `/vendors/[vendorId]` is a redirect stub.
  [`${E}/vendors/[vendorId]/*`]: { home: `${E}/vendors` },
  [`${E}/vendors/packages/[bookingId]`]: { home: `${E}/vendors` },
  [`${E}/details/field/[row]`]: { home: `${E}/details`, label: 'Event details' },
  // 🗂 R4 (owner 2026-10-27/28, "GUESTS = LIST · MAP · SEATS · MARCH"): the seat plan is Guests › Seats — `/seating`
  // forwards there, so its pages (the entrance chart, the walkthrough videos, the 3D room's own page) go back to it.
  [`${E}/seating/*`]: { home: `${E}/guests?gview=seats`, label: 'Seats' },

  /* ── a guest of an event — back to THAT event's hub, never the marketing front page ─────────────── */
  '/[slug]/**': { home: '/[slug]' },
  '/papic/guest': { home: '/[slug]' },
  '/papic/decorate': { home: '/[slug]' },
  '/join/[eventId]': { home: '/[slug]' },
  '/join/[eventId]/connect/confirm': { home: '/join/[eventId]', label: 'Join' },
  // Everyone's photos is opened from the guest's own camera page (audit ⚠, kept).
  '/papic/pool': { home: '/papic/me/[token]', label: 'My photos' },

  /* ── public ──────────────────────────────────────────────────────────────────────────────────────── */
  // A supplier's shop page goes back to WHERE THE VISIT CAME FROM — Discover, the marketplace, an event's Suppliers, a
  // saved supplier — read from the arrival (`?src=` / a checked `?event=`). Was a fixed `/explore` (the 28 Oct audit ❌
  // "goes to the front page" fixed one arrival and broke the rest — owner 2026-11-07: "back to suppliers? it went to a
  // wrong shell"). With no arrival it says "See more suppliers" → /explore, never "Back".
  '/v/[slug]': { none: 'computed', by: 'lib/shop-back.ts' },
  '/suppliers/[event]/[category]': { home: '/suppliers' },
  '/tl/*': { home: '/' },
  // The API reference is read by whoever holds a key, made in Settings › API keys.
  '/api/v1': { home: '/dashboard/api-keys', label: 'API keys' },
  // Each works out its back per visit — who sent you (`lib/pay-back-link.ts`, `lib/proposal-back.ts`).
  '/pay/[reference]': { none: 'computed', by: 'lib/pay-back-link.ts' },
  '/proposals/[publicId]': { none: 'computed', by: 'lib/proposal-back.ts' },
  // 💬 An event group chat is opened by a host, the coordinator, a guest and a supplier alike — its ‹ goes to THAT
  // person's Chats (or a guest's events), worked out per visit (`groupChatBack`); "+ New group" back to the event's Chats.
  '/samahan/chat/[threadId]': { none: 'computed', by: 'lib/chat-groups.ts' },
  '/samahan/chat/new': { none: 'computed', by: 'lib/chat-groups.ts' },
  // One-link pages sent by email or QR — nothing behind them.
  '/receipts/[receiptId]': { none: 'token' },
  '/receipts/order/[orderId]': { none: 'token' },
  '/vendor-invite/[slug]': { none: 'token' },
  '/vendor/fit/[ref]': { none: 'token' },
  '/demo-capture/[slug]': { none: 'token' },
  // Full-screen outputs with their own exit.
  '/panood/control/[eventId]': { none: 'own-exit' },
  '/panood/program/[eventId]': { none: 'own-exit' },
  '/wall/[eventId]': { none: 'own-exit' },
  '/dev/**': { none: 'lab' },
  // A sample guest's Hub is opened from the sample event's own page (owner 2026-11-02, the sample event).
  '/sample/hub/[guestKey]': { home: '/sample', label: 'The sample' },

  /* ── the supplier ────────────────────────────────────────────────────────────────────────────────── */
  // A booking fee is paid from the plan page (audit ✅).
  '/vendor-dashboard/booking-fees': { home: '/vendor-dashboard/subscription', label: 'Plan' },
  // Clients and Messages became folds of Customers; both old rooms are redirect stubs (audit ❌ ×2, fixed).
  '/vendor-dashboard/clients/[eventId]': { home: '/vendor-dashboard/customers' },
  // A supplier's chat is ONE EVENT's chat. ‹ returns IN PLACE to whichever list opened it (Chats or Customers › Events —
  // `ReturnInPlace`, chat-back.tsx); a deep link with nothing behind it goes to Chats, the supplier's full-screen inbox
  // (owner 2026-11-06: "Why is it still jumping to customer events"). `/vendor-dashboard/messages` itself needs no line:
  // its URL parent is Today.
  '/vendor-dashboard/messages/[threadId]': { home: '/vendor-dashboard/messages', label: 'Chats' },
  '/vendor-dashboard/contracts/*': { home: CUSTOMERS_CONTRACTS, label: 'Contracts' },
  '/vendor-dashboard/calendar/[date]': { home: '/vendor-dashboard/customers?seg=dates', label: 'Dates' },
  // `/services` is a redirect into the Shop (audit ⚠, kept).
  '/vendor-dashboard/services/*': { home: '/vendor-dashboard/shop' },
  '/vendor-dashboard/on-the-day/live/[eventId]': { home: '/vendor-dashboard/on-the-day' },
  // THE ONE BUILD (8 Nov 2026): the Event Hub room left the bar — it lives under a picked client, so ‹ goes to Clients;
  // the inspiration library is Portfolio's (spec A1 F-registry: it lights Portfolio, so ‹ goes there too).
  '/vendor-dashboard/on-the-day': { home: '/vendor-dashboard/customers' },
  '/vendor-dashboard/moodboard-library': { home: '/vendor-dashboard/collections' },

  /* ── admin ───────────────────────────────────────────────────────────────────────────────────────── */
  // Both sit in the Root map menu (`admin-nav-groups.tsx` key `ugat`, hub `/admin/ugat`) (audit ❌ ×2).
  '/admin/integrations': { home: '/admin/ugat' },
  '/admin/secrets': { home: '/admin/ugat' },
  // The old lists are tabs now; their routes are redirect stubs (audit ✅ for the first three).
  '/admin/compliance/data-sheet': { home: '/admin/settings?tab=compliance', label: 'Compliance' },
  '/admin/events/[eventId]': { home: ADMIN_ACCOUNTS('events'), label: 'Events' },
  '/admin/vendors/[vendorProfileId]': { home: ADMIN_ACCOUNTS('vendors'), label: 'Shops' },
  '/admin/users/[userId]': { home: ADMIN_ACCOUNTS('users'), label: 'Users' },
  '/admin/venues/*': { home: ADMIN_ACCOUNTS('venues'), label: 'Venues' },
  '/admin/demo-vendors/inquiries': { home: ADMIN_ACCOUNTS('demo-vendors'), label: 'Demo shops' },
  '/admin/discount-codes/**': { home: '/admin/studio?tab=discount-codes', label: 'Discount codes' },
};

/**
 * Pages whose back link points at THEMSELVES on purpose: an in-page step back from a sub-view to the list,
 * same URL, client state (the press is `preventDefault`-ed; the href is the no-JS fallback).
 */
export const IN_PAGE_BACKS: Readonly<Record<string, string>> = {
  '/dashboard/profile':
    'Phone Settings: "‹ Settings" closes the open group and shows the list again (settings-shell.tsx)',
};

/**
 * Pages that still render but that today's menus no longer use — never a home. (Redirect stubs are found by
 * the guard itself; these are the ones that still draw a page.)
 */
export const RETIRED_PAGES: Readonly<Record<string, string>> = {
  '/dashboard/samahan': 'Groups moved into People (Home › People › Groups, `/dashboard?seg=people&view=samahan`)',
};

const segs = (p: string) => p.split('/').filter(Boolean);

/** How well a `HOMES` key matches a route: -1 = no match, higher = more specific. */
function matchScore(key: string, route: string): number {
  if (key === route) return 10_000;
  const k = segs(key);
  const r = segs(route);
  const last = k[k.length - 1];
  if (last !== '*' && last !== '**') return -1;
  const base = k.slice(0, -1);
  if (last === '*' ? r.length !== base.length + 1 : r.length <= base.length) return -1;
  for (let i = 0; i < base.length; i += 1) if (base[i] !== r[i]) return -1;
  return base.length * 10 + (last === '*' ? 1 : 0);
}

function toHome(e: Entry): PageHome {
  if ('none' in e) return { kind: 'none', reason: e.none, ...(e.by ? { by: e.by } : {}) };
  return { kind: 'home', home: e.home, label: e.label ?? LABELS[e.home] ?? 'Back' };
}

/** The URL parent of a route pattern (`/a/b` → `/a`, `/a` → `/`). */
export function parentRoute(route: string): string {
  const s = segs(route);
  return s.length <= 1 ? '/' : `/${s.slice(0, -1).join('/')}`;
}

/** Where a page's back link goes — or why it draws none. */
export function pageHome(route: string): PageHome {
  if (ROOTS.has(route)) return { kind: 'none', reason: 'bar-root' };
  let best: Entry | null = null;
  let bestScore = -1;
  for (const [key, entry] of Object.entries(HOMES)) {
    const s = matchScore(key, route);
    if (s > bestScore) {
      bestScore = s;
      best = entry;
    }
  }
  if (best) return toHome(best);
  if (segs(route).at(-1) === '[token]') return { kind: 'none', reason: 'token' };
  const parent = parentRoute(route);
  return { kind: 'home', home: parent, label: LABELS[parent] ?? 'Back' };
}

/**
 * A home pattern with its `[params]` filled in. Throws on a missing param — a back link that cannot be
 * built is a bug in the page, never a link to `/undefined`.
 */
export function fillRoute(pattern: string, params: Readonly<Record<string, string>> = {}): string {
  return pattern.replace(/\[([^\]]+)\]/g, (_, name: string) => {
    const v = params[name];
    if (v === undefined || v === '') throw new Error(`page-home: no value for [${name}] in ${pattern}`);
    return encodeURIComponent(v);
  });
}

/** The back link's href and label for a page, or null where the map says it draws none. */
export function pageBackLink(
  route: string,
  params: Readonly<Record<string, string>> = {},
): { href: string; label: string } | null {
  const h = pageHome(route);
  if (h.kind === 'none') return null;
  return { href: fillRoute(h.home, params), label: h.label };
}
