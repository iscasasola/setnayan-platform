/**
 * THE STORE SHELL — the one native surface Apple and Google review.
 *
 * Setnayan ships the same Next.js site through three wrappers, and only ONE of
 * them is subject to App Store Guideline 3.1.1 / Play Billing:
 *
 *   · Capacitor (iOS / Android)  → installed FROM the App Store / Play Store.
 *                                   Paid digital features must be purchasable
 *                                   via IAP, or must not be reachable at all.
 *   · Tauri (macOS / Windows)    → a direct-download .dmg / .msi. NOT sold
 *                                   through the Mac App Store; no IAP rule.
 *   · the web / PWA              → no rule.
 *
 * App Review, 2026-06-30 (submission 7f67da83), rejected build 1.0 (1) under
 * 3.1.1 AFTER the in-app checkout had already been hidden on native (PR
 * #2180, 2026-06-25): "the app accesses digital content purchased outside the
 * app … but that content isn't available to purchase using In-App Purchase."
 * That is guideline 3.1.3(b) — hiding the BUY button is not enough while the
 * bought feature still works in the app. Owner decision 2026-09-05: until
 * Apple IAP ships (v1.1, DECISION_LOG 2026-06-25), the store shell is
 * planning + guests + real-world supplier bookings ONLY; the paid digital
 * features are web/desktop-only and the store shell never shows them.
 *
 * 🔑 WHY THIS IS NOT `isCapacitorClient` / `getRequestPlatform`. Both of those
 * match ANY `SetnayanApp` user-agent — and the desktop Tauri build appends
 * `SetnayanApp/desktop` (src-tauri/tauri.conf.json). `getRequestPlatform()`
 * even answers 'ios' for it. Gating on either would darken Papic and Live
 * Studio on a macOS .dmg that Apple never reviews. The Capacitor shell appends
 * the bare marker `SetnayanApp` (apps/mobile/capacitor.config.ts
 * `appendUserAgent`) and sets the `setnayan-client-type=capacitor` cookie; the
 * desktop shell sets `tauri`. Those are the two signals this module reads.
 *
 * Pure by design — no `next/headers` here — so middleware (edge) and unit
 * tests can both import it. The request-scoped wrapper is
 * `isStoreShellRequest()` in lib/request-platform.ts.
 */

import { asksForMoreServices } from './studio-hub';

const CLIENT_TYPE_COOKIE = 'setnayan-client-type';

/**
 * True only for the Capacitor (App Store / Play Store) shell.
 *
 *   · `setnayan-client-type=capacitor` cookie → store shell.
 *   · `setnayan-client-type=tauri` cookie      → desktop, NOT store shell,
 *     even if the UA carries the marker.
 *   · UA `SetnayanApp/desktop`                 → desktop, NOT store shell.
 *   · UA bare `SetnayanApp` (no `/desktop`)    → store shell. This is also what
 *     a pre-2026-06 Tauri build sends; erring towards HIDING on an unknown
 *     shell is the safe direction for a store-review rule.
 */
export function isStoreShellSignals(
  userAgent: string | null | undefined,
  clientType: string | null | undefined,
): boolean {
  const ua = userAgent ?? '';
  const ct = clientType ?? '';
  if (ct === 'capacitor') return true;
  if (ct === 'tauri') return false;
  if (/SetnayanApp\/desktop/i.test(ua)) return false;
  return /SetnayanApp/i.test(ua);
}

/** The cookie name, exported so the middleware and the server wrapper read the same key. */
export const STORE_SHELL_CLIENT_TYPE_COOKIE = CLIENT_TYPE_COOKIE;

/**
 * The same question asked from inside the browser (client components), where
 * there is no request object — only `navigator.userAgent` and
 * `document.cookie`. Pure so it can be tested; `useIsStoreShell()` in
 * lib/use-store-shell.ts is the hook that feeds it.
 *
 * 🔑 NOT `/SetnayanApp/i.test(navigator.userAgent)`. That spelling — which the
 * inline checkout drawer used until 2026-09-24 — also matches the desktop
 * `SetnayanApp/desktop` UA, so the .dmg / .msi got an inert, price-less "buy"
 * chip on a surface Apple never reviews.
 */
