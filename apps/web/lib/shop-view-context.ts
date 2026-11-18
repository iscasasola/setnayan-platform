import 'server-only';

/**
 * shop-view-context.ts — 👁 read WHO is opening a shop page off the request, for `recordShopViewWith`
 * (`lib/shop-view-count.ts`, walker W1-B15).
 *
 * ⚠ CALL IT BEFORE `after()`, NEVER INSIDE. Next refuses `headers()` / `cookies()` inside a Server Component's
 * `after()` callback — and the old recorder read them there, so its auth read and its cookie read both threw, were
 * swallowed, and the live render wrote views with no visitor at all (nothing to tell one couple from five opens).
 * A server action (the cached copy's beacon) may call it anywhere, and only there can a cookie be set (`mint`).
 */
import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { readViewIp, type ShopViewContext } from '@/lib/shop-view-count';

/** The opaque per-browser id signed-out visitors are deduped on (shared with the portfolio photo counter). */
export const ANON_VIEWER_COOKIE = 'sn_vw';

export async function readShopViewContext(opts: { mint?: boolean } = {}): Promise<ShopViewContext> {
  const ctx: ShopViewContext = { userId: null, anonCookie: null, userAgent: null, ip: null };
  try {
    const h = await headers();
    ctx.userAgent = h.get('user-agent');
    ctx.ip = readViewIp(h);
  } catch {
    /* no request headers — read as a bot (no user-agent), never counted */
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    ctx.userId = user?.id ?? null;
  } catch {
    /* auth read is best-effort */
  }
  if (!ctx.userId) {
    try {
      const jar = await cookies();
      const existing = jar.get(ANON_VIEWER_COOKIE)?.value ?? null;
      ctx.anonCookie = existing;
      // An action can set the cookie — then THIS open is keyed on it too, so the next open is the same visitor. Where
      // it cannot be set (a render), the open is keyed on the device (IP + user-agent), never on a throwaway id.
      if (!existing && opts.mint) {
        const fresh = crypto.randomUUID();
        jar.set({ name: ANON_VIEWER_COOKIE, value: fresh, httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
        ctx.anonCookie = fresh;
      }
    } catch {
      /* read-only or absent cookie store — the device key stands */
    }
  }
  return ctx;
}
