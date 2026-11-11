/**
 * GUARD — THE FRONT-DOOR RAIL LISTS NO TOOLS (owner 2026-10-01, built 2026-10-23).
 *
 * DECISION_LOG 2026-10-01: "THE SIGNED-OUT FRONT DOOR STOPS LISTING EVERY FEATURE IN
 * THE SIDEBAR — ONE "FEATURES" PAGE SHOWS THEM" and "THE SIGNED-IN SIDEBAR ALSO DROPS
 * THE PLANNER · TOGETHER · STUDIO FEATURE LISTS". Owner, 23 Oct, on live prod: *"why
 * do i see so many menu. this is supposed to change already?"*
 *
 *   signed out  Discover · Find suppliers · For suppliers · For coordinators · Features · Sign in  (2026-11-11)
 *   signed in   Discover · Events · People · (shop) · Memories · (HQ) · Features  (My Home order: 2026-11-11)
 *
 * 🔑 A PROPERTY, NOT A PHRASING. The shell is RENDERED — signed in and out, on the
 * front door, a doorway and the app, with and without a shop and HQ — and the rail's
 * real links are read back. The guard fails when any rail row opens a TOOL's page
 * (every product in `STUDIO_APPS`, the in-app tool rows that used to sit in Builder ·
 * Together, every /features "Try it"), whatever the row is called or however it is
 * gated; and when the one Features row is missing or doubled. The small print is not
 * a menu and is left out. Inside an event the rail is focused and draws the event's
 * own menu (`railContext`), which this guard does not hand it — the in-event tool
 * rows are a separate, unchanged question.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

import { STUDIO_APPS } from '@/lib/studio-apps';
import { FEATURE_PAGES } from '@/lib/feature-pages';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only' || /\.css$/.test(request)) return {};
    return load.call(this, request, ...rest);
  };
}

const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

type Who = { signedIn: boolean; shopName: string | null; isAdmin: boolean };

async function railMenu(variant: 'front-door' | 'app' | 'doorway', who: Who, pathname: string): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { PathnameContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime');
  const { FrontDoorShell } = await import('./front-door-shell');
  const shell = React.createElement(
    FrontDoorShell,
    {
      variant,
      account: { initials: 'AM', ...who },
      navLabels: {},
    } as unknown as React.ComponentProps<typeof FrontDoorShell>,
    React.createElement('div', null, 'page'),
  );
  const html = renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(PathnameContext.Provider, { value: pathname }, shell),
    ),
  );
  const at = html.indexOf('id="fd-sections-rail"');
  assert.ok(at > 0, 'the shell painted no rail — this guard is reading the wrong markup');
  const nav = html.slice(at, html.indexOf('</nav>', at));
  // The small print (About · Pricing · Help · policies …) is not a menu.
  return nav.slice(0, nav.indexOf('class="fd-smallprint"'));
}

async function rail(variant: 'front-door' | 'app' | 'doorway', who: Who, pathname: string): Promise<string[]> {
  const menu = await railMenu(variant, who, pathname);
  return [...menu.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]!.split('?')[0]!);
}

/** Each rail row as { href, label } — the label is the row's `.fd-label-text`. */
async function railRows(
  variant: 'front-door' | 'app' | 'doorway',
  who: Who,
  pathname: string,
): Promise<{ href: string; label: string }[]> {
  const menu = await railMenu(variant, who, pathname);
  return [...menu.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({
    href: m[1]!.split('?')[0]!,
    label: (/class="fd-label-text"[^>]*>([^<]*)</.exec(m[2] ?? '')?.[1] ?? '').trim(),
  }));
}

/** Every page a TOOL lives on — the doors that left the menu for /features. */
const TOOL_PAGES = new Set<string>([
  ...STUDIO_APPS.map((a) => a.href),
  // The in-app rows the retired Builder · Together groups carried.
  '/dashboard/samahan',
  '/explore/compare',
  // Every /features "Try it", except the Marketplace's, which is the ruled "Find
  // suppliers" row (signed out only — asserted below).
  ...FEATURE_PAGES.map((f) => f.tryHref).filter((h): h is NonNullable<typeof h> => !!h && h !== '/explore'),
]);

