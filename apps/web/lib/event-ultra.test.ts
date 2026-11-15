/**
 * 💎 EVENT ULTRA (owner 2026-11-13, "EVENT ULTRA APPROVED — BUILD IT") — what the one Ultra order unlocks, held.
 *
 *   · the grants: Pro, Live Watch (self-run), Patiktok — read off the Ultra order by the SAME alias map every gate
 *     already reads, so an existing gate answers yes with no new code; never Music Maker or the hosted channel;
 *   · aliases are not transitive: every list that names Event Pro names Ultra too;
 *   · activation: the plan hook (Setnayan AI + credits topped up to the row's number);
 *   · charge + Apple: once per event;
 *   · canvas: Ultra, plus Pro bought before canvas left it (never take away a paid unlock);
 *   · no price or credit count typed in code.
 *
 * Sabotage-checked by hand (PR body): removing EVENT_ULTRA from the LIVE_STUDIO alias, from AI_INCLUDED_PLAN_SKUS, or
 * flipping the canvas cutover comparison each turns this file red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SKU_OWNERSHIP_ALIASES } from '@/lib/entitlements';
import {
  CANVAS_LEFT_PRO_AT,
  EVENT_ULTRA_GRANTS,
  EVENT_ULTRA_NEVER_GRANTS,
  EVENT_ULTRA_SKU,
  canvasPrintsUnlockedFrom,
  fullResKeepDays,
} from '@/lib/event-ultra';
import { iapProductForServiceKey } from '@/lib/iap/products';
import { stripComments } from '@/lib/strip-comments';

const HERE = import.meta.dirname;
const read = (rel: string) => readFileSync(path.join(HERE, rel), 'utf8');

test('every Ultra grant is conferred by the Ultra order, through the alias map the gates already read', () => {
  assert.deepEqual([...EVENT_ULTRA_GRANTS].sort(), ['COUPLE_WEBSITE_PRO', 'LIVE_STUDIO', 'PATIKTOK_COMPILER']);
  for (const sku of EVENT_ULTRA_GRANTS) {
    assert.ok(SKU_OWNERSHIP_ALIASES[sku]?.includes(EVENT_ULTRA_SKU), `${sku} is not conferred by an Ultra order`);
  }
});

test('🚫 Ultra never confers what staff make by hand — Music Maker, the hosted channel', () => {
  assert.deepEqual([...EVENT_ULTRA_NEVER_GRANTS].sort(), ['LIVE_STUDIO_HOSTED_CHANNEL', 'PAKANTA']);
  for (const sku of EVENT_ULTRA_NEVER_GRANTS) {
    assert.ok(!EVENT_ULTRA_GRANTS.includes(sku), `${sku} is in Ultra`);
    assert.ok(!(SKU_OWNERSHIP_ALIASES[sku] ?? []).includes(EVENT_ULTRA_SKU), `an Ultra order confers ${sku}`);
  }
});

test('aliases are not transitive: every list that names Event Pro names Ultra too', () => {
  for (const [canonical, aliases] of Object.entries(SKU_OWNERSHIP_ALIASES)) {
    if (aliases.includes('COUPLE_WEBSITE_PRO')) {
      assert.ok(aliases.includes(EVENT_ULTRA_SKU), `${canonical} comes with Pro but not with Ultra`);
    }
  }
  // One-directional: a Pro (or any) order never confers Ultra.
  assert.equal(SKU_OWNERSHIP_ALIASES[EVENT_ULTRA_SKU], undefined, 'something confers Ultra without buying it');
});

test('approving an Ultra order runs the plan hook — Setnayan AI on, credits topped up to the row', () => {
  const src = stripComments(read('sku-activation.ts'));
  assert.match(src, /AI_INCLUDED_PLAN_SKUS[^=]*=\s*\[[^\]]*EVENT_ULTRA_SKU/, 'Ultra does not carry Setnayan AI');
  assert.match(src, /\[EVENT_ULTRA_SKU\]:\s*activateEventPlan/, 'an approved Ultra order provisions nothing');
});

test('Ultra is charged once per event, and sold in the app the way Pro is', () => {
  const charge = stripComments(read('order-charge-authority.ts'));
  assert.match(charge, /serviceKey === EVENT_ULTRA_SKU[\s\S]{0,400}eventOwnsSku\(admin, eventId, EVENT_ULTRA_SKU\)[\s\S]{0,200}already_owned/);
  const apple = iapProductForServiceKey(EVENT_ULTRA_SKU);
  assert.equal(apple?.productId, 'com.setnayan.app.event_ultra');
  assert.equal(apple?.kind, 'event-ultra');
  const iap = stripComments(read('iap/iap-actions.ts'));
  assert.match(iap, /product\.kind === 'event-ultra'[\s\S]{0,1200}startRefusal\('owned'\)/, 'the app would sell Ultra twice');
});

test('🖼 canvas: Ultra yes · Pro before the cutover yes · Pro after no · refunded no · unreadable date kept', () => {
  const before = new Date(Date.parse(CANVAS_LEFT_PRO_AT) - 86_400_000).toISOString();
  const after = new Date(Date.parse(CANVAS_LEFT_PRO_AT) + 86_400_000).toISOString();
  const o = (service_key: string, status: string, created_at: string | null) => ({ service_key, status, created_at });
  assert.equal(canvasPrintsUnlockedFrom([o('EVENT_ULTRA', 'paid', after)]), true);
  assert.equal(canvasPrintsUnlockedFrom([o('COUPLE_WEBSITE_PRO', 'paid', before)]), true, 'a paid unlock was taken away');
  assert.equal(canvasPrintsUnlockedFrom([o('COUPLE_WEBSITE_PRO', 'fulfilled', after)]), false, 'canvas is still in Pro for new buyers');
  assert.equal(canvasPrintsUnlockedFrom([o('COUPLE_WEBSITE_PRO', 'refunded', before)]), false);
  assert.equal(canvasPrintsUnlockedFrom([o('EVENT_ULTRA', 'submitted', after)]), false, 'a pending order unlocks');
  assert.equal(canvasPrintsUnlockedFrom([o('COUPLE_WEBSITE_PRO', 'paid', null)]), true);
  assert.equal(canvasPrintsUnlockedFrom([]), false);
});

test('the full-size hold only ever grows', () => {
  assert.equal(fullResKeepDays(92, []), 92);
  assert.equal(fullResKeepDays(92, [null, 274, -5, undefined]), 366);
  assert.equal(fullResKeepDays(92, [-400]), 92, 'a negative extra shortened the promise');
});

test('no Ultra price or credit count is typed in code — the catalogue row is the only figure', () => {
  for (const rel of ['event-ultra.ts', 'event-ultra-gates.ts', '../app/_components/frontdoor/front-door-landing.tsx',
    '../app/_components/frontdoor/front-door-landing-data.ts', '../app/(shell)/pricing/page.tsx', 'features-page.ts']) {
    const src = stripComments(read(rel));
    assert.doesNotMatch(src, /9,?990|3,?500/, `${rel} types an Ultra figure`);
  }
});
