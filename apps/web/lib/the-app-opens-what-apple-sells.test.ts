/**
 * the-app-opens-what-apple-sells.test.ts — 🍎 VERSION 1.1: WHERE APPLE SELLS IN
 * THE APP, WHAT IT SELLS IS USABLE THERE — AND NOWHERE ELSE DOES ANYTHING CHANGE.
 *
 * #6637 (merged flag-dark 2026-10-18) put Papic credits, Event Hub Pro and Live
 * Watch on Apple's sheet; its "Not built here" list is this file's subject:
 *
 *   1 · the Papic and Live Watch CONTROL pages open in the app — only where Apple
 *       sells (`iapAvailable`: the store shell, a 1.1+ build announcing
 *       `SetnayanIAP/2`, the owner's switch) — and draw no web price, no
 *       GCash / BDO, no web link there; a Live Watch bought in the app has a
 *       Go live door (App Review: a purchase must be usable in the app);
 *   2 · Live Watch's Home line says where it was bought;
 *   3 · Hero / Reveal / Logo and the Our Story page try Pro exactly where the
 *       Maker editor's own Pro rows do (`proShell`).
 *
 * 🔒 THE OTHER HALF IS THE POINT: App 1.0 (build 5) is in App Review and the
 * reviewer sees the LIVE web inside it. Build 5 announces `SetnayanIAP/1`, and
 * the owner ruled (2026-10-21) that `/1` never sells, whatever the switch says
 * — so with the gate off every door below must be ABSENT and every refused
 * route still refused. Each part asserts both directions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { isStoreShellSignals, isStoreShellWebOnlyPath, storeShellHidesHref } from './store-shell';
import { iapAvailable } from './iap/iap-gate';
import { boughtWhere, liveWatchHomeStatus } from './iap/where-bought';
import { APP_STORE_CHANNEL_KEY } from './iap/products';
import { POOL_ONLY_APP_NOTICE, POOL_ONLY_DEFAULT_NOTICE, poolOnlyConnectNotice } from './live-studio-pool-only';
import { stripComments } from './strip-comments';
import { glanceCount, glanceDays, glanceMoney, pickHomeNext, type HomeNextInput } from './home-first-screen';

(globalThis as unknown as { React: unknown }).React = React;

// `server-only` / `client-only` are build-time markers; under node they resolve to an empty stub (the repo's pattern).
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_app_opens__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const E = '00000000-0000-4000-8000-000000000000';
const PAPIC_PAGE = 'app/dashboard/[eventId]/studio/papic/page.tsx';
const CONTROLLER = 'app/panood/control/[eventId]/page.tsx';

/* ═══ 1 · THE GATE — what opens, only where Apple sells ════════════════════ */

const OPENS = [
  `/dashboard/${E}/studio/papic`,
  `/dashboard/${E}/studio/papic/`,
  `/dashboard/${E}/studio/papic/crew`,
  `/dashboard/${E}/studio/papic/moderation`,
  `/dashboard/${E}/studio/papic/recap`,
  `/panood/control/${E}`,
  `/dashboard/${E}/studio/panood/cameras`,
  `/dashboard/${E}/studio/panood/cameras/print`,
  // 🍎 23 Oct (owner: "five more Apple products") — each home's pay step is Apple's sheet (section 6 below).
  `/dashboard/${E}/studio/setnayan-ai`,
  `/dashboard/${E}/studio/pakanta`,
  `/dashboard/${E}/studio/patiktok`,
  `/dashboard/${E}/studio/patiktok/booth`,
  `/dashboard/${E}/studio/patiktok/sunset-glow`,
  `/dashboard/${E}/studio/thank-you`,
];
const STAYS_REFUSED = [
  `/dashboard/${E}/studio/live-studio-control`, // the Live Watch buy page — its price, plans, checkout
  `/dashboard/${E}/studio/live-studio-control/setup`,
  `/dashboard/${E}/studio/panood`,
  `/dashboard/${E}/studio/panood/setup`, // legacy, priced
  `/dashboard/${E}/studio/panood/broadcast`,
  `/panood/program/${E}`,
  `/panood/control`, // no event: not the controller
  `/dashboard/${E}/studio/about/papic`, // the App-Store-style detail page: a price + Get
  `/dashboard/${E}/studio/papic-guest`,
  // The App-Store-style detail pages of the five stay refused — each is a web price and a "Get".
  `/dashboard/${E}/studio/about/setnayan-ai`,
  `/dashboard/${E}/studio/about/pakanta`,
  `/dashboard/${E}/studio/about/patiktok`,
  `/dashboard/${E}/studio/about/thank-you`,
  `/dashboard/${E}/studio/website-pro`,
  `/dashboard/${E}/studio/animated-monogram`,
  `/dashboard/${E}/orders/new`,
  `/dashboard/${E}/checkout`,
  `/dashboard/${E}/live`, // the Live Photo Wall — a web extra Apple does not sell
  '/papic/order/tok',
  '/pricing',
  '/papic',
  '/panood',
  '/features/papic',
  '/features/live-watch',
  '/vendor-dashboard/subscription',
];