export function isStoreShellInBrowser(
  userAgent: string | null | undefined,
  cookieString: string | null | undefined,
): boolean {
  let clientType = '';
  for (const part of (cookieString ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== CLIENT_TYPE_COOKIE) continue;
    clientType = part.slice(eq + 1).trim();
    break;
  }
  return isStoreShellSignals(userAgent, clientType);
}

/**
 * Studio add-on keys (lib/add-ons-catalog.ts `key`) that the store shell must
 * not show: every PAID entry, plus every entry that carries a `serviceKey`
 * (a free-looking tile whose page sells an upgrade — Animated Monogram, the
 * Live Studio behind `panood`). `lib/store-shell.test.ts` derives this rule
 * from the catalog itself, so a new paid add-on cannot ship visible in the
 * store shell without failing that test.
 *
 * NOT here, deliberately: the free planning tools whose pages merely EMBED
 * the checkout drawer (Save the Date · Indoor Blueprint · Seating · Mood
 * Board). The drawer is already an inert, price-less chip on native
 * (inline-checkout-drawer.tsx, PR #2180); the free part of those tools is the
 * planning surface the store shell exists for.
 */
export const STORE_SHELL_HIDDEN_ADDON_KEYS: ReadonlySet<string> = new Set([
  'setnayan-ai',
  'website-pro',
  'pakanta',
  'animated-monogram',
  'papic',
  'papic-guest',
  'panood',
  'patiktok',
  'thank-you',
  'supplies-marketplace',
  // Live Studio. Joins ADD_ONS only while NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED
  // is on, so a test that derived this set from ADD_ONS alone passed with the
  // flag off and let the tile through the day the owner flipped it. The test
  // now derives from EVERY_ADD_ON (flag-independent).
  'live-studio-roam',
]);

/**
 * Studio routes that are the HOME of a paid digital feature — reachable by
 * deep link, bookmark, notification or the dashboard's own tiles even when
 * the hub hides the tile. On the store shell, middleware sends them to
 * `/web-only`. Keys are matched as `/dashboard/<eventId>/studio/<segment>`.
 *
 * Derived from STORE_SHELL_HIDDEN_ADDON_KEYS plus the two feature pages whose
 * URL segment differs from its catalog key (`live-studio-control` is where
 * `panood` redirects; the Papic detail lives at `papic`).
 */
export const STORE_SHELL_WEB_ONLY_STUDIO_SEGMENTS: ReadonlySet<string> = new Set([
  ...STORE_SHELL_HIDDEN_ADDON_KEYS,
  'live-studio-control',
  'editorial-pro',
]);

/**
 * Non-Studio routes that exist only to take money for a digital SKU.
 *   · /dashboard/<eventId>/orders/<anything> — the add-on order form
 *     (`orders/new`) AND every order's detail page, which is a pay-now screen
 *     (amount, QR, "log your payment"). Every couple order is a Setnayan
 *     digital SKU: supplier bookings are not paid through `orders` (the
 *     workspace checkout arm was deleted 2026-07-26), and a booking fee is the
 *     SUPPLIER's order, paid at /vendor-dashboard/booking-fees → /pay. The
 *     ledger itself (`/orders`, no trailing segment) stays open and hides its
 *     own buy button and row links — see app/dashboard/[eventId]/orders/page.tsx.
 *   · /dashboard/<eventId>/checkout    — the checkout action surface
 *   · /papic/order/<token>             — the guest-side camera buy sheet
 *   · /vendor-dashboard/deep-search    — a paid web-research run (₱ per search)
 *
 * NOT here: `/pay/<reference>`. It is the ONE payment page for every order,
 * including a supplier's booking fee — a real-world service the store shell
 * may pay (3.1.3(e)). The page refuses per order with
 * `storeShellRefusesPayable` below, because the path alone cannot tell a fee
 * from a Papic top-up.
 */
