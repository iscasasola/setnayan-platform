/**
 * the-account-bar-is-the-ruling.test.ts — the account-level phone bar draws
 * exactly the owner's tabs, for every kind of account, on every shell.
 *
 * 🏠 RE-RULED 11 Nov 2026 — HOME · DISCOVER (owner, "One profile page approve"; DECISION_LOG "HOME PAGE v3 APPROVED"):
 * Events · People · Shop · Memories left the bar to become the sections of Home. The history below is kept so nobody
 * re-applies it from this file.
 *
 * Owner, 21 Oct 2026, "yes to all" to the controller's four recommendations on
 * `Setnayan/prototypes/account_bottom_bar_2026-10-21.html` (DECISION_LOG
 * 2026-10-21 "THE ACCOUNT BAR — EVENTS · DISCOVER · MEMORIES · PEOPLE"):
 *
 *   · Events · Discover · Memories · People — four for everyone;
 *   · Shop is a fifth tab ONLY for an account that owns a shop;
 *   · 🔁 THE ORDER, RE-RULED 11 Nov 2026 (owner, verbatim: *"arrangement of use
 *     dashboard should be Events - People - Shop - Memories - Discover"* —
 *     DECISION_LOG 2026-11-11 "THE ACCOUNT BAR ORDER"): Events · People · Shop ·
 *     Memories · Discover. Which tabs, and for whom, is unchanged; Shop and
 *     Discover keep their ruled places when drawn and leave no gap when not;
 *   · Admin is never a tab; there is no floating ＋ Create;
 *   · Discover is a tab wherever `/` OPENS — and since the owner's 2026-11-02
 *     ruling ("let everything go live", DECISION_LOG "EVERY PAGE HELD BACK FROM
 *     THE APP FOR APPLE GOES LIVE IN THE APP TOO") that is the phone and desktop
 *     apps too, so the app draws the same four tabs as the web. (While Apple
 *     reviewed 1.0 middleware bounced `/` out of the app and the app drew three.)
 *   · the app's mark goes to Events (pinned in seam-invariants.test.ts);
 *   · the word "Setnayan" beside the mark on these screens.
 *
 * 🔑 A PROPERTY, NOT A PHRASING. The bar is RENDERED (the real component, the
 * real tab rule the layouts call) for every combination of the facts that
 * decide it, and the drawn tabs are read out of the markup. Nothing here
 * re-types the rule beside the bar.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AccountBottomNav } from './_components/account-bottom-nav';
import { accountBarTabs } from '@/lib/account-bar';
import { stripComments } from '@/lib/strip-comments';
import { isStoreShellWebOnlyPath } from '@/lib/store-shell';
import { TOURS } from '@/lib/tours';

// tsconfig's `"jsx": "preserve"` → classic runtime under tsx (precedent:
// the-phone-bar-is-anchored.test.ts).
(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

type Facts = { hasVendor: boolean; canOpenShop: boolean; isAdmin: boolean; discoverOpen: boolean };

/** The bar a layout draws for these facts — the layouts' own expression, rendered. */
function drawn(f: Facts): { labels: string[]; hrefs: string[]; html: string } {
  const tabs = accountBarTabs({ discoverOpen: f.discoverOpen });
  const html = renderToStaticMarkup(createElement(AccountBottomNav, { tabs }));
  const cells = [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>[\s\S]*?<span class="line-clamp-2[^"]*"[^>]*>([^<]*)<\/span>/g)];
  return { labels: cells.map((m) => m[2]!), hrefs: cells.map((m) => m[1]!.replace(/&amp;/g, '&')), html };
}

const COUPLE = { hasVendor: false, canOpenShop: true, isAdmin: false };
const OWNER = { hasVendor: true, canOpenShop: false, isAdmin: false };
const TEAM_MEMBER = { hasVendor: true, canOpenShop: true, isAdmin: false };
const INTERNAL = { hasVendor: false, canOpenShop: true, isAdmin: true };

// 🏠 RE-RULED 11 Nov 2026 (owner, "One profile page approve" — DECISION_LOG "HOME PAGE v3 APPROVED"): the bar is
// **Home · Discover** for EVERY account. Events · People · Shop · Memories are Home's sections (`lib/home-segments.ts`),
// Shop still only for an owner — as a section, never a tab. Discover is drawn only where `/` opens, as before.
const ALL_FACTS = [COUPLE, OWNER, TEAM_MEMBER, INTERNAL];

test('📱 every account gets Home · Discover — a shop owner, a team member and an internal account alike', () => {
  for (const f of ALL_FACTS) assert.deepEqual(drawn({ ...f, discoverOpen: true }).labels, ['Home', 'Discover']);
});

test('📲 a shell that refused `/` would drop only the Discover tab', () => {
  for (const f of ALL_FACTS) assert.deepEqual(drawn({ ...f, discoverOpen: false }).labels, ['Home']);
});