const STATES: ReadonlyArray<[string, 'front-door' | 'app' | 'doorway', Who, string]> = [
  ['signed out · /', 'front-door', { signedIn: false, shopName: null, isAdmin: false }, '/'],
  ['signed out · a doorway', 'doorway', { signedIn: false, shopName: null, isAdmin: false }, '/papic'],
  ['signed in · /', 'front-door', { signedIn: true, shopName: null, isAdmin: false }, '/'],
  ['signed in · the board', 'app', { signedIn: true, shopName: null, isAdmin: false }, '/dashboard'],
  ['signed in · shop + HQ · account', 'app', { signedIn: true, shopName: 'Lab Florals', isAdmin: true }, '/dashboard/profile'],
  ['signed in · a doorway', 'doorway', { signedIn: true, shopName: 'Lab Florals', isAdmin: false }, '/features'],
];

test('no rail row opens a tool — signed in or out, on every variant', async () => {
  assert.ok(TOOL_PAGES.size >= 15, `only ${TOOL_PAGES.size} tool pages known — the list went blind`);
  let rows = 0;
  for (const [what, variant, who, path] of STATES) {
    const links = await rail(variant, who, path);
    rows += links.length;
    const tools = links.filter((h) => TOOL_PAGES.has(h));
    assert.deepEqual(
      tools,
      [],
      `${what}: the rail lists tools again (${tools.join(', ')}). The owner ruled the Planner · ` +
        'Builder · Together · Studio lists off the menu (2026-10-01) — every tool is on /features.',
    );
    // ONE Features row. Counted by the row's NAME, not its href. (Until 2026-11-11 a signed-out
    // "How it works" row also opened /features; the owner removed it — asserted below.)
    const features = (await railRows(variant, who, path)).filter((r) => r.label === 'Features');
    assert.equal(
      features.length,
      1,
      `${what}: the rail must carry exactly ONE Features row; saw ${links.join(' · ')}`,
    );
    assert.equal(features[0]!.href, '/features', `${what}: the Features row must open /features`);
  }
  assert.ok(rows >= 25, `only ${rows} rail links read across ${STATES.length} renders — the read is wrong`);
});

test('signed out the rail is the five rows the owner named, in his order, then Sign in', async () => {
  // 🔄 2026-11-11 (owner, "Yes, all four" — DECISION_LOG "THE SIGNED-OUT SIDEBAR = DISCOVER · FIND SUPPLIERS · FOR
  // SUPPLIERS · FOR COORDINATORS · FEATURES · SIGN IN"): "How it works" left (it opened /features, the Features
  // row's page) and "For coordinators" moved up from the small print, right under "For suppliers". Five rows.
  for (const [variant, path] of [['front-door', '/'], ['doorway', '/papic']] as const) {
    const links = await rail(variant, { signedIn: false, shopName: null, isAdmin: false }, path);
    assert.deepEqual(
      links,
      ['/', '/explore', '/for-suppliers', '/for-coordinators', '/features', '/login'],
      `${variant}: signed out = Discover · Find suppliers · For suppliers · For coordinators · Features · Sign in ` +
        '(owner 2026-11-11; For suppliers under Find suppliers 2026-11-06)',
    );
    const rows = await railRows(variant, { signedIn: false, shopName: null, isAdmin: false }, path);
    assert.deepEqual(
      rows.filter((r) => r.label).map((r) => r.label),
      ['Discover', 'Find suppliers', 'For suppliers', 'For coordinators', 'Features'],
      `${variant}: the five signed-out rows, by name and in order`,
    );
  }
});