test('1 · GATE OFF — every page this build opens is still refused, exactly as before In-App Purchase', () => {
  for (const p of OPENS) {
    assert.equal(isStoreShellWebOnlyPath(p), true, `${p} opened with the gate off`);
    assert.equal(isStoreShellWebOnlyPath(p, false), true, `${p} opened with iap=false`);
  }
  for (const p of STAYS_REFUSED) assert.equal(isStoreShellWebOnlyPath(p), true, `premise: ${p} is refused`);
});

test('1 · GATE ON — the Papic page and the Live Watch controller open; nothing that sells on the web does', () => {
  for (const p of OPENS) assert.equal(isStoreShellWebOnlyPath(p, true), false, `${p} is still refused where Apple sells`);
  for (const p of STAYS_REFUSED) assert.equal(isStoreShellWebOnlyPath(p, true), true, `${p} opened where Apple sells — it sells on the web`);
  // The free planning routes are not touched either way.
  for (const p of [`/dashboard/${E}`, `/dashboard/${E}/guests`, `/dashboard/${E}/studio`]) {
    assert.equal(isStoreShellWebOnlyPath(p, true), false);
    assert.equal(isStoreShellWebOnlyPath(p, false), false);
  }
});

test('1 · the link guard keeps a link only where the page opens — same rule, same switch', () => {
  const here = `https://www.setnayan.com/dashboard/${E}`;
  const papic = `/dashboard/${E}/studio/papic`;
  const goLive = `/panood/control/${E}`;
  assert.equal(storeShellHidesHref(papic, here), true, 'gate off: the Papic link is hidden');
  assert.equal(storeShellHidesHref(goLive, here), true, 'gate off: Go live is hidden');
  assert.equal(storeShellHidesHref(papic, here, true), false, 'gate on: the Papic link stays');
  assert.equal(storeShellHidesHref(goLive, here, true), false, 'gate on: Go live stays');
  for (const p of STAYS_REFUSED) assert.equal(storeShellHidesHref(p, here, true), true, `gate on: a link to ${p} is shown`);
  assert.equal(storeShellHidesHref(`/dashboard/${E}?more=services`, here, true), true, 'the More menu address stays hidden');
});