test('the bar grid has exactly one column per tab it draws (no blank slot)', () => {
  for (const f of [
    { ...COUPLE, discoverOpen: false },
    { ...COUPLE, discoverOpen: true },
    { ...OWNER, discoverOpen: true },
  ]) {
    const { labels, html } = drawn(f);
    const cols = /grid-template-columns:repeat\((\d+), minmax\(0, 1fr\)\)/.exec(html);
    assert.ok(cols, 'the bar no longer declares its column count — this guard cannot read the grid');
    assert.equal(Number(cols[1]), labels.length);
  }
});

test('every door is an existing one — Home keeps ?hub=1 — and none is a section, Admin or a floating Create', () => {
  const doors = new Set(['/dashboard?hub=1', '/']);
  let combos = 0;
  for (const hasVendor of [false, true])
    for (const canOpenShop of [false, true])
      for (const isAdmin of [false, true])
        for (const discoverOpen of [false, true]) {
          combos++;
          const { labels, hrefs, html } = drawn({ hasVendor, canOpenShop, isAdmin, discoverOpen });
          for (const h of hrefs) assert.ok(doors.has(h), `the bar links to ${h}, which is not one of the ruled doors`);
          assert.ok(!labels.some((l) => /^(events|people|shop|memories|admin|hq|spaces)$/i.test(l)), `a section or forbidden tab word: ${labels.join(' · ')}`);
          assert.ok(!/create-event/.test(html), 'a Create control is back in the bar — Create lives on Home');
          assert.equal(hrefs[0], '/dashboard?hub=1', 'Home is the first tab, and keeps ?hub=1 (no auto-jump)');
          assert.deepEqual(labels, discoverOpen ? ['Home', 'Discover'] : ['Home'], 'the bar reads Home · Discover, in that order');
        }
  assert.equal(combos, 16);
});

test('🔦 the account-bar tour walks the bar\'s tabs in the bar\'s own order, and lights Home\'s sections', () => {
  const { hrefs } = drawn({ ...OWNER, discoverOpen: true });
  const barTokens = hrefs.map((h) => `tab-${h.split('?')[0]!.split('/').filter(Boolean).at(-1) ?? ''}`);
  const anchors = TOURS.customer_account_bar_v2.spotlight!.steps.map((s) => s.anchor);
  const tourTabs = anchors.filter((a) => a.startsWith('tab-'));
  assert.deepEqual(tourTabs, barTokens, `the tour walks ${tourTabs.join(' → ')}, the bar is ${barTokens.join(' · ')}`);
  assert.ok(anchors.includes('home-segments'), 'the tour no longer shows where the sections went');
  assert.match(src('app/dashboard/(launcher)/_components/home-segment-bar.tsx'), /data-tour="home-segments"/, 'the sections row lost its tour anchor');
});

test('the slot loads the bar in its own chunk, server-rendered', () => {
  const slot = src('app/dashboard/(launcher)/_components/account-bar-slot.tsx');
  assert.match(slot, /dynamic\(\(\) => import\('\.\/account-bottom-nav'\)/, 'the slot no longer loads the bar as its own chunk');
  assert.ok(!/ssr:\s*false/.test(slot), 'the bar must stay in the first paint (server-rendered)');
});

test('anchored: the bar is the canonical <BottomNav> inside <BottomDock>, with no floating button', () => {
  const { html } = drawn({ ...COUPLE, discoverOpen: true });
  assert.match(html, /data-bottom-dock/, 'not inside the dock — the bar floats again');
  assert.match(html, /aria-label="Primary navigation"/, 'not the canonical bar');
  const bar = src('app/dashboard/(launcher)/_components/account-bottom-nav.tsx');
  assert.ok(!/\bPlus\b|NavFab|nav-fab/.test(bar), 'a floating ＋ is back on the account bar');
  for (const f of ['app/dashboard/(launcher)/layout.tsx', 'app/dashboard/(account)/layout.tsx']) {
    const layout = src(f);
    assert.ok(!/NavFab|\/dashboard\/create-event/.test(layout), `${f} mounts a create control beside the bar`);
  }
});

test('wiring: both layouts draw the ruled tabs from the server-side answers', () => {
  for (const f of ['app/dashboard/(launcher)/layout.tsx', 'app/dashboard/(account)/layout.tsx']) {
    const layout = src(f);
    assert.match(
      layout,
      /<AccountBarSlot\s+tabs=\{accountBarTabs\(\{ discoverOpen \}\)\}\s+hasShop=\{switcherData\.context\.hasVendor\}\s*\/>/,
      `${f} no longer hands the bar the ruled tabs`,
    );
    assert.match(layout, /discoverOpensHere\(\)/, `${f} no longer asks whether Discover opens here`);
    // ⚡ The Maker's first load: a static import of the bar (or of the canonical
    // bar) from an account layout made webpack split <BottomNav> out of the
    // event layout's chunk — +234 B on the Maker (account-bar-slot.tsx).
    assert.ok(
      !/from '[^']*(account-bottom-nav|nav\/bottom-nav)'/.test(layout),
      `${f} imports the bar directly — mount it through <AccountBarSlot> (its own chunk)`,
    );
  }
});