test('signed out, "For suppliers" is a row right under "Find suppliers" — not in the small print (owner 2026-11-06)', async () => {
  for (const [variant, path] of [['front-door', '/'], ['doorway', '/papic']] as const) {
    const rows = await railRows(variant, { signedIn: false, shopName: null, isAdmin: false }, path);
    const find = rows.findIndex((r) => r.label === 'Find suppliers');
    assert.ok(find > -1, `${variant}: the signed-out rail lost its "Find suppliers" row`);
    assert.deepEqual(
      rows[find + 1],
      { href: '/for-suppliers', label: 'For suppliers' },
      `${variant}: the row right under "Find suppliers" must be "For suppliers" → /for-suppliers`,
    );
  }
  // Moved, not copied: one door, so the legal links no longer carry it.
  const src = (await import('node:fs')).readFileSync(new URL('./front-door-shell.tsx', import.meta.url), 'utf8');
  const smallPrint = src.slice(src.indexOf('className="fd-smallprint"'), src.indexOf('className="fd-copy"'));
  assert.ok(smallPrint.length > 0, 'the small print block moved — re-anchor this read');
  assert.doesNotMatch(smallPrint, /href="\/for-suppliers"/, '"For suppliers" is back among the legal links');
  // Signed in it is not a rail row (your shop is the shop row).
  const signedIn = await rail('app', { signedIn: true, shopName: null, isAdmin: false }, '/dashboard');
  assert.ok(!signedIn.includes('/for-suppliers'), 'signed in, "For suppliers" is not a rail row');
});

test('signed out, there is no "How it works" row — Features is the one door to /features (owner 2026-11-11)', async () => {
  // 🔄 Was: '"How it works" opens the Features hub' (owner 2026-10-25). The owner removed the ROW on 2026-11-11 because
  // it opened the same page as the Features row; the front-door HERO keeps its own "How it works" link
  // (the-front-door-tells-the-truth.test.ts 4c still pins that one).
  for (const [variant, path] of [['front-door', '/'], ['doorway', '/papic']] as const) {
    const menu = await railMenu(variant, { signedIn: false, shopName: null, isAdmin: false }, path);
    assert.doesNotMatch(menu, /How it works/, `${variant}: the signed-out rail draws "How it works" again`);
    const toFeatures = (await rail(variant, { signedIn: false, shopName: null, isAdmin: false }, path)).filter(
      (h) => h === '/features',
    );
    assert.equal(toFeatures.length, 1, `${variant}: the rail opens /features from ${toFeatures.length} rows, not one`);
  }
});

test('signed out, "For coordinators" is a web-only row right under "For suppliers", with an icon (owner 2026-11-11)', async () => {
  for (const [variant, path] of [['front-door', '/'], ['doorway', '/papic']] as const) {
    const rows = await railRows(variant, { signedIn: false, shopName: null, isAdmin: false }, path);
    const sup = rows.findIndex((r) => r.label === 'For suppliers');
    assert.ok(sup > -1, `${variant}: the signed-out rail lost its "For suppliers" row`);
    assert.deepEqual(
      rows[sup + 1],
      { href: '/for-coordinators', label: 'For coordinators' },
      `${variant}: the row right under "For suppliers" must be "For coordinators" → /for-coordinators`,
    );
    const menu = await railMenu(variant, { signedIn: false, shopName: null, isAdmin: false }, path);
    const a = /<a\b[^>]*\bhref="\/for-coordinators"[^>]*>([\s\S]*?)<\/a>/.exec(menu);
    assert.ok(a, `${variant}: no /for-coordinators row`);
    assert.match(a[0], /data-web-only=""/, `${variant}: the row is shown in the iPhone app — it shows plan prices`);
    assert.match(a[1]!, /class="fd-gi"[^>]*><svg\b/, `${variant}: the row draws no icon`);
    assert.match(a[1]!, /class="fd-icon-caption"/, `${variant}: the collapsed rail has no caption for the row`);
  }
  const signedIn = await rail('app', { signedIn: true, shopName: null, isAdmin: false }, '/dashboard');
  assert.ok(!signedIn.includes('/for-coordinators'), 'signed in, "For coordinators" is not a rail row');
});

