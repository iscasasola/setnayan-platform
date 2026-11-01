/**
 * VISITS · the middleware's call — count one page view, after the response.
 *
 *     after(() => recordSiteVisit(request, response));
 *
 * Runs on the edge inside Next `after()`, so the visitor's page is already on
 * its way before any of this starts; every failure is swallowed (a dropped
 * view must never cost a page). Writes go to `record_site_visit` through the
 * service role (migration 20271282829207) by a direct REST call — the heavy
 * supabase-js client never enters the middleware bundle (the same reason
 * lib/custom-domain-resolve.ts calls its RPCs this way).
 *
 * WHO MAY WRITE: only the production deployment (`backgroundWritesAllowed` — a
 * preview shares the production database, and a builder's `next dev` points
 * at it too), or a database on this machine.
 *
 * The route list (`screens.generated.json`, ~360 KB) is loaded on the FIRST
 * counted view, inside after() — never on a request's critical path, and never
 * in any browser bundle.
 */
import type { NextRequest, NextResponse } from 'next/server';
import { backgroundWritesAllowed } from '@/lib/background-writes';
import { STORE_SHELL_CLIENT_TYPE_COOKIE } from '@/lib/store-shell';
import { hasSessionCookie, shouldCount, visitFacts, visitorKey } from '@/lib/visits/visit-capture';
import { isHubViewPath } from '@/lib/hub-view-key';

/** Production, or a database on this machine (the lab). Never a preview, never `next dev` on prod. */
export function visitWritesAllowed(env: Partial<Record<string, string | undefined>> = process.env): boolean {
  if (backgroundWritesAllowed(env)) return true;
  try {
    const host = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname;
    return host === '127.0.0.1' || host === 'localhost';
  } catch {
    return false;
  }
}

let toPattern: ((path: string) => string | null) | null = null;
/** A served path → the app's route pattern (`/v/[slug]`), via the app's own route list. */
export async function visitRoutePattern(path: string): Promise<string | null> {
  if (!toPattern) {
    type Screens = { screens: Array<{ route: string }> };
    const [{ makeRouteMatcher }, { normalizePath }, mod] = await Promise.all([
      import('@/lib/telemetry/route-pattern'),
      import('@/lib/telemetry/fault-normalize'),
      import('@/lib/ugat/screens.generated.json') as unknown as Promise<Screens & { default?: Screens }>,
    ]);
    const list = mod.default ?? mod;
    const match = makeRouteMatcher(list.screens.map((s) => s.route));
    toPattern = (p: string) => match(normalizePath(p));
  }
  return toPattern(path);
}

/** The path the page was actually drawn from (a middleware rewrite names it). */
function servedPath(request: NextRequest, response: NextResponse): string {
  const rewrite = response.headers.get('x-middleware-rewrite');
  if (rewrite) {
    try {
      const target = new URL(rewrite, request.url).pathname;
      // 🗄 The cached Event Hub (lib/hub-view-key.ts) is the SAME page the guest asked for; its key names a guest
      // (id + seal) and must never reach the visits table. The page they opened is `/{slug}`.
      if (isHubViewPath(target)) return request.nextUrl.pathname;
      return target;
    } catch {
      /* fall through */
    }
  }
  return request.nextUrl.pathname;
}

export async function recordSiteVisit(request: NextRequest, response: NextResponse): Promise<void> {
  try {
    if (!visitWritesAllowed()) return;
    const kind = shouldCount({
      method: request.method,
      pathname: request.nextUrl.pathname,
      headers: request.headers,
      status: response.status,
      clientTypeCookie: request.cookies.get(STORE_SHELL_CLIENT_TYPE_COOKIE)?.value,
    });
    if (!kind) return;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    const served = servedPath(request, response);
    const pattern = await visitRoutePattern(served);
    const facts = visitFacts({
      kind,
      pathname: served,
      search: request.nextUrl.searchParams,
      headers: request.headers,
      host: request.headers.get('host') ?? '',
      signedIn: hasSessionCookie(request.cookies.getAll().map((c) => c.name)),
      toPattern: () => pattern,
    });
    if (!facts) return;
    const body = {
      p_path: facts.path,
      p_source: facts.source,
      p_utm_source: facts.utmSource,
      p_device: facts.device,
      p_country: facts.country,
      p_signed_in: facts.signedIn,
      p_key: await visitorKey(request.headers),
    };
    await fetch(`${url}/rest/v1/rpc/record_site_visit`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    // Best-effort by design.
  }
}