const WEB_ONLY_PURCHASE_ROUTE =
  /^\/(?:dashboard\/[^/]+\/(?:orders\/[^/]+|checkout)|papic\/order|vendor-dashboard\/deep-search)(?:\/|$)/;

/**
 * 📣 THE DOORWAYS — public marketing pages whose whole subject is a paid
 * digital feature (they quote prices, link to /pricing, or offer "Add to an
 * event"). The native-app brochure bounce (`APP_EXCLUDED_MARKETING_PATHS` in
 * middleware) only lists the generic brochure; these were reachable in the
 * store shell by deep link, share sheet or search. Exact paths, never
 * prefixes: `/papic/guest`, `/papic/seat/*` and `/panood/cam/*` are the GUEST
 * and helper side of an event and must stay open.
 */
export const STORE_SHELL_WEB_ONLY_DOORWAYS: ReadonlySet<string> = new Set([
  '/pricing',
  // The pricing questionnaire (2026-10-25) — its result quotes our prices from the catalogue, like /pricing.
  '/pricing/plan',
  '/alaala',
  '/papic',
  '/papic/try',
  '/panood',
  '/pakanta',
  '/patiktok',
  '/pawebsite',
  '/palogo',
  '/pa3d',
  '/pa3d/try',
  '/setnayan-ai',
  // The supplier-recruitment marketing page — its whole subject is the vendor
  // subscription tiers (Solo/Pro/Enterprise), priced live from
  // getVendorPrices()/vendor_billing_catalog and quoted in its own metadata.
  // Reachable from the ☰ drawer's footer ("For suppliers") on every surface
  // this app shell wraps (2026-09-25 audit). Distinct from
  // `/dashboard/[eventId]/vendors` (a couple's marketplace shortlist — no
  // prices of its own) and `/vendor-dashboard/subscription` (already refused
  // by WEB_ONLY_FEATURE_ROUTE below) — this is the public price ladder.
  // (Moved from /vendors 2026-09-30. No link may name the old address —
  // `lib/the-supplier-page-lives-at-for-suppliers.test.ts` — so it needs no
  // entry of its own here.)
  '/for-suppliers',
  // The Tagalog /features hub. Every feature row carries its live price
  // ("Free · upgrades from ₱…", "₱2,500"). The English hub is bounced by the
  // native brochure rule in middleware (`APP_EXCLUDED_MARKETING_PATHS`), which
  // never listed its twin — so /tl/features painted the price list in the app.
  '/tl/features',
]);

/**
 * 📣 THE FEATURE PAGES THAT SELL — `/features/<slug>` and its Tagalog twin
 * `/tl/features/<slug>` for every feature whose price is NOT `free` (a `paid`
 * feature, or a `free-plus` one whose page quotes the upgrade's price and
 * walks through "Unlock …"). Sweep 2026-10-19 row A1: the store shell showed
 * "PRICE ₱2,500 · Unlock Live Watch" and "upgrades from ₱70" because the
 * doorway list above held the product pages but not the per-feature set
 * that replaced them (DECISION_LOG 2026-10-01). Same rule as the product
 * pages: `/pawebsite`, `/palogo`, `/papic`, `/patiktok` are already doorways,
 * and these are their feature pages.
 *
 * 🔑 A HAND LIST, HELD BY ENUMERATION. Middleware runs at the edge and must not
 * import the feature registry (every word of every page, in two languages), so
 * the slugs are spelled here — and `lib/store-shell.test.ts` walks
 * `FEATURE_PAGES` itself: a slug priced anything but `free` that is missing
 * here fails, and so does a `free` slug listed here (the free planning pages
 * stay open in the app).
 */
