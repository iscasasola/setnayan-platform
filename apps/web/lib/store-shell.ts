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
  'custom-qr-guest',
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
]);

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
  /^\/(?:vendor-dashboard\/subscription|dashboard\/[^/]+\/live|panood\/(?:control|program))(?:\/|$)/;
// ↑ `/panood/control/<eventId>` and `/panood/program/<eventId>` are the Live
//   Studio control room and its program output — the paid unlock's working
//   surface (added 2026-09-24). `/panood/cam/<token>` is a helper's camera join
//   and stays open, like the guest side of Papic.

const STUDIO_ROUTE = /^\/dashboard\/[^/]+\/studio\/([^/]+)(?:\/([^/]+))?(?:\/|$)/;

/** Where the store shell lands when it reaches a web-only route. */
export const STORE_SHELL_WEB_ONLY_PATH = '/web-only';

/**
 * Does this pathname belong to a feature the store shell must not open?
 * Pure; used by middleware. The hub page itself (`/studio`) stays open — it
 * filters its own grid with STORE_SHELL_HIDDEN_ADDON_KEYS.
 */
export function isStoreShellWebOnlyPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (STORE_SHELL_WEB_ONLY_DOORWAYS.has(path)) return true;
  if (WEB_ONLY_PURCHASE_ROUTE.test(path)) return true;
  if (WEB_ONLY_FEATURE_ROUTE.test(path)) return true;
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
 */
export function storeShellHidesHref(href: string | null | undefined, currentUrl: string): boolean {
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
  return isStoreShellWebOnlyPath(url.pathname);
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
 * `paywallEnabled = false` means the feature is FREE for everyone (the owner's
 * paywall switch), and a free feature is planning, not a purchase — it stays.
 * That is why this takes the paywall and does not simply answer `!storeShell`:
 * turning a free assistant off in the app would remove planning the app exists
 * to provide.
 */
export function storeShellAllowsPaidFeature(storeShell: boolean, paywallEnabled: boolean): boolean {
  return !storeShell || !paywallEnabled;
}