/** The rendered small print, from its opening tag to the © line. */
async function smallPrint(variant: 'front-door' | 'app' | 'doorway', who: Who, pathname: string): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { PathnameContext } = await import('next/dist/shared/lib/hooks-client-context.shared-runtime');
  const { FrontDoorShell } = await import('./front-door-shell');
  const html = renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(
        PathnameContext.Provider,
        { value: pathname },
        React.createElement(
          FrontDoorShell,
          { variant, account: { initials: 'AM', ...who }, navLabels: {} } as unknown as React.ComponentProps<
            typeof FrontDoorShell
          >,
          React.createElement('div', null, 'page'),
        ),
      ),
    ),
  );
  const at = html.indexOf('class="fd-smallprint"');
  assert.ok(at > 0, 'the shell painted no small print');
  return html.slice(at, html.indexOf('class="fd-copy"', at));
}

test('the small print is two labelled columns — Company and Legal, one link each, signed in and out (owner 2026-11-11)', async () => {
  const COMPANY = ['About /about', 'Pricing /pricing', 'Help /help', 'Articles /blog', 'Download /download'];
  const LEGAL = ['Terms /terms', 'Privacy /privacy', 'Acceptable use /acceptable-use', 'Cookies /cookies', 'Refunds /refunds'];
  for (const [what, variant, who, path] of STATES) {
    const sp = await smallPrint(variant, who, path);
    const cols = [...sp.matchAll(/<div class="fd-sp-col" role="group" aria-label="([^"]+)">([\s\S]*?)<\/div>/g)];
    assert.deepEqual(cols.map((c) => c[1]), ['Company', 'Legal'], `${what}: the small print is not the two columns`);
    const links = (body: string) =>
      [...body.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([^<]*)<\/a>/g)].map((m) => `${m[2]!.trim()} ${m[1]}`);
    assert.deepEqual(links(cols[0]![2]!), COMPANY, `${what}: the Company column`);
    assert.deepEqual(links(cols[1]![2]!), LEGAL, `${what}: the Legal column`);
    for (const [i, name] of [[0, 'Company'], [1, 'Legal']] as const) {
      assert.match(cols[i]![2]!, new RegExp(`class="fd-sp-h"[^>]*>${name}<`), `${what}: the ${name} heading is gone`);
    }
    // Moved or retired, not copied: none of these is in the small print any more.
    for (const gone of ['/open-shop', '/creators', '/for-coordinators', '/for-suppliers']) {
      assert.ok(!sp.includes(`href="${gone}"`), `${what}: ${gone} is back in the small print`);
    }
  }
});


test('signed in the rail is your own rows and one Features row — no find row', async () => {
  // 🏠 HOME IS THE PROFILE (owner 11 Nov 2026): Home · Discover, in the bar's order — Home's sections (Events · People ·
  // Shop · Memories) are small doors under the Home row — then the fine print: HQ for an admin, and Features.
  const rows = await railRows('app', { signedIn: true, shopName: 'Lab Florals', isAdmin: true }, '/dashboard');
  assert.deepEqual(
    rows.map((r) => `${r.label} ${r.href}`),
    [
      'Home /dashboard',
      'Events /dashboard',
      'People /dashboard',
      'Shop /dashboard',
      'Memories /dashboard',
      'Discover /',
      'Setnayan HQ /admin',
      'Features /features',
    ],
    'signed in = Home (Events · People · Shop · Memories) · Discover · HQ · Features (owner 11 Nov 2026, "HOME IS THE PROFILE")',
  );
  const links = await rail('app', { signedIn: true, shopName: 'Lab Florals', isAdmin: true }, '/dashboard');
  assert.ok(!links.includes('/explore'), 'a signed-in rail grew a find row again');
});
