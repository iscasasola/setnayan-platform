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
 *   · /dashboard/<eventId>/orders/new  — the generic add-on order form
 *   · /dashboard/<eventId>/checkout    — the checkout action surface
 *   · /papic/order/<token>             — the guest-side camera buy sheet
 */
const WEB_ONLY_PURCHASE_ROUTE = /^\/(?:dashboard\/[^/]+\/(?:orders\/new|checkout)|papic\/order)(?:\/|$)/;

const STUDIO_ROUTE = /^\/dashboard\/[^/]+\/studio\/([^/]+)(?:\/|$)/;

/** Where the store shell lands when it reaches a web-only route. */
export const STORE_SHELL_WEB_ONLY_PATH = '/web-only';

/**
 * Does this pathname belong to a feature the store shell must not open?
 * Pure; used by middleware. The hub page itself (`/studio`) stays open — it
 * filters its own grid with STORE_SHELL_HIDDEN_ADDON_KEYS.
 */
export function isStoreShellWebOnlyPath(pathname: string): boolean {
  if (WEB_ONLY_PURCHASE_ROUTE.test(pathname)) return true;
  const m = pathname.match(STUDIO_ROUTE);
  if (!m) return false;
  return STORE_SHELL_WEB_ONLY_STUDIO_SEGMENTS.has(m[1]!);
}