export const STORE_SHELL_WEB_ONLY_FEATURE_SLUGS: ReadonlySet<string> = new Set([
  // ('mood-board' left 2026-10-26: its only paid part, the render pack, was retired — the page is plain free now.)
  'setnayan-ai',
  'event-hub',
  'prints',
  'logo-maker',
  'music-maker',
  'papic',
  'live-watch',
  'patiktok',
]);

const FEATURE_PAGE_ROUTE = /^\/(?:tl\/)?features\/([^/]+)$/;

/**
 * 🔑 PAID FEATURES WHOSE HOME IS NOT UNDER /studio. The first version of this
 * gate was a path allowlist over `/studio/*` alone, and its test only grepped
 * `page.tsx` files for `InlineCheckoutDrawer` — so it could not see a paid
 * feature living anywhere else. An audit on 2026-09-06 found eight such
 * surfaces still reachable in the store shell. These are the ones whose whole
 * page IS the paid thing, so the route is refused outright:
 *
 *   · /vendor-dashboard/subscription — a digital subscription, sold in-app at a
 *     1.5× "mobile SRP" beside a banner that linked OUT to the web to pay. That
 *     banner is the clearest 3.1.1 violation in the tree; it is deleted in the
 *     same change, and DECISION_LOG 2026-06-11 already locked vendor billing as
 *     web-only, which this route was quietly contradicting.
 *   · /dashboard/<eventId>/live — the Live Venue Photo Wall. Bought on the web,
 *     it WORKED in the app: that is guideline 3.1.3(b) verbatim, and it is the
 *     exact reasoning App Review used on 2026-06-30. Access to web-bought
 *     content is only allowed when the same content is ALSO purchasable by IAP.
 *
 * A feature that is merely UPSOLD on an otherwise-free page is NOT here — the
 * page stays reachable and the price-bearing component hides itself. Splitting
 * it this way keeps the free planning tools whole, which is the entire point of
 * shipping a store shell at all.
 */
const WEB_ONLY_FEATURE_ROUTE =
  /^\/(?:vendor-dashboard\/subscription|dashboard\/[^/]+\/(?:live|alaala)|panood\/(?:control|program))(?:\/|$)/;
// ↑ `/dashboard/<eventId>/alaala` (2026-10-21) — the "Memories" story page: every stage on it is a
//   chip for a paid add-on (Live Watch · Papic · Music Maker…), "free with Papic", and an "Add to
//   your Memories" link to the More menu. Nothing links to it; a deep link in the app lands on
//   /web-only like its public twin `/alaala` (a doorway above).
// ↑ `/panood/control/<eventId>` and `/panood/program/<eventId>` are the Live
//   Studio control room and its program output — the paid unlock's working
//   surface (added 2026-09-24). `/panood/cam/<token>` is a helper's camera join
//   and stays open, like the guest side of Papic.

const STUDIO_ROUTE = /^\/dashboard\/[^/]+\/studio\/([^/]+)(?:\/([^/]+))?(?:\/|$)/;

/** Where the store shell lands when it reaches a web-only route. */
export const STORE_SHELL_WEB_ONLY_PATH = '/web-only';

