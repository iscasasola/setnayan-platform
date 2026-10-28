/**
 * Where a request originated — the native iOS/Android app (Capacitor shell) or
 * the web. Used to stamp `orders.platform` so /admin/payments can show whether a
 * purchase came in through the app or the website.
 *
 * Signals (any one ⇒ native): the `SetnayanApp` marker the Capacitor shell
 * appends to its WebView user-agent (with `/ios` | `/android`), or the
 * `setnayan-client-type=capacitor` cookie the ClientTypeDetector sets. The OS
 * split comes from the UA. Safe outside a request scope (build / cron, where
 * headers()/cookies() throw) → 'web'.
 *
 * NOTE on the route-to-web hand-off (PR #1538): once the native app sends buyers
 * to the EXTERNAL browser to pay, the order is created in a web context, so the
 * detected platform there is 'web'. To preserve the app origin, the hand-off can
 * carry an explicit hint (e.g. ?checkout_origin=ios) that the checkout action
 * passes as the `platform` form field — see submitOrderAction, which prefers a
 * valid explicit hint over the detected value.
 */
import { headers, cookies } from 'next/headers';
import { isStoreShellSignals, STORE_SHELL_CLIENT_TYPE_COOKIE } from '@/lib/store-shell';
import { classifyShell, oauthGate, type ClientShell, type OAuthFlags, type OAuthGate } from '@/lib/oauth-shell-gate';
import { iapAvailable } from '@/lib/iap/iap-gate';
import { isAppleIapEnabled } from '@/lib/apple-iap-flag';
import { cachedHubViewer } from '@/lib/hub-request';

export type RequestPlatform = 'web' | 'ios' | 'android';

export const REQUEST_PLATFORMS = ['web', 'ios', 'android'] as const;

export function isRequestPlatform(v: unknown): v is RequestPlatform {
  return typeof v === 'string' && (REQUEST_PLATFORMS as readonly string[]).includes(v);
}

/**
 * Coarser shell bucket for auth-UI decisions: 'desktop' (Tauri), 'mobile'
 * (Capacitor) or 'web'. OAuth handling differs by shell — desktop gets
 * system-browser loopback OAuth, the phone app gets the NATIVE flow (Apple
 * sheet + Google in the system browser) when its build carries the plugin, web
 * gets the normal redirect. The rule itself lives in lib/oauth-shell-gate.ts so
 * the browser-side mirror runs the same function.
 *
 * 'desktop' requires the `SetnayanApp/desktop` UA marker that only the REBUILT
 * desktop app carries (added alongside loopback support). A current Tauri app
 * (plain `SetnayanApp`, or a `tauri` client-type cookie) is treated as 'mobile'
 * so its non-functional OAuth buttons stay hidden until it updates — never a
 * dead-end. Safe outside a request scope → 'web'.
 */
export type { ClientShell } from '@/lib/oauth-shell-gate';

async function readShellSignals(): Promise<{ ua: string; clientType: string } | null> {
  // 🗄 The cached Event Hub is only ever a web browser's (the middleware keeps the native shells live) — the
  // same answer as outside a request, without asking it (lib/hub-request.ts).
  if (cachedHubViewer()) return null;
  try {
    const h = await headers();
    const c = await cookies();
    return {
      ua: h.get('user-agent') ?? '',
      clientType: c.get('setnayan-client-type')?.value ?? '',
    };
  } catch {
    return null;
  }
}

export async function getClientShell(): Promise<ClientShell> {
  const s = await readShellSignals();
  if (!s) return 'web';
  return classifyShell(s.ua, s.clientType);
}

/**
 * Which Google / Apple buttons this request sees — `show`, and which flow
 * (`desktop` loopback · `native` phone-app · otherwise the web redirect).
 * Pass OAUTH_FLAGS (app/_components/oauth-button-row). Safe outside a request
 * scope → the web gate.
 */
export async function getOAuthGate(flags: OAuthFlags): Promise<OAuthGate> {
  const s = await readShellSignals();
  if (!s) return oauthGate('web', '', flags);
  return oauthGate(classifyShell(s.ua, s.clientType), s.ua, flags);
}

export async function getRequestPlatform(): Promise<RequestPlatform> {
  if (cachedHubViewer()) return 'web';
  let ua = '';
  let clientType = '';
  try {
    const h = await headers();
    ua = h.get('user-agent') ?? '';
    const c = await cookies();
    clientType = c.get('setnayan-client-type')?.value ?? '';
  } catch {
    return 'web';
  }
  const isNative = /SetnayanApp/i.test(ua) || clientType === 'capacitor';
  if (!isNative) return 'web';
  if (/SetnayanApp\/android/i.test(ua) || /Android/i.test(ua)) return 'android';
  return 'ios';
}

/**
 * Does Discover (`/`, the public feed) OPEN on this request — or does the native
 * shell bounce it to the board?
 *
 * Middleware sends every native-shell request for a path in
 * `APP_EXCLUDED_MARKETING_PATHS` to /dashboard (signed in) or /login, and `/` is
 * in that set while Apple reviews 1.0. "Native shell" there is ANY `SetnayanApp`
 * user agent or the capacitor cookie — the phone app and the desktop app alike —
 * which is exactly `getRequestPlatform() !== 'web'` (the same question /login
 * asks for its ✕). So a door to Discover — the account bar's tab, the rail's
 * row — is drawn only where this is true, and is never a press that lands back
 * on the page you were on (owner "yes to all", 2026-10-21).
 *
 * ⚠ When `/` leaves the bounce list, this must change with it:
 * `the-account-bar-is-the-ruling.test.ts` reads the set from middleware.ts and
 * fails the day the two disagree.
 */
export async function discoverOpensHere(): Promise<boolean> {
  return (await getRequestPlatform()) === 'web';
}

/**
 * Is this request from the App Store / Play Store shell (Capacitor)?
 *
 * ⚠ NOT the same question as `getRequestPlatform() !== 'web'`: that one also
 * says 'ios' for the desktop Tauri build (`SetnayanApp/desktop`), which Apple
 * never reviews. Store-review rules — hide paid digital features (3.1.1 via
 * 3.1.3(b)), no cookie prompt (5.1.2) — must key on THIS. The pure predicate
 * and the rationale live in lib/store-shell.ts. Safe outside a request scope
 * (build / cron) → false.
 */
export async function isStoreShellRequest(): Promise<boolean> {
  if (cachedHubViewer()) return false;
  try {
    const h = await headers();
    const c = await cookies();
    return isStoreShellSignals(
      h.get('user-agent'),
      c.get(STORE_SHELL_CLIENT_TYPE_COOKIE)?.value,
    );
  } catch {
    return false;
  }
}

/**
 * 🍎 The store shell, and whether it may sell through Apple on this request.
 *
 * `iap` is true only when ALL of: the store shell, a build carrying the StoreKit
 * plugin (`SetnayanIAP/2` or higher — 1.1+; build 5's `/1` never), and the owner's switch — the rule is
 * `iapAvailable` in lib/iap/iap-gate.ts. With `iap` false every reader keeps
 * the store-shell behaviour it had before In-App Purchase existed. Safe outside
 * a request scope → both false.
 */
export async function getIapGate(): Promise<{ storeShell: boolean; iap: boolean }> {
  const signals = await readShellSignals();
  if (!signals) return { storeShell: false, iap: false };
  const storeShell = isStoreShellSignals(signals.ua, signals.clientType);
  return {
    storeShell,
    iap: iapAvailable({ storeShell, userAgent: signals.ua, enabled: isAppleIapEnabled() }),
  };
}
