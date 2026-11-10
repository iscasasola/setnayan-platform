/**
 * A NAV GETS ONLY THE REGISTRY SLOTS IT READS — the page's HTML does not carry the whole registry (speed, 2026-11-10).
 *
 * Measured on production, 10 Nov 2026 (`curl -s https://www.setnayan.com/ | wc -c`, then the RSC payload decoded):
 *   · `/` 298 KB — of which ~31 KB was the root layout handing `<SiteChrome navSlots>` EVERY nav-registry slot
 *     (190: the admin sidebar, the supplier sidebar, the couple's menus) for a nav that reads four labels;
 *   · `/vendors` → `/for-suppliers` 411 KB — the same ~31 KB, and the doorway rail (`app-rail-shell`) carried the
 *     SAME map a second time, though the shell reads registry labels in the `app` variant only.
 * Nothing on screen depends on the cut: each nav reads its labels BY KEY, and exactly those keys are kept.
 *
 * Run: npx tsx --test lib/a-nav-gets-only-the-slots-it-reads.test.ts   (from apps/web)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from './strip-comments';
import { pickNavSlots, SITE_NAV_SLOT_PREFIX } from './nav-slot-pick';
import { NAV_SLOT_DEFAULTS } from './nav-registry-defaults';
import { RAIL_NAV_SLOT_KEYS } from '../app/_components/frontdoor/rail-nav-slots';

const WEB = path.resolve(__dirname, '..');
const code = (p: string) => stripComments(fs.readFileSync(path.join(WEB, p), 'utf8'));

/** The map `getNavSlotMap()` serves with no admin override — one entry per default slot. */
function fullMap() {
  const map: Record<string, { label: string; icon: unknown; isHidden: boolean }> = {};
  for (const d of NAV_SLOT_DEFAULTS) {
    map[d.key] = {
      label: d.label,
      icon: { kind: d.iconKind, lucideName: d.lucideName, customRef: d.customRef, customUrl: null },
      isHidden: false,
    };
  }
  return map;
}

test('pickNavSlots keeps the asked prefixes and keys, in order, and nothing else', () => {
  const map = { 'a.x': 1, 'b.y': 2, 'a.z': 3, 'c.w': 4 };
  assert.deepEqual(pickNavSlots(map, { prefixes: ['a.'] }), { 'a.x': 1, 'a.z': 3 });
  assert.deepEqual(pickNavSlots(map, { keys: ['c.w', 'nope'] }), { 'c.w': 4 });
  assert.deepEqual(pickNavSlots(map, { prefixes: ['b.'], keys: ['c.w'] }), { 'b.y': 2, 'c.w': 4 });
  assert.deepEqual(pickNavSlots(null, { prefixes: ['a.'] }), {});
  assert.deepEqual(pickNavSlots(map, {}), {});
});

test('the marketing nav reads only `public.site-nav.*` labels — the slots the root layout keeps', () => {
  const nav = code('app/_components/marketing/site-nav.tsx');
  const read = [...nav.matchAll(/\blabel\(\s*'([^']+)'/g)].map((m) => m[1]!);
  assert.ok(read.length >= 4, `read ${read.length} labels off site-nav.tsx — the parse is broken`);
  const outside = read.filter((k) => !k.startsWith(SITE_NAV_SLOT_PREFIX));
  assert.deepEqual(outside, [], 'the marketing nav reads a slot the root layout no longer sends — widen the pick in app/layout.tsx');
  // SiteChrome hands its map to the Nav and to nothing else.
  const chrome = code('app/_components/marketing/site-chrome.tsx');
  assert.equal((chrome.match(/navSlots=\{navSlots\}/g) ?? []).length, 1, 'SiteChrome passes navSlots somewhere new — check what it reads');
});

test('the root layout hands SiteChrome the picked slots, never the whole map', () => {
  const layout = code('app/layout.tsx');
  assert.match(layout, /<SiteChrome navSlots=\{pickNavSlots\(navSlots, \{ prefixes: \[SITE_NAV_SLOT_PREFIX\] \}\)\} \/>/);
  assert.doesNotMatch(layout, /<SiteChrome navSlots=\{navSlots\}/, 'the whole registry map would ride every page’s HTML again');
});

test('the rail gets only the slots its shell reads, and only in the app variant', () => {
  const shell = code('app/_components/frontdoor/front-door-shell.tsx');
  const block = /const RAIL_SLOT = \{([\s\S]*?)\} as const;/.exec(shell)?.[1];
  assert.ok(block, 'RAIL_SLOT moved — update this guard');
  const shellKeys = [...block!.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]!).sort();
  assert.deepEqual(shellKeys, [...RAIL_NAV_SLOT_KEYS].sort(), 'RAIL_SLOT and RAIL_NAV_SLOT_KEYS disagree — a rail label would lose its admin rename');
  // The shell reads labels only through slotLabel, and slotLabel only in the app variant.
  assert.match(shell, /\(inApp && navLabels\?\.\[slot\]\?\.label\) \|\| fallback/);
  assert.equal((shell.match(/\bnavLabels\b/g) ?? []).length, 3, 'the shell reads navLabels somewhere new — check what it needs');
  const rail = code('app/_components/frontdoor/app-rail-shell.tsx');
  assert.match(rail, /navLabels=\{variant === 'app' \? pickNavSlots\(navLabels, \{ keys: RAIL_NAV_SLOT_KEYS \}\) : undefined\}/);
  assert.doesNotMatch(rail, /navLabels=\{navLabels\}/);
});

test('budget: what reaches a public page is under 2 KB of the registry (it was the whole of it)', () => {
  const full = JSON.stringify(fullMap()).length;
  const site = JSON.stringify(pickNavSlots(fullMap(), { prefixes: [SITE_NAV_SLOT_PREFIX] })).length;
  const rail = JSON.stringify(pickNavSlots(fullMap(), { keys: RAIL_NAV_SLOT_KEYS })).length;
  assert.ok(full > 15_000, `the full registry is ${full} B — this budget no longer measures the cut`);
  assert.ok(site < 2_000, `the marketing nav's slots are ${site} B of every page's HTML`);
  assert.ok(rail < 500, `the rail's slots are ${rail} B`);
  // eslint-disable-next-line no-console
  console.log(`nav registry: full ${full} B → site nav ${site} B · rail ${rail} B (per copy, before HTML escaping)`);
});
