/**
 * THE CACHED EVENT HUB READS NO COOKIE — NOT EVEN BEFORE ITS VIEWER IS HELD (HOTFIX, 2026-11-02).
 *
 * Production, 2026-10-28 → 2026-11-02, every GUEST's cached copy (`/{slug}/cached/v1.…g<guest>…`):
 *   "Page changed from static to dynamic at runtime …, reason: cookies"  → the guest got an error page.
 * The stack, mapped onto a local build of the same tree: `readCookie` (lib/view-as-free.server.ts) ←
 * `viewingAsFreeCouple` ← `asViewed` ← `websiteProActiveFor` ← `loadGuestLook` ← the `[slug]` LAYOUT.
 *
 * WHY ONLY GUESTS: the layout renders FIRST and asks the couple's look before the cached route has held its viewer —
 * the route holds it only after it read the guest's pass (two database reads). A stranger's copy holds it at once
 * (no pass to read), so the metadata's hold won the race; a guest's lost it, and the "view as free" switch read
 * `cookies()` mid-ISR. Its try/catch swallowed the throw, so nothing said so until Next failed the whole page.
 *
 * WHAT THIS HOLDS: inside a render of the cached route with NO viewer held yet — exactly the layout's moment — no
 * request reader that answers the same for every guest touches the request. The probe is the render's own work
 * store: `cookies()` / `headers()` ask its `forceStatic` before anything else, so a read that happened leaves a mark
 * even when the reader swallows what it threw. The probe is proved able to hit (a bare `cookies()` marks it).
 *
 * Run: npx tsx --test lib/the-cached-hub-reads-no-cookie-before-its-viewer.test.ts   (from apps/web)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

/* ── `server-only` shim (the shape of lib/a-crew-tag-reaches-the-suppliers-day.test.ts) ──────────────────────────── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub_cached_hub_cookie__.js');
{
  const stub = new CjsModule(SERVER_ONLY_STUB);
  stub.filename = SERVER_ONLY_STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[SERVER_ONLY_STUB] = stub;
  const originalResolve = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return SERVER_ONLY_STUB;
    return originalResolve.call(this, request, ...rest);
  };
}

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:9';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'lab-anon-not-a-key';

/* Next's server installs AsyncLocalStorage before any of its stores is built; a plain node test must do the same. */
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= (nodeRequire('node:async_hooks') as typeof import('node:async_hooks')).AsyncLocalStorage;

/* Loaded AFTER the shim and the storage (a static import would be hoisted above both). */
const { workAsyncStorage } = nodeRequire('next/dist/server/app-render/work-async-storage.external') as typeof import('next/dist/server/app-render/work-async-storage.external');
const { CACHED_HUB_ROUTE, onTheCachedHub, cachedHubViewer } = nodeRequire('./hub-request') as typeof import('./hub-request');
const { cookies } = nodeRequire('next/headers') as typeof import('next/headers');
const { viewingAsFreeCouple } = nodeRequire('./view-as-free.server') as typeof import('./view-as-free.server');
const { getCurrentUser } = nodeRequire('./auth') as typeof import('./auth');
const { createClient } = nodeRequire('./supabase/server') as typeof import('./supabase/server');
const { getRequestPlatform, isStoreShellRequest } = nodeRequire('./request-platform') as typeof import('./request-platform');

/** A render's work store for `route` that records every question asked of it besides its name. */
function probeStore(route: string) {
  const asked: string[] = [];
  const store = new Proxy(
    { route, forceStatic: true },
    {
      get(target, prop) {
        if (prop !== 'route' && typeof prop === 'string') asked.push(prop);
        return Reflect.get(target, prop);
      },
    },
  );
  return { store, asked };
}

async function inRender<T>(route: string, run: () => Promise<T>): Promise<{ value: T; touched: boolean }> {
  const { store, asked } = probeStore(route);
  const value = await workAsyncStorage.run(store as never, run);
  return { value, touched: asked.includes('forceStatic') };
}

test('the route id is the one Next gives the cached hub page', () => {
  const file = path.join(process.cwd(), 'app/[slug]/cached/[key]/page.tsx');
  assert.ok(fs.existsSync(file), 'the cached hub route moved — move CACHED_HUB_ROUTE with it');
  const { normalizeAppPath } = nodeRequire('next/dist/shared/lib/router/utils/app-paths') as {
    normalizeAppPath: (p: string) => string;
  };
  assert.equal(CACHED_HUB_ROUTE, normalizeAppPath('/[slug]/cached/[key]/page'));
});

test('the probe can hit: a bare cookies() in the render marks it', async () => {
  const { touched } = await inRender(CACHED_HUB_ROUTE, async () => (await cookies()).getAll());
  assert.ok(touched, 'the probe saw nothing — this file proves nothing until it does');
});

test('the cached hub is known from the first moment of its render, before any viewer is held', async () => {
  assert.equal(onTheCachedHub(), false, 'outside any render it is not the cached hub');
  const other = await inRender('/[slug]', async () => onTheCachedHub());
  assert.equal(other.value, false, 'the live hub is not the cached one');
  const mine = await inRender(CACHED_HUB_ROUTE, async () => ({ on: onTheCachedHub(), held: cachedHubViewer() }));
  assert.equal(mine.value.held, null, 'this test is about the moment BEFORE the hold');
  assert.equal(mine.value.on, true);
});

const READERS: Record<string, () => Promise<unknown>> = {
  'the "view as free" switch (the layout reaches it through loadGuestLook → websiteProActiveFor → asViewed)': () =>
    viewingAsFreeCouple(),
  'the account (getCurrentUser)': () => getCurrentUser(),
  'the cookie-scoped Supabase client (createClient)': () => createClient(),
  'the platform (getRequestPlatform)': () => getRequestPlatform(),
  'the store-app shell (isStoreShellRequest)': () => isStoreShellRequest(),
};

for (const [name, read] of Object.entries(READERS)) {
  test(`before the viewer is held, ${name} reads nothing from the request`, async () => {
    const { touched } = await inRender(CACHED_HUB_ROUTE, async () => {
      try {
        await read();
      } catch {
        /* a refusal is fine; touching the request is not */
      }
    });
    assert.equal(
      touched,
      false,
      `${name} read the request on the cached hub before its viewer was held — every guest's copy dies mid-ISR ` +
        '("Page changed from static to dynamic at runtime … reason: cookies"). Ask onTheCachedHub() first (lib/hub-request.ts).',
    );
  });
}