test('📲 "Discover opens here" says yes in the app — because middleware no longer bounces `/` (or anything) out of it', () => {
  // Owner 2026-11-02, "let everything go live": the brochure bounce that sent a native-shell request for `/` to the
  // board while Apple reviewed 1.0 is GONE. Nothing in middleware may tell the generic native shell (the
  // `SetnayanApp` user agent / the capacitor cookie) apart from a browser any more — the only shell question it
  // asks is the store shell's paid-feature gate (`isStoreShellSignals`), which never names `/`.
  const mw = stripComments(readFileSync(join(WEB, 'middleware.ts'), 'utf8'));
  assert.doesNotMatch(
    mw,
    /APP_EXCLUDED_MARKETING_PATHS|isCapacitorClient|SetnayanApp|setnayan-client-type/,
    'middleware asks "is this the app?" again — if it refuses `/` there, make discoverOpensHere() answer false in that ' +
      'shell (the tab and the rail row leave with it), then update this test',
  );
  assert.equal(isStoreShellWebOnlyPath('/'), false, 'the store shell refuses Discover — the app bar would draw a dead tab');
  assert.equal(isStoreShellWebOnlyPath('/', true), false, 'the store shell refuses Discover where Apple sells');
  const rp = src('lib/request-platform.ts');
  const body = rp.match(/export async function discoverOpensHere\(\): Promise<boolean> \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(body, /^\s*return true;\s*$/, 'discoverOpensHere() no longer says Discover opens everywhere');
});

test('🍎 the rail hides its Discover row where Discover does not open — and only that row', () => {
  const shell = src('app/_components/frontdoor/app-rail-shell.tsx');
  assert.match(shell, /\{discoverOpen \? null : <span hidden data-discover-bounced="" \/>\}/, 'the shell no longer marks a bounced Discover');
  const css = stripComments(readFileSync(join(WEB, 'app/_components/frontdoor/front-door.css'), 'utf8'));
  const rule = css.match(/\.fd:has\(\[data-discover-bounced\]\) \.fd-rail > a\.fd-row\[href='\/'\][^{]*\{([^}]*)\}/);
  assert.ok(rule, 'no stylesheet rule hides the rail Discover row on a bounced shell');
  assert.match(rule![1]!, /display:\s*none/, 'the row must leave (display:none takes it out of the tab order too)');
  // The selector names the row by its href — so it must be the ONLY rail row to `/`.
  const fd = src('app/_components/frontdoor/front-door-shell.tsx');
  const rows = fd.match(/<Link href="\/" \{\.\.\.rowProps\('home'\)\}>/g) ?? [];
  assert.equal(rows.length, 1, `expected the one Discover row, found ${rows.length}`);
  assert.equal((fd.match(/<Link href="\/" \{\.\.\.rowProps\(/g) ?? []).length, 1, 'a second rail row to `/` would be hidden with it');
});

test('the account-level screens wear the mark AND the word — and only they carry the marker', () => {
  const css = stripComments(readFileSync(join(WEB, 'app/_components/frontdoor/front-door.css'), 'utf8'));
  assert.match(
    css,
    /\.fd\[data-chrome='app'\]:has\(\[data-account-bar\]\) \.fd-wordmark-text \{\s*display:\s*inline;/,
    'the word is dropped on the phone again on the account screens',
  );
  assert.match(css, /\.fd\[data-chrome='app'\]:has\(\[data-account-bar\]\) \.fd-mark \{\s*display:\s*block;/, 'the mark is dropped on desktop again');
  const { html } = drawn({ ...COUPLE, discoverOpen: true });
  assert.match(html, /^<div data-account-bar="">/, 'the account bar lost its marker');
  // Nobody else may carry it, or a non-account screen would grow the word.
  const carriers: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.tsx$/.test(e.name) && /data-account-bar/.test(stripComments(readFileSync(join(WEB, rel), 'utf8'))))
        carriers.push(rel);
    }
  };
  walk('app');
  assert.deepEqual(carriers, ['app/dashboard/(launcher)/_components/account-bottom-nav.tsx']);
});

test('Admin lives on the avatar sheet, worded Admin', () => {
  const sheet = src('app/_components/account-switcher/account-switcher.tsx');
  // Direction 2 (owner 2026-10-22): the tile became a "Switch to" row — Setnayan HQ, its ADMIN tag. Match the row
  // as one element, from its href to its closing </Link>, so the words cannot drift to a neighbouring row.
  const row = sheet.match(/<Link\s+href="\/admin"[\s\S]*?<\/Link>/)?.[0] ?? '';
  assert.ok(row, 'the avatar sheet has no row to /admin');
  assert.match(row, />Setnayan HQ</, 'the /admin row is not named Setnayan HQ');
  assert.match(row, /<Tag[^>]*>Admin<\/Tag>/, 'the /admin row lost its Admin tag — the owner\'s word for it');
  assert.match(sheet, /\{showHQ \? \(/, 'the /admin row is no longer gated on the admin grant');
});