/**
 * 🍎 OPENED BY IN-APP PURCHASE (version 1.1) — the control pages of the two
 * services Apple sells in the app, and ONLY where Apple can sell
 * (`iapAvailable` in lib/iap/iap-gate.ts: the store shell, a build carrying
 * the StoreKit plugin, the owner's switch). Guideline 3.1.3(b): a thing bought
 * outside the app may be USED in it once the same thing is also sold by In-App
 * Purchase — and App Review asks that a Live Watch bought IN the app have a
 * door to use it there.
 *
 *   · `/dashboard/<id>/studio/papic` and its own pages (crew, moderation,
 *     recap…) — the Papic host page. In the app it draws no web price, no
 *     GCash / BDO and no web link: Buy more is Apple's sheet, and every web
 *     offer on it is skipped (`studio/papic/page.tsx`, `appleIap`).
 *   · `/panood/control/<id>` — the Live Watch controller, "Go live". In the app
 *     it opens only for an event that owns Live Watch (it sends any other to
 *     Home, where Activate is Apple's sheet), and its Exit goes Home.
 *   · `/dashboard/<id>/studio/panood/cameras` (+ `/print`) — the camera QR
 *     codes the controller links to; they carry no price.
 *
 *   · 🍎 (owner 2026-10-23, "five more Apple products") the homes of Setnayan AI
 *     (`studio/setnayan-ai`), Music Maker (`studio/pakanta`), Patiktok
 *     (`studio/patiktok` + its booth and templates) and the Thank-You Video
 *     (`studio/thank-you`). Each page's ONE pay step becomes Apple's sheet
 *     (`IapUnlockSheet`) and draws no web price, no GCash / BDO and no web link
 *     when `getIapGate().iap` is true. (Mood Board is a free planning page that
 *     is never refused; its paid part, Make it real, was retired 2026-10-26.)
 *
 * NOT here, deliberately: the Live Watch detail / buy page
 * (`studio/live-studio-control`), the legacy setup and broadcast rooms, the
 * program output, `/studio/about/<key>` and every purchase route — those keep
 * landing on /web-only. With `iap` false (every build in people's hands, and
 * every build while the switch is off) nothing here opens.
 */
const IAP_OPENED_ROUTE =
  /^\/(?:dashboard\/[^/]+\/studio\/(?:papic|panood\/cameras|setnayan-ai|pakanta|patiktok|thank-you)|panood\/control\/[^/]+)(?:\/|$)/;

/**
 * 🍎 IS THIS ADD-ON'S DOOR HIDDEN IN THE STORE SHELL? — the ONE rule every door site asks (owner 2026-10-23: App
 * Review must be able to find every In-App Purchase product; a page that opens with nothing linking to it is a
 * product the reviewer cannot locate, and the build is rejected).
 *
 * `iap` false (every build in people's hands, and every build while the switch is off): exactly
 * `STORE_SHELL_HIDDEN_ADDON_KEYS` — guideline 3.1.1, no paid door without In-App Purchase.
 * `iap` true: a hidden key whose Studio home `IAP_OPENED_ROUTE` opens (Apple sells it here — Setnayan AI · Music
 * Maker · Patiktok · Thank You · Papic) gets its door back; every other paid key stays hidden. Derived from the
 * route, never a second list, so a product cannot open without its door, nor get a door without opening.
 * Held by `lib/the-app-shows-a-door-to-what-apple-sells.test.ts`.
 */
export function isStoreShellHiddenAddon(key: string, iap = false): boolean {
  if (!STORE_SHELL_HIDDEN_ADDON_KEYS.has(key)) return false;
  return !(iap && IAP_OPENED_ROUTE.test(`/dashboard/_/studio/${key}`));
}

/**
 * Does this pathname belong to a feature the store shell must not open?
 * Pure; used by middleware. The hub page itself (`/studio`) stays open — it
 * filters its own grid with STORE_SHELL_HIDDEN_ADDON_KEYS.
 *
 * `iap` — Apple can sell in this app (`iapAvailable`); only then do the
 * routes in `IAP_OPENED_ROUTE` open. Default false: every caller that does not
 * know answers exactly as before In-App Purchase existed.
 */
export function isStoreShellWebOnlyPath(pathname: string, iap = false): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (iap && IAP_OPENED_ROUTE.test(path)) return false;
  if (STORE_SHELL_WEB_ONLY_DOORWAYS.has(path)) return true;
  if (WEB_ONLY_PURCHASE_ROUTE.test(path)) return true;
  if (WEB_ONLY_FEATURE_ROUTE.test(path)) return true;
  const feature = path.match(FEATURE_PAGE_ROUTE);
  if (feature) return STORE_SHELL_WEB_ONLY_FEATURE_SLUGS.has(feature[1]!);
  const m = path.match(STUDIO_ROUTE);
  if (!m) return false;
  // `/studio/about/<key>` is the App-Store-style detail page for a feature —
  // for a paid key it is a price and a "Get" button. Same rule as the home.
  if (m[1] === 'about') return m[2] !== undefined && STORE_SHELL_WEB_ONLY_STUDIO_SEGMENTS.has(m[2]);
  return STORE_SHELL_WEB_ONLY_STUDIO_SEGMENTS.has(m[1]!);
}

