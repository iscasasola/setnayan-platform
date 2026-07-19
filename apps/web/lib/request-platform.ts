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

export type RequestPlatform = 'web' | 'ios' | 'android';

export const REQUEST_PLATFORMS = ['web', 'ios', 'android'] as const;

export function isRequestPlatform(v: unknown): v is RequestPlatform {
  return typeof v === 'string' && (REQUEST_PLATFORMS as readonly string[]).includes(v);
}

/**
 * Coarser shell bucket for auth-UI decisions: 'desktop' (Tauri), 'mobile'
 * (Capacitor) or 'web'. OAuth handling differs by shell — desktop gets
 * system-browser loopback OAuth, mobile is email-only (for now), web gets the
 * normal redirect.
 *
 * 'desktop' requires the `SetnayanApp/desktop` UA marker that only the REBUILT
 * desktop app carries (added alongside loopback support). A current Tauri app
 * (plain `SetnayanApp`, or a `tauri` client-type cookie) is treated as 'mobile'
 * so its non-functional OAuth buttons stay hidden until it updates — never a
 * dead-end. Safe outside a request scope → 'web'.
 */
export type ClientShell = 'web' | 'desktop' | 'mobile';

export async function getClientShell(): Promise<ClientShell> {
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
  if (/SetnayanApp\/desktop/i.test(ua)) return 'desktop';
  if (/SetnayanApp/i.test(ua) || clientType === 'capacitor' || clientType === 'tauri') return 'mobile';
  return 'web';
}

export async function getRequestPlatform(): Promise<RequestPlatform> {
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
