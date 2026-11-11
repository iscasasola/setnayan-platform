/**
 * GUARD — THE FRONT-DOOR RAIL LISTS NO TOOLS (owner 2026-10-01, built 2026-10-23).
 *
 * DECISION_LOG 2026-10-01: "THE SIGNED-OUT FRONT DOOR STOPS LISTING EVERY FEATURE IN
 * THE SIDEBAR — ONE "FEATURES" PAGE SHOWS THEM" and "THE SIGNED-IN SIDEBAR ALSO DROPS
 * THE PLANNER · TOGETHER · STUDIO FEATURE LISTS". Owner, 23 Oct, on live prod: *"why
 * do i see so many menu. this is supposed to change already?"*
 *
 *   signed out  Discover · Find suppliers · For suppliers · Features · How it works · Sign in
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
    // ONE Features row. Counted by the row's NAME, not its href: signed out, "How it works"
    // also opens /features (owner 2026-10-25), and that is one door to one page, not a second row.
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

test('signed out the rail is the six things the owner named, in his order', async () => {
  const links = await rail('front-door', { signedIn: false, shopName: null, isAdmin: false }, '/');
  assert.deepEqual(
    links,
    ['/', '/explore', '/for-suppliers', '/features', '/features', '/login'],
    'signed out = Discover · Find suppliers · For suppliers · Features · How it works · Sign in (owner 2026-10-01; ' +
      'How it works opens the Features hub 2026-10-25; For suppliers right under Find suppliers 2026-11-06)',
  );
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

test('signed out, "How it works" opens the Features hub, the same door as the hero (owner 2026-10-25)', async () => {
  for (const [variant, path] of [['front-door', '/'], ['doorway', '/papic']] as const) {
    const how = (await railRows(variant, { signedIn: false, shopName: null, isAdmin: false }, path)).filter(
      (r) => r.label === 'How it works',
    );
    assert.equal(how.length, 1, `${variant}: the signed-out rail lost its "How it works" row`);
    assert.equal(how[0]!.href, '/features', `${variant}: "How it works" opens ${how[0]!.href}, not /features`);
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