/**
 * Should the store shell hide a link with this `href`? True when it points, on
 * our own origin, at a route `isStoreShellWebOnlyPath` refuses — i.e. a door
 * the app would answer with /web-only. Pure; `StoreShellLinkGuard`
 * (app/_components/store-shell-link-guard.tsx) is the client that applies it.
 * Fragments, mailto:, tel: and other origins are never hidden.
 *
 * 🍎 ALSO THE MORE MENU'S ADDRESS (`studioHubHref` — Home `?more=services`).
 * In the app the More menu is not built (#6725): every service it lists is a
 * paid web extra (`STORE_SHELL_HIDDEN_ADDON_KEYS`), so the list is empty and
 * the address only re-opens Home. "Open Services", "More Services", "Back to
 * add-ons" and every other link to it were a dead jump to Home in the app
 * (2026-10-21). Pages that draw one gate it server-side; this is the net
 * under them, the same way as the refused routes. Held by
 * `lib/the-app-names-no-paid-service.test.ts`.
 *
 * `iap` — Apple sells in this app: a link to a route `IAP_OPENED_ROUTE` opens
 * stays (the guard asks `iapAvailable` the same way middleware does).
 */
export function storeShellHidesHref(href: string | null | undefined, currentUrl: string, iap = false): boolean {
  if (!href) return false;
  let url: URL;
  let here: URL;
  try {
    here = new URL(currentUrl);
    url = new URL(href, here);
  } catch {
    return false;
  }
  if (url.origin !== here.origin) return false;
  if (asksForMoreServices(url.search)) return true;
  return isStoreShellWebOnlyPath(url.pathname, iap);
}

/**
 * May the store shell pay THIS order on `/pay/<reference>`?
 *
 * Only a supplier's booking fee: Setnayan's cut of a booking for a real-world
 * service (guideline 3.1.3(e) — physical goods and services consumed outside
 * the app may use a non-IAP rail). Every other order is a Setnayan digital SKU
 * (Papic, Sai, Pro, a vendor plan, 3D Booth, Deep Search…) and the page sends
 * the store shell to /web-only instead of painting a QR for it.
 *
 * Takes the resolver's own `isBookingFee` (lib/pay-back-link.ts
 * `isBookingFeeOrder` — the one spelling of that question) rather than
 * re-parsing a service_key here.
 */
export function storeShellRefusesPayable(
  payable: { isBookingFee: boolean },
  storeShell: boolean,
): boolean {
  return storeShell && !payable.isBookingFee;
}

/**
 * May a PAID digital entitlement the event already owns be USED here?
 *
 * Guideline 3.1.3(b): content bought outside the app may be used inside it
 * only when the same content is also purchasable by In-App Purchase — which
 * none of ours is until v1.1. So in the store shell a web-bought Setnayan AI,
 * for one, does not light up; off the store shell nothing changes.
 *
 * 🍎 `iap` (owner 2026-10-23): where Apple sells Setnayan AI in this app
 * (`getIapGate().iap`), a Setnayan AI bought on the web OR in the app lights
 * up — it is now also purchasable by In-App Purchase. Default false: every
 * caller that does not pass it answers exactly as before.
 *
 * `paywallEnabled = false` means the feature is FREE for everyone (the owner's
 * paywall switch), and a free feature is planning, not a purchase — it stays.
 * That is why this takes the paywall and does not simply answer `!storeShell`:
 * turning a free assistant off in the app would remove planning the app exists
 * to provide.
 */