test('1 · middleware and the link guard ask the ONE three-part gate (`iapAvailable` + the owner switch)', () => {
  const mw = code('middleware.ts');
  assert.match(
    mw,
    /isStoreShellWebOnlyPath\(pathname, iapAvailable\(\{ storeShell, userAgent: ua, enabled: isAppleIapEnabled\(\) \}\)\)/,
    'middleware does not hand the gate to the route rule',
  );
  assert.match(mw, /storeShell &&\s*isStoreShellWebOnlyPath\(pathname, iapAvailable/, 'the refusal no longer requires the store shell');
  // The guard's work runs only inside the store shell (its component checks first), so it asks the gate's other two
  // parts — the same functions `iapAvailable` asks.
  const guard = code('app/_components/store-shell-link-guard-run.ts');
  assert.match(guard, /export function guardStoreShellLinks\(\): \(\) => void \{\s*iap = hasNativeStore\(navigator\.userAgent\) && isAppleIapEnabled\(\);/);
  assert.match(code('lib/iap/iap-gate.ts'), /return input\.enabled && input\.storeShell && hasNativeStore\(input\.userAgent\);/, 'the gate is no longer the switch + the shell + the build');
  assert.match(guard, /storeShellHidesHref\(a\.getAttribute\('href'\), window\.location\.href, iap\)/);
  // The gate itself: any one of the three missing → no Apple.
  const ua = 'Mozilla/5.0 (iPhone) SetnayanApp/ios SetnayanSignIn/1 SetnayanIAP/2';
  assert.equal(iapAvailable({ storeShell: true, userAgent: ua, enabled: true }), true);
  assert.equal(iapAvailable({ storeShell: true, userAgent: ua, enabled: false }), false, 'the switch off');
  assert.equal(iapAvailable({ storeShell: true, userAgent: 'Mozilla/5.0 (iPhone) SetnayanApp/ios SetnayanSignIn/1', enabled: true }), false, 'a build with no StoreKit plugin');
  assert.equal(iapAvailable({ storeShell: false, userAgent: ua, enabled: true }), false, 'not the store shell');
});

/* 🔒 BUILD 5 NEVER SELLS (owner 2026-10-21): 1.0 (5) carries the StoreKit plugin and announces `SetnayanIAP/1`, but it was
   submitted as an app that sells nothing — so only `/2`+ (1.1, the build In-App Purchase is submitted with) opens a door,
   and the switch alone can no longer light 1.0 up. Each case runs the WHOLE chain a request runs: the store-shell signal,
   the one gate, the middleware's route rule and the link guard's rule. */
test('1 · /1 (build 5) + switch ON → no door · /2 + switch ON → the doors · /2 + switch OFF → no door', () => {
  const app = (iap: string) => `Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SetnayanApp SetnayanSignIn/1${iap}`;
  const doorsFor = (ua: string, enabled: boolean) => {
    const storeShell = isStoreShellSignals(ua, 'capacitor');
    const iap = iapAvailable({ storeShell, userAgent: ua, enabled });
    const here = `https://www.setnayan.com/dashboard/${E}`;
    return {
      iap,
      routes: OPENS.filter((p) => !(storeShell && isStoreShellWebOnlyPath(p, iap))).length,
      links: OPENS.filter((p) => !storeShellHidesHref(p, here, iap)).length,
    };
  };
  const NONE = { iap: false, routes: 0, links: 0 };
  const ALL = { iap: true, routes: OPENS.length, links: OPENS.length };
  assert.deepEqual(doorsFor(app(' SetnayanIAP/1'), true), NONE, 'build 5 (/1) with the switch ON shows a door');
  assert.deepEqual(doorsFor(app(' SetnayanIAP/1'), false), NONE);
  assert.deepEqual(doorsFor(app(' SetnayanIAP/2'), true), ALL, '1.1 (/2) with the switch ON is still refused');
  assert.deepEqual(doorsFor(app(' SetnayanIAP/2'), false), NONE, '1.1 (/2) with the switch OFF shows a door');
  assert.deepEqual(doorsFor(app(' SetnayanIAP/3'), true), ALL, 'a later build (/3) is refused');
  assert.deepEqual(doorsFor(app(' SetnayanIAP/10'), true), ALL, '/10 read as /1');
  assert.deepEqual(doorsFor(app(''), true), NONE, 'no token');
  assert.deepEqual(doorsFor(app(' SetnayanIAP/0'), true), NONE);
  // The 1.1 build announces exactly the token that sells; Android never claims one.
  const cfg = readFileSync(join(WEB, '..', 'mobile', 'capacitor.config.ts'), 'utf8');
  assert.match(cfg, /ios:\s*\{[\s\S]*?appendUserAgent:\s*'SetnayanApp SetnayanSignIn\/1 SetnayanIAP\/2'/);
});

/* ═══ 2 · HOME — the doors exist only where Apple sells ═══════════════════ */

let Screen: typeof import('@/app/dashboard/[eventId]/_components/home-first-screen').HomeFirstScreen | null = null;
test.before(async () => {
  Screen = (await import('@/app/dashboard/[eventId]/_components/home-first-screen')).HomeFirstScreen;
});

const NOTHING: HomeNextInput = { guide: null, hasDate: true, guests: { total: 96, unsent: 0 }, noun: 'wedding', papicReady: false, aiOffer: false };
function home(apple: unknown): string {
  return renderToStaticMarkup(
    React.createElement(Screen!, {
      eventId: E,
      cover: { eyebrow: 'Wedding · December 18, 2026', name: 'Ana & Miguel' },
      next: pickHomeNext(NOTHING),
      days: glanceDays(120),
      coming: glanceCount(96, true),
      noReply: glanceCount(35, true),
      noReplyWaiting: true,
      money: null,
      services: [],
      papicLeft: 320,
      apple,
    } as never),
  );
}

test('2 · GATE OFF — Home draws no Papic door, no Go live, no Apple row (the app as App Review sees it)', () => {
  const html = home(null);
  assert.doesNotMatch(html, /data-home-apple-row/, 'an Apple row with the gate off');
  assert.doesNotMatch(html, /data-home-apple-open/, 'a Papic door with the gate off');
  assert.doesNotMatch(html, />Go live</, 'a Go live door with the gate off');
  assert.ok(!html.includes(`/panood/control/${E}`) && !html.includes(`/studio/papic`), 'a link to a control page with the gate off');
  // …and #6637's own shape (no `open`, no `goLive`) draws no door either.
  const shipped = home({
    papic: { status: '320 credits left', buy: true },
    liveWatch: { status: 'On', owned: true, askReady: false },
  });
  assert.match(shipped, /data-home-apple-row/, 'premise: the Apple rows draw');
  assert.doesNotMatch(shipped, /data-home-apple-open|>Go live</, '#6637\'s shape grew a door');
});

test('2 · GATE ON — Papic opens its page; an owned Live Watch says where it was bought and has Go live', () => {
  const html = home({
    papic: { status: '320 credits left', buy: true, open: `/dashboard/${E}/studio/papic` },
    liveWatch: { status: 'On · bought in the app', owned: true, askReady: false, goLive: `/panood/control/${E}` },
  });
  const tag = (attr: string) => (html.match(/<a\b[^>]*>/g) ?? []).filter((t) => t.includes(attr));
  assert.ok(tag('data-home-apple-open').some((t) => t.includes(`href="/dashboard/${E}/studio/papic"`)), 'the Papic row does not open its page');
  const goLive = html.match(new RegExp(`<a\\b[^>]*href="/panood/control/${E}"[^>]*>[\\s\\S]*?</a>`))?.[0] ?? '';
  assert.match(goLive, /Go live/, 'no Go live door to the controller');
  assert.match(html, /On · bought in the app/);
  assert.match(html, /data-testid="iap-papic-buy-more"/, 'Papic keeps its Apple Buy more');
  assert.doesNotMatch(html, /₱|GCash|BDO|setnayan\.com/i, 'a web price or web pay on Home in the app');
  // Not owned: Activate (Apple's sheet), never Go live.
  const notOwned = home({ papic: null, liveWatch: { status: 'Not on yet · one camera is free', owned: false, askReady: true, goLive: null } });
  assert.doesNotMatch(notOwned, />Go live</);
});

test('2 · the page hands `open` and `goLive` ONLY inside the Apple branch (appleFacts — the three-part gate)', () => {
  const page = code('app/dashboard/[eventId]/page.tsx');
  const branch = page.slice(page.indexOf('apple={'), page.indexOf('ground={homeCover}'));
  assert.match(branch, /^apple=\{\s*appleFacts\s*\?/, 'the Apple prop is no longer behind appleFacts');
  assert.match(branch, /open: `\/dashboard\/\$\{eventId\}\/studio\/papic`/);
  assert.match(branch, /goLive: appleFacts\.liveActive && liveStudioRoamEnabled\(\) \? liveStudioControlPath\(eventId\) : null/);
  assert.equal((page.match(/studio\/papic`/g) ?? []).length, 1, 'a second Papic door outside the Apple branch');
});

test('2 · Live Watch reads where it was bought — and claims nothing it cannot read', () => {
  const app = { status: 'paid', payment_method_key: APP_STORE_CHANNEL_KEY };
  const web = { status: 'paid', payment_method_key: 'gcash' };
  assert.equal(boughtWhere([app]), 'app');
  assert.equal(boughtWhere([web]), 'web');
  assert.equal(boughtWhere([{ status: 'submitted', payment_method_key: null }]), 'web');
  assert.equal(boughtWhere([app, web]), null, 'both: no single answer');
  assert.equal(boughtWhere([{ ...app, status: 'refunded' }, web]), 'web', 'a refunded App Store order no longer counts');
  assert.equal(boughtWhere([]), null, 'no order (an internal host, a comp grant)');
  assert.equal(boughtWhere(null), null, 'a failed read');
  assert.equal(liveWatchHomeStatus({ active: true, owned: true, where: 'web' }), 'On · bought on the web');
  assert.equal(liveWatchHomeStatus({ active: true, owned: true, where: 'app' }), 'On · bought in the app');
  assert.equal(liveWatchHomeStatus({ active: true, owned: true, where: null }), 'On');
  assert.equal(liveWatchHomeStatus({ active: false, owned: true, where: 'app' }), 'Being switched on');
  assert.equal(liveWatchHomeStatus({ active: false, owned: false, where: null }), 'Not on yet · one camera is free');
  assert.equal(liveWatchHomeStatus({ active: null, owned: true, where: 'app' }), '—', 'a failed read says "—"');
  // One spelling of the App Store channel: the fulfilment writes what Home reads.
  assert.match(code('lib/iap/fulfil.server.ts'), /export const APP_STORE_CHANNEL = APP_STORE_CHANNEL_KEY;/);
});

/* ═══ 3 · THE PAPIC PAGE — opened, de-priced ══════════════════════════════ */

/**
 * Does the expression that mounts `at` ask `appleIap`? Walks out through the innermost six enclosing `(` / `{`, and
 * for each reads its own condition: the text just before it (back to the previous `{ } ;`) and the head of the
 * expression it opens (up to the mount, at most 140 characters) — the shapes `{appleIap ? null : <X …/>}`,
 * `{!appleIap && … ? (`, `{appleIap ? null : ownsKeepFullRes ? (`, `{appleIap && live ? null : … ? (…) : (<X`.
 */
function asksAppleIap(src: string, at: number): boolean {
  const depth: Record<string, number> = { '(': 0, '{': 0 };
  const CLOSES: Record<string, string> = { ')': '(', '}': '{' };
  let openers = 0;
  for (let i = at - 1; i >= 0 && openers < 6; i--) {
    const c = src[i]!;
    if (c in CLOSES) depth[CLOSES[c]!]!++;
    else if (c in depth) {
      if (depth[c]! > 0) {
        depth[c]!--;
        continue;
      }
      openers++;
      let j = i - 1;
      while (j >= 0 && i - j < 240 && !'{};'.includes(src[j]!)) j--;
      if (/\bappleIap\b/.test(src.slice(j + 1, i + 1))) return true;
      if (/\bappleIap\b/.test(src.slice(i, Math.min(at, i + 140)))) return true;
    }
  }
  return false;
}

test('3 · the Papic page reads the gate once, and every web-only offer on it asks it', () => {
  const src = code(PAPIC_PAGE);
  assert.match(src, /const appleIap = \(await getIapGate\(\)\)\.iap;/);
  // (2026-10-23: the crew-camera ladder, the guest-camera tier sheet and the unlock bundle are GONE from the page —
  //  not gated, removed; Papic sells credits only. They may not come back on either platform.)
  for (const gone of ['ExtraCamerasPicker', 'GuestCameraTierPicker', 'LimitedCard', 'PAPIC_UNLOCK']) {
    assert.ok(!new RegExp(`<${gone}\\b|serviceKey="${gone}"`).test(src), `${gone} is on the Papic page again`);
  }
  // Each mount of a thing sold only on the web — found by name, counted, every one gated. (Keep full-res left with
  // the files for the Memories ⚙ sheet on 2026-10-23 — gated there, below.)
  const SOLD_ON_THE_WEB = ['InlineCheckoutDrawer', 'DslrBridgeSection'];
  let mounts = 0;
  const ungated: string[] = [];
  for (const name of SOLD_ON_THE_WEB) {
    for (const m of src.matchAll(new RegExp(`<${name}\\b`, 'g'))) {
      mounts++;
      if (!asksAppleIap(src, m.index!)) ungated.push(`${name} @${src.slice(0, m.index!).split('\n').length}`);
    }
  }
  assert.ok(mounts >= 1, `found only ${mounts} web-offer mounts — the anchor moved`);
  assert.deepEqual(ungated, [], 'A web-only offer is drawn on the Papic page with nothing asking `appleIap`:\n  ' + ungated.join('\n  '));
  // Every part handed the gate — the credits band draws Add more as Apple's sheet there.
  for (const mount of ['<StatusBanners', '<PapicTopBand']) {
    const at = src.indexOf(mount);
    assert.ok(at > 0, `${mount} moved`);
    assert.match(src.slice(at, src.indexOf('/>', at)), /appleIap=\{appleIap\}|apple=\{appleIap\}/, `${mount} is not handed the gate`);
  }
  // 🗂 The files' web-only offers moved to the Memories ⚙ sheet with the files — gated there.
  const sheet = code('app/dashboard/[eventId]/memories/_components/memories-settings.tsx');
  assert.match(sheet, /\{appleIap \? null : \(/, 'Keep full-res is drawn in the app');
  assert.ok(asksAppleIap(sheet, sheet.indexOf('<InlineCheckoutDrawer')), 'the Keep full-res checkout is drawn in the app');
  assert.match(sheet, /<LiveWallCard eventId=\{eventId\} appleIap=\{appleIap\}/, 'the photo wall is not handed the gate');
  assert.match(code('app/dashboard/[eventId]/memories/page.tsx'), /appleIap=\{appleIap\}/, 'Memories does not hand its sheet the gate');
  assert.match(code('app/dashboard/[eventId]/studio/papic/_components/live-wall-card.tsx'), /if \(appleIap\) return null;/);
});

test('3 · GATE ON — Buy more on the Papic page is Apple\'s sheet; GATE OFF — the web\'s, unchanged', async () => {
  const { PapicTopBand } = await import('@/app/dashboard/[eventId]/studio/papic/_components/papic-top-band');
  const glance = { mood: 'ok', count: 320, total: 500, photos: 12, onFrom: null, phase: 'on', status: '320', pct: 64, buy: true } as never;
  const draw = (apple: boolean) => renderToStaticMarkup(React.createElement(PapicTopBand, { eventId: E, glance, canBuy: true, apple }));
  const web = draw(false);
  assert.match(web, /data-testid="papic-buy-more"/, 'premise: the web band draws the web sheet');
  assert.doesNotMatch(web, /iap-papic-buy-more/, 'the web band drew Apple');
  const app = draw(true);
  assert.match(app, /data-testid="iap-papic-buy-more"/, 'the app band does not draw Apple\'s sheet');
  assert.doesNotMatch(app, /data-testid="papic-buy-more"/, 'the app band draws the web sheet (₱ · GCash · /pay)');
  // Absent = the web's (every caller that does not know).
  assert.match(renderToStaticMarkup(React.createElement(PapicTopBand, { eventId: E, glance, canBuy: true })), /data-testid="papic-buy-more"/);
});

/* ═══ 4 · THE LIVE WATCH CONTROLLER — the Go live door of an OWNED Live Watch ═══ */

test('4 · in the app the controller opens only for an owned Live Watch, reads no web price, and exits Home', () => {
  const src = code(CONTROLLER);
  assert.match(src, /const appleIap = \(await getIapGate\(\)\)\.iap;/);
  assert.match(src, /const sku = appleIap \? null : await formatV2Sku\(LIVE_STUDIO_SKU\)/, 'the app reads the web price');
  const owned = src.indexOf('const owned = broadcastWindow.multiCam;');
  const turnAway = src.indexOf('if (appleIap && !owned) redirect(`/dashboard/${eventId}`);');
  const lock = src.indexOf('const lock = liveStudioControlLock(');
  assert.ok(owned > 0 && turnAway > owned && lock > turnAway, 'a not-owned event reaches the unlock surfaces in the app');
  assert.match(src, /const exitHref = appleIap \? `\/dashboard\/\$\{eventId\}` : detailHref;/);
  assert.match(src, /href=\{exitHref\}/, 'Exit still goes to the web buy page');
  assert.match(src, /poolOnlyConnectNotice\(ownsHostedChannel, appleIap\)/);
  // The hosted channel is a web extra Apple does not sell: the app's notice does not offer it.
  assert.doesNotMatch(POOL_ONLY_APP_NOTICE, /hosted channel|Add the|Rather have/i);
  assert.ok(POOL_ONLY_APP_NOTICE.length > 40 && POOL_ONLY_DEFAULT_NOTICE.startsWith(POOL_ONLY_APP_NOTICE), 'the app notice is not the default\'s own first sentences');
  assert.equal(poolOnlyConnectNotice(false), POOL_ONLY_DEFAULT_NOTICE, 'gate off: the web\'s notice, unchanged');
  assert.equal(poolOnlyConnectNotice(false, true), POOL_ONLY_APP_NOTICE);
});

/* ═══ 5 · PRO IN HERO · REVEAL · LOGO · OUR STORY — tried where the editor's rows are ═══ */

test('5 · the made-once panels and Our Story try Pro by `proShell` — which IS `storeShell` with the gate off', () => {
  const made = code('app/dashboard/[eventId]/launch/_components/maker-made-once.tsx');
  // Each panel defaults `proShell` to `storeShell`: a caller that does not know gets the store shell's old rule.
  assert.equal((made.match(/proShell = storeShell,/g) ?? []).length, 3, 'a made-once panel lost its gate-off default');
  assert.match(made, /const canUpload = ownsPro \|\| !proShell;/);
  assert.match(made, /proShell && !ownsPro \? \[\] : openings/);
  assert.match(made, /motionMark=\{makerProMark\(\{ owns: ownsMotion, storeShell: proShell \}\)\}/);
  // The tour still asks the store shell (a tour slide that sells stays dropped in the app).
  assert.match(made, /<MiniTour tourKey="customer_hero_designs_v1" storeShell=\{storeShell\} \/>/);
  const editor = code('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(editor, /const proShell = storeShell && !iapGate\.iap;/, 'premise: the editor\'s own rule (#6637)');
  // Hero · Reveal (settings) · Reveal (options) · Logo.
  assert.equal((editor.match(/<Maker(?:Hero|Reveal|Logo)Panel[^>]*?proShell=\{proShell\}/g) ?? []).length, 4, 'a made-once panel is not handed the editor\'s proShell');
  const story = code('app/dashboard/[eventId]/website/our-story/page.tsx');
  assert.match(story, /const proShell = storeShell && !iapGate\.iap;/);
  assert.match(story, /makerProUsable\(\{ owns: proActive, storeShell: proShell \}\)/);
  // Prices and the Pro link still key on the store shell — never on proShell.
  assert.match(story, /const proPrice = !storeShell && proSku\?\.price_php != null/);
});

test('5 · Our Story: the ◆ mark shows where Pro is tried in the app; gate off the app is unchanged', async () => {
  const { LoveStoryBook } = await import('@/app/dashboard/[eventId]/website/our-story/_components/love-story-book');
  const m = (id: string, y: number) => ({ id, date: { y }, line: `The words of ${id}`, canvas: {} });
  const base = {
    eventId: 'E1',
    names: 'Ana & Miguel',
    partners: ['Ana', 'Miguel'],
    eyebrow: '14 Feb 2027',
    moments: [m('a', 2019), m('b', 2020)],
    since: 2019,
    daysToTheDay: 120,
    themeName: 'Vintage',
    motionLabel: 'Calm',
    makerHref: '/dashboard/E1/launch',
    guestHref: null,
    proHref: '/dashboard/E1/studio/website-pro',
    proPrice: null,
    refused: null,
    sectionHidden: false,
    mediaUrls: {},
    action: () => {},
    pickSlot: null,
  };
  const draw = (o: Record<string, unknown>) => renderToStaticMarkup(React.createElement(LoveStoryBook, { ...base, ...o } as never));
  // Gate off, in the app: a free couple keeps the free cap's words, no mark (proUsable false there).
  const off = draw({ storeShell: true, ownsPro: false, tryingPro: false });
  assert.match(off, /stories, in your words, are free\./);
  assert.doesNotMatch(off, /try it here; Apply asks/);
  // Gate on: Pro is tried — the mark says so, and the page never claims Pro is theirs.
  const on = draw({ storeShell: true, ownsPro: true, tryingPro: true, appleIap: true });
  assert.match(on, /try it here; Apply asks for it/, 'the app tries Pro with no ◆ mark');
  assert.doesNotMatch(on, /Add as many moments as you like/, 'the app tells a non-Pro couple Pro is theirs');
  assert.doesNotMatch(on, /website-pro|₱/, 'a web Pro link or price in the app');
});

/* ═══ 6 · THE FIVE MORE (owner 2026-10-23) — each page's ONE pay step is Apple's sheet, only where Apple sells ═══ */

const STUDIO = 'app/dashboard/[eventId]/studio';
const DOORS: Array<[file: string, gate: RegExp[]]> = [
  [
    `${STUDIO}/setnayan-ai/page.tsx`,
    [
      /const appleIap = \(await getIapGate\(\)\)\.iap;/,
      /const appleTier = appleIap && paywallOn \? await setnayanAiTierInApp\(createAdminClient\(\), eventId\) : null;/,
      /const appleSells = appleProduct !== null;/,
      // A paid Sai — bought, owned or for sale — is shown in the app only where Apple sells this event's tier.
      /if \(appleIap && paywallOn && !appleSells\) redirect\(`\/dashboard\/\$\{eventId\}`\);/,
      /price=\{pricePhp != null && !appleIap \? priceLabel : undefined\}/,
      /appleProduct && showBuy \? \(\s*<IapUnlockSheet\b/,
      /const settings = showBuy && !appleIap \?/,
    ],
  ],
  [`${STUDIO}/pakanta/page.tsx`, [/const appleIap = \(await getIapGate\(\)\)\.iap;/, /const skuRecord = appleIap \? null :/]],
  [
    `${STUDIO}/pakanta/_components/pakanta-music-form.tsx`,
    [/readyToPay && apple \? \(\s*<IapUnlockSheet\b/, /readyToPay && apple && !appleOnSale \? \(/, /const priceSuffix = !apple && pricePhp != null \?/, /\{apple \? 'Continue' : `Continue to payment\$\{priceSuffix\}`\}/],
  ],
  [
    `${STUDIO}/patiktok/page.tsx`,
    [
      /const appleIap = \(await getIapGate\(\)\)\.iap;/,
      /const saveCardMounted = !patiktokActive && \(!storeShell \|\| appleIap\);/,
      /pricePhp=\{appleIap \? null : pricePhp\}/,
      /\) : apple \? \(\s*<div className="pt-1">\s*<IapUnlockSheet\b/,
      /\) : apple && !appleOnSale \? \(/,
      /const settings = storeShell \? STORE_SHELL_NO_PAY_SETTINGS : await fetchPlatformSettings\(supabase\);/,
      /<p data-web-only="" className="text-xs text-ink\/55">\s*Need a custom reel template\?/,
    ],
  ],
  [
    `${STUDIO}/thank-you/page.tsx`,
    [/const appleIap = \(await getIapGate\(\)\)\.iap;/, /if \(!owned && appleIap\) \{/, /settings: STORE_SHELL_NO_PAY_SETTINGS,\s*apple: sellability === 'sellable',/],
  ],
  [`${STUDIO}/thank-you/_components/thank-you-maker.tsx`, [/if \(checkout\.apple\) \{\s*return \(\s*<div className="space-y-2">\s*<IapUnlockSheet\b/]],
  [
    `${STUDIO}/mood-board/_components/mood-board-editor.tsx`,
    [/const appleIap = storeShell && \(await getIapGate\(\)\)\.iap;/, /const makeItReal = storeShell && !appleIap \? null : \(\s*<MakeItReal\s+apple=\{appleIap\}/],
  ],
  [`${STUDIO}/mood-board/_components/make-it-real.tsx`, [/\{apple \? \(\s*mayStartRenders && !configUnavailable && appleOnSale \? \(\s*<IapUnlockSheet\b/, /\$\{apple \? '' : ' Payment is verified by hand/]],
];

test('6 · the five doors: each page reads the one gate, and Apple’s sheet is mounted only inside it', () => {
  for (const [file, gates] of DOORS) {
    const src = code(file);
    for (const re of gates) assert.match(src, re, `${file}: ${re}`);
  }
  // Every IapUnlockSheet mount in the product is one of these (the /dev lab aside) — a new mount is a new decision.
  const mounts = DOORS.map(([f]) => f).filter((f) => /<IapUnlockSheet\b/.test(code(f)));
  assert.deepEqual(mounts.sort(), [
    `${STUDIO}/mood-board/_components/make-it-real.tsx`,
    `${STUDIO}/pakanta/_components/pakanta-music-form.tsx`,
    `${STUDIO}/patiktok/page.tsx`,
    `${STUDIO}/setnayan-ai/page.tsx`,
    `${STUDIO}/thank-you/_components/thank-you-maker.tsx`,
  ]);
  // GATE OFF: with `apple` false each component takes the web branch it always took.
  assert.match(code(`${STUDIO}/pakanta/_components/pakanta-music-form.tsx`), /\) : readyToPay && pricePhp != null \? \(\s*<InlineCheckoutDrawer\b/);
  assert.match(code(`${STUDIO}/mood-board/_components/make-it-real.tsx`), /\) : packPlan && mayStartRenders \? \(\s*<ChoosePlanSheet\b/);
});

test('6 · a Setnayan AI bought on the web or in the app lights up in the app only where Apple sells THIS EVENT’S TIER', async () => {
  const { storeShellAllowsPaidFeature } = await import('./store-shell');
  assert.equal(storeShellAllowsPaidFeature(true, true), false, 'gate off: as before — no web-bought Sai in the app');
  assert.equal(storeShellAllowsPaidFeature(true, true, false), false);
  assert.equal(storeShellAllowsPaidFeature(true, true, true), true, 'gate on: Sai is sold by Apple here, so it is usable');
  assert.equal(storeShellAllowsPaidFeature(false, true), true, 'the web: unchanged');
  const vendors = code('app/dashboard/[eventId]/vendors/page.tsx');
  assert.match(vendors, /const appleIap = storeShell && \(await appleIapRead\) === true;/);
  assert.match(vendors, /const appleSai = appleIap && paywallEnabled && \(await setnayanAiTierInApp\(createAdminClient\(\), eventId\)\)\.status === 'sellable';/);
  assert.match(vendors, /storeShellAllowsPaidFeature\(storeShell, paywallEnabled, appleSai\)/, 'the Suppliers page lights Sai without asking the tier');
  assert.match(vendors, /\(!storeShell \|\| appleSai\);/, 'the Sai banner shows in the app for an event Apple does not sell');
  assert.match(
    code('app/dashboard/[eventId]/_components/event-dashboard.tsx'),
    /storeShellAllowsPaidFeature\(\s*storeShell,\s*aiPaywallEnabled,[^;]*storeShell && aiPaywallEnabled && \(await appleIapRead\) === true &&\s*\(await setnayanAiTierInApp\(createAdminClient\(\), eventId\)\)\.status === 'sellable',\s*\)/,
    'the dashboard lights Sai without asking the tier',
  );
});
