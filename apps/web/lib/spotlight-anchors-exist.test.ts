/**
 * spotlight-anchors-exist.test.ts — 🔦 EVERY SPOTLIGHT STEP POINTS AT SOMETHING THAT IS THERE.
 *
 * A spotlight step names the real button by its `data-tour` token (`lib/tours.ts` → `spotlight`).
 * A token nobody draws is a step the tour silently skips (the engine waits, then jumps ahead) — so a
 * rename that drops an anchor would shorten the tour with no error anywhere. This fails instead.
 *
 * It also holds the two promises the engine makes about weight:
 *  · the engine (`spotlight-tour.tsx`) is reached ONLY through `React.lazy` in `spotlight-mount.tsx`,
 *    so a page whose tour is done never downloads it and the Maker's first load never carries it;
 *  · the spotlight never draws the old centred card (owner 2026-10-03: the carousels stay off).
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { TOURS, TOUR_KEYS } from './tours';

const WEB = process.cwd();
const ROOTS = ['app', 'components', 'lib'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const FILES = ROOTS.flatMap((r) => walk(join(WEB, r)));
const SOURCES = FILES.map((f) => ({ f: relative(WEB, f), src: readFileSync(f, 'utf8') }));

/** A token is drawn when some file writes it as `data-tour="…"`, `tour="…"`, or `tour={`home-${…}`}` with that key. */
function drawn(token: string): string[] {
  const lit = new RegExp(`(?:data-tour|\\btour)=["'{\`]+${token.replace(/[-]/g, '\\-')}["'}\`]`);
  // …or chosen inside a data-tour expression: `data-tour={key === 'share' ? 'guests-setup' : undefined}`.
  const chosen = new RegExp(`data-tour=\\{[^}]*['"]${token.replace(/[-]/g, '\\-')}['"]`);
  // …or handed in as a data mark a component spreads (`data={{ 'data-tour': 'people-thumb' }}` on the thumb row).
  const handed = new RegExp(`['"]data-tour['"]\\s*:\\s*['"]${token.replace(/[-]/g, '\\-')}['"]`);
  return SOURCES.filter(({ src }) => lit.test(src) || chosen.test(src) || handed.test(src)).map(({ f }) => f);
}

const steps = TOUR_KEYS.flatMap((k) => (TOURS[k].spotlight?.steps ?? []).map((s) => ({ k, s })));

test('there are spotlight tours to check (the scan is not looking at nothing)', () => {
  assert.ok(steps.length >= 15, `only ${steps.length} spotlight steps — did the scripts move out of lib/tours.ts?`);
  // + the four supplier page tours (owner 2026-10-22, journey_fixes Supplier 3).
  for (const k of ['host_spotlight_v1', 'host_day_spotlight_v1', 'supplier_spotlight_v1', 'vendor_shop_v1', 'vendor_dates_v1', 'vendor_money_v1', 'vendor_hub_v1'] as const) {
    assert.ok(TOURS[k].spotlight, `${k} has no spotlight script`);
  }
});

test('every spotlight anchor is drawn by a real element', () => {
  const missing: string[] = [];
  for (const { k, s } of steps) {
    // Checked below: the bar derives tab-* from each tab's address, the Home doors stamp home-<key>.
    if (s.anchor.startsWith('tab-') || s.anchor.startsWith('home-door') || /^home-(guests|explore|launch)$/.test(s.anchor)) continue;
    if (drawn(s.anchor).length === 0) missing.push(`${k} → ${s.anchor}`);
  }
  assert.deepEqual(missing, [], 'a spotlight step names a data-tour token no element carries');
});

test('the home doors draw home-<key> tokens, and launch is one of the keys', () => {
  const parts = SOURCES.find(({ f }) => f.endsWith('dashboard/[eventId]/_components/home-parts.tsx'));
  assert.ok(parts, 'home-parts.tsx moved');
  assert.match(parts.src, /tour=\{`home-\$\{d\.key\}`\}/, 'the doors no longer stamp home-<key>');
  assert.match(parts.src, /key: 'launch' as const/, 'the Event Hub door key changed — host_spotlight_v1 points at home-launch');
  for (const { s } of steps.filter(({ s }) => /^home-(guests|explore|launch)$/.test(s.anchor))) {
    assert.match(parts.src, new RegExp(`key: '${s.anchor.slice(5)}' as const`), `no Home door has key ${s.anchor.slice(5)}`);
  }
});

test('bar tabs carry tab-<last path segment>, and every tab step names a real tab', () => {
  const nav = SOURCES.find(({ f }) => f.endsWith('_components/nav/bottom-nav.tsx'));
  assert.ok(nav, 'bottom-nav.tsx moved');
  assert.match(nav.src, /data-tour=\{tabTourToken\(item\.href\)\}/, 'the bar no longer stamps its tabs');
  const tabs = steps.filter(({ s }) => s.anchor.startsWith('tab-')).map(({ s }) => s.anchor.slice(4));
  assert.ok(tabs.length >= 4, 'expected the guests / vendors / shop / customers tab steps');
  // + the account bar (Events · Discover · Memories · People — `customer_account_bar_v1`, owner 2026-10-22).
  const menus = SOURCES.filter(({ f }) => /customer-menu\.ts$|vendor-bottom-nav\.tsx$|account-bottom-nav\.tsx$/.test(f)).map(({ src }) => src).join('\n');
  for (const seg of tabs) {
    // A tab's token ignores its query (`/dashboard?hub=1` → tab-dashboard), as `tabTourToken` does.
    const href = seg === 'vendor-dashboard' ? /['"`]\/vendor-dashboard['"`]/ : new RegExp(`/${seg}(?:\\?[^'"\`]*)?['"\`]`);
    assert.match(menus, href, `no bar tab has an address ending in /${seg} — the tab-${seg} step would never light`);
  }
});

test('the engine is reached only through React.lazy in the mount', () => {
  const importers = SOURCES.filter(({ src }) => /from\s+['"](?:\.\/|@\/app\/_components\/)spotlight-tour['"]/.test(src));
  assert.deepEqual(importers.map(({ f }) => f), [], 'a file imports the spotlight engine statically — it rides in that page’s first load');
  const mount = SOURCES.find(({ f }) => f.endsWith('_components/spotlight-mount.tsx'));
  assert.ok(mount, 'spotlight-mount.tsx moved');
  assert.match(mount.src, /lazy\(\(\) => import\('\.\/spotlight-tour'\)/, 'the mount no longer lazy-loads the engine');
});

test('the spotlight never draws the old centred card', () => {
  for (const name of ['spotlight-tour.tsx', 'spotlight-mount.tsx', 'spotlight.tsx']) {
    const f = SOURCES.find(({ f }) => f.endsWith(`_components/${name}`));
    assert.ok(f, `${name} moved`);
    assert.doesNotMatch(f.src, /from\s+['"][^'"]*(?:guided-tour|mini-tour)[^'"]*['"]/, `${name} imports the switched-off carousel`);
  }
});