/**
 * 🍎 The pay settings handed to a client component in the store shell: none. The app pays only through Apple, so
 * the bank and GCash details (`platform_settings`) are never shipped to it — not even unrendered, in a prop
 * (review of #6844, 2026-10-23). Same shape as the checkout drawer's `settings`.
 */
export const STORE_SHELL_NO_PAY_SETTINGS = Object.freeze({
  bdo_account_name: null,
  bdo_account_number: null,
  bdo_qr_url: null,
  gcash_account_name: null,
  gcash_number: null,
  gcash_qr_url: null,
});

export function storeShellAllowsPaidFeature(storeShell: boolean, paywallEnabled: boolean, iap = false): boolean {
  return !storeShell || !paywallEnabled || iap;
}

/**
 * 🚧 THE STORE SHELL SHOWS NO "COMING SOON". App Review reads a "Coming soon"
 * pill as an unfinished app (guideline 2.1 / 2.3) — sweep 2026-10-19 counted
 * about twelve inside the app. The web keeps them (an honest roadmap note);
 * the app hides them.
 *
 * HOW: every element that says it — the pill, or the whole card when "Coming
 * soon" is its only state — carries `data-coming-soon`, and one CSS rule in
 * app/globals.css hides those under `html[data-store-shell]`. The attribute is
 * set by `storeShellMarkScript` below, an inline <head> script in
 * app/layout.tsx, so it is on <html> BEFORE THE FIRST PAINT — no flash, no
 * hydration step, and static/ISR pages are covered too (the root layout
 * cannot read the request without de-opting every cached route).
 *
 * `lib/store-shell.test.ts` holds both halves: the script answers exactly what
 * `isStoreShellInBrowser` answers on the same table of user agents and
 * cookies (so the .dmg is never marked), and every JSX "coming soon" in a
 * route the store shell can open sits inside a `data-coming-soon` element.
 */
export const STORE_SHELL_HTML_ATTR = 'data-store-shell';
export const COMING_SOON_ATTR = 'data-coming-soon';

/**
 * 🍎 ONE PAGE, TWO READERS — for a page that is the SAME URL on the web and in
 * the app but must say something different in the app (Apple check
 * 2026-10-19, rows #5 · #6 · #14 · #26). The same `data-store-shell` mark
 * drives two more CSS rules in app/globals.css:
 *
 *   · `data-web-only` — hidden in the store shell: the marketing header's
 *     Prices · Download · Suppliers buttons, a help answer that points at the
 *     web to buy.
 *   · `data-app-only` — hidden everywhere ELSE: the store-shell wording of
 *     that same answer.
 *
 * WHY CSS AND NOT `isStoreShellRequest()`: /help/<slug> is prerendered (every
 * article, `dynamicParams = false`), and the marketing header is a client
 * component on cached pages. A request read would de-opt both; the <head> mark
 * is on <html> before the first paint, so neither reader sees the other's
 * words flash. Where a page IS per-request (the /help index, /about), it picks
 * the words on the server instead and ships only one.
 */
export const WEB_ONLY_ATTR = 'data-web-only';
export const APP_ONLY_ATTR = 'data-app-only';

/**
 * The <head> script. Plain ES5 on purpose (it runs before any bundle); it is
 * `isStoreShellInBrowser` spelled out by hand, and the test runs THIS string
 * against that function's own cases.
 */
export const storeShellMarkScript = `(function(){try{
  var ua=navigator.userAgent||'';var ct='';
  var parts=(document.cookie||'').split(';');
  for(var i=0;i<parts.length;i++){var p=parts[i];var eq=p.indexOf('=');if(eq<0)continue;
    if(p.slice(0,eq).trim()!=='${CLIENT_TYPE_COOKIE}')continue;ct=p.slice(eq+1).trim();break;}
  var s=ct==='capacitor'?true:ct==='tauri'?false:/SetnayanApp\\/desktop/i.test(ua)?false:/SetnayanApp/i.test(ua);
  if(s)document.documentElement.setAttribute('${STORE_SHELL_HTML_ATTR}','1');
}catch(e){}})();`;
