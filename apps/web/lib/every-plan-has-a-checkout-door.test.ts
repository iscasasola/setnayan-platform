/**
 * 💰 EVERY PLAN CAN BE BOUGHT (RW-13, owner 2026-11-13: *"We want events ultra to be purchasable now"*).
 *
 * Event Ultra shipped with a live catalogue row and a working charge path, and NO screen opened a checkout for it —
 * every unit test stayed green, because nothing asked whether a plan has a door. This asks, for EVERY plan in
 * `PLAN_PRICE_CODES` (so a fourth plan is held the day it is added):
 *   1. it is a pack on Event services (owner 2026-11-23), whose ONE cart posts ONE order (it was a drawer per plan);
 *   2. that screen is the one the public doors lead to (`planScreenHref`);
 *   3. /pricing and /pricing/plan each offer the door (`PlanBuyCta`) for that plan.
 * Comments are stripped before scanning, so a commented-out drawer does not count.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PLAN_PRICE_CODES } from './event-plans';
import { PLAN_KEYS, planScreenHref } from './plan-buy-doors';
import { PACK_KEYS } from './event-services';
import * as hubParts from './hub-parts';
import * as eventUltra from './event-ultra';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(WEB, 'app');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue;
    const full = join(dir, e);
    const rel = relative(WEB, full);
    if (statSync(full).isDirectory()) {
      if (rel === 'app/dev' || rel === 'app/admin' || rel === 'app/api') continue;
      walk(full, out);
    } else if (e.endsWith('.tsx') && !/\.test\.tsx?$/.test(e)) out.push(full);
  }
  return out;
}

/** The SKU constants a screen may name instead of the literal code. */
const SKU_CONSTANTS: ReadonlyMap<string, string> = new Map(
  (Object.entries({ ...hubParts, ...eventUltra }) as Array<[string, unknown]>)
    .filter(([name, value]) => /_SKU$/.test(name) && typeof value === 'string')
    .map(([name, value]) => [name, value as string] as [string, string]),
);

/** serviceKey: X / serviceKey={X} beside a checkout drawer → the code X names. */
function drawerCodes(src: string): Set<string> {
  const out = new Set<string>();
  if (!/InlineCheckoutDrawer/.test(src) && !/\bdrawer\(\{/.test(src)) return out;
  for (const m of src.matchAll(/serviceKey\s*[:=]\s*\{?\s*(['"`])?([A-Za-z_][\w]*)\1?/g)) {
    const raw = m[2]!;
    out.add(m[1] ? raw : SKU_CONSTANTS.get(raw) ?? raw);
  }
  return out;
}

const screens = walk(APP).map((f) => ({ rel: relative(WEB, f), src: stripComments(readFileSync(f, 'utf8')) }));

test('1 · every plan is a pack on Event services, and its cart posts ONE order (owner 2026-11-23)', () => {
  // 🛒 Since Event services (v4, "Yes, build it") a plan is bought as a PACK in the one cart, not in a drawer of its own:
  // every plan code is a pack the page reads and the order mint prices, and the page's cart posts the folded intent.
  const packCodes = Object.values(PLAN_PRICE_CODES);
  assert.deepEqual(
    [...PACK_KEYS].map((k) => PLAN_PRICE_CODES[k]).sort(),
    [...packCodes].sort(),
    'a plan in PLAN_PRICE_CODES is not a pack on Event services',
  );
  const body = screens.find((s) => s.rel === 'app/dashboard/[eventId]/studio/website-pro/_components/event-services-view.tsx')!.src;
  assert.match(body, /await submit\(fd\)/, 'the Event services cart no longer posts its order');
  const dock = screens.find((s) => s.rel === 'app/dashboard/[eventId]/studio/website-pro/_components/event-services-body.tsx')!.src;
  assert.match(dock, /submit=\{submitOrderAction\}/, 'the page no longer hands the cart submitOrderAction');
  assert.match(body, /fd\.set\('intent', 'event_services'\)/, 'the cart no longer names the Event services intent');
  const mint = stripComments(readFileSync(join(WEB, 'lib/event-services-orders.ts'), 'utf8'));
  assert.match(mint, /export const EVENT_SERVICES_INTENT = 'event_services'/, 'the mint no longer answers the cart’s intent');
});

test('2 · the public doors lead to the screen that sells every pack', () => {
  const href = planScreenHref('EVENT', 'ultra');
  assert.match(href, /^\/dashboard\/EVENT\/studio\/website-pro\?plan=ultra$/);
  const route = 'app/dashboard/[eventId]/studio/website-pro/';
  const page = screens.find((s) => s.rel === `${route}page.tsx`)!;
  assert.match(page.src, /search\.plan/, 'the plan screen no longer reads which plan a door opened it for');
  assert.match(page.src, /readEventServices\(eventId\)/, 'the plan screen no longer reads the packs it sells');
});

test('3 · /pricing and /pricing/plan offer the door for every plan', () => {
  const pricing = screens.find((s) => s.rel === 'app/(shell)/pricing/page.tsx')!.src;
  for (const key of PLAN_KEYS) {
    assert.ok(new RegExp(`<PlanBuyCta plan="${key}"`).test(pricing), `/pricing has no buy door for ${key}`);
  }
  const quiz = screens.find((s) => s.rel === 'app/(shell)/pricing/plan/page.tsx')!.src;
  assert.match(quiz, /<PlanBuyCta plan=\{key\}/, '/pricing/plan has no buy door');
  for (const key of PLAN_KEYS) {
    assert.ok(new RegExp(`\\['${key}',`).test(quiz), `/pricing/plan does not list ${key}`);
  }
});

test('the scan can see: a drawer named by constant or literal counts; one in a comment does not', () => {
  assert.ok(drawerCodes(`drawer({ serviceKey: EVENT_ULTRA_SKU, php })`).has('EVENT_ULTRA'));
  assert.ok(drawerCodes(`<InlineCheckoutDrawer serviceKey="EVENT_PLUS" />`).has('EVENT_PLUS'));
  assert.equal(drawerCodes(stripComments(`// drawer({ serviceKey: EVENT_ULTRA_SKU })`)).size, 0);
});
