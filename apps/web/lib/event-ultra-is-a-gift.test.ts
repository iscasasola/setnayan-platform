/**
 * 💎🎁 EVENT ULTRA AS A SUPPLIER GIFT AND A BADGE REWARD KIND (owner 2026-11-13: "Gifting Ultra: yes, add it to shop
 * gifts and badge rewards"; an Ultra gift on a Plus/Pro event "Gives full Ultra"; badge rewards: "Ultra kind, no step
 * yet"). The SQL side is executed in tests/db/a-supplier-gift-lands-once.db.test.ts (case 6); this holds the app side
 * and the one list the two sides must share.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SHOP_GIFT_KINDS,
  SHOP_GIFT_UNLOCK_CODE,
  eventCanTake,
  judgeQuoteGifts,
  shopGiftKindOf,
  shopGiftPacksFrom,
  type EventHolds,
} from './shop-gifts';
import { EVENT_ULTRA_GRANTS, EVENT_ULTRA_SKU } from './event-ultra';
import { BADGE_REWARDS, EVENTS_STEP_REWARDS, FALLBACK_REWARD_NAMES, PLAN_PERIOD_GIFTS } from './badge-rewards';
import { BOOKING_FEE } from './booking-fee';
import { GIFT_KIND_WORD } from './gift-pick';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', '..', '..', 'supabase', 'migrations');

test('Event Ultra is a fourth gift kind, keyed on its own catalogue code', () => {
  assert.deepEqual([...SHOP_GIFT_KINDS], ['papic', 'event_plus', 'event_pro', 'event_ultra']);
  assert.equal(SHOP_GIFT_UNLOCK_CODE.event_ultra, EVENT_ULTRA_SKU);
  assert.equal(shopGiftKindOf('EVENT_ULTRA'), 'event_ultra');
  assert.equal(GIFT_KIND_WORD.event_ultra, 'Event Ultra');
  assert.equal(FALLBACK_REWARD_NAMES.event_ultra, 'Event Ultra');
});

test('who can take what: Ultra lands on Plus and Pro events (full Ultra); nothing lands on an Ultra event', () => {
  const table: Array<[EventHolds, Record<'event_plus' | 'event_pro' | 'event_ultra', boolean>]> = [
    ['none', { event_plus: true, event_pro: true, event_ultra: true }],
    ['plus', { event_plus: true, event_pro: true, event_ultra: true }],
    ['pro', { event_plus: false, event_pro: false, event_ultra: true }],
    ['ultra', { event_plus: false, event_pro: false, event_ultra: false }],
  ];
  for (const [has, want] of table) {
    for (const [kind, ok] of Object.entries(want)) {
      assert.equal(eventCanTake(kind as 'event_ultra', has), ok, `${kind} on an event holding ${has}`);
    }
    assert.equal(eventCanTake('papic', has), true);
  }
});

test('the quote verdict counts Ultra units and refuses only where the event cannot take them', () => {
  // Figures are handed in (as the catalogue would) — none of them is a real price.
  const packs = shopGiftPacksFrom([
    { code: 'PAPIC_GUEST_150', title: 'Papic 150', credits: 150, pricePhp: 1 },
    { code: 'EVENT_ULTRA', title: 'Event Ultra', credits: 1, pricePhp: 2 },
  ]);
  assert.deepEqual(packs.map((p) => p.kind), ['papic', 'event_ultra'], 'Ultra sorts after the other kinds');
  const free = { papic: 0, event_plus: 0, event_pro: 0, event_ultra: 1 };
  const bigTotal = 100_000_000; // centavos: a limit large enough that only the take rule decides
  const onPro = judgeQuoteGifts(['EVENT_ULTRA'], packs, bigTotal, BOOKING_FEE, 100, free, 'pro');
  assert.equal(onPro.state, 'ok');
  assert.deepEqual(onPro.unlocks, { event_plus: 0, event_pro: 0, event_ultra: 1 });
  assert.equal(judgeQuoteGifts(['EVENT_ULTRA'], packs, bigTotal, BOOKING_FEE, 100, free, 'ultra').state, 'already_has');
  const none = { ...free, event_ultra: 0 };
  const short = judgeQuoteGifts(['EVENT_ULTRA'], packs, bigTotal, BOOKING_FEE, 100, none, 'none');
  assert.equal(short.state, 'short');
  assert.equal(short.shortKind, 'event_ultra');
});

test('🏅 Ultra is a reward KIND, and no badge step pays it until the owner names one', () => {
  const tables = JSON.stringify({ BADGE_REWARDS, EVENTS_STEP_REWARDS, PLAN_PERIOD_GIFTS });
  assert.ok(!tables.includes('event_ultra'), 'a badge step pays Event Ultra — the owner has not named one (13 Nov 2026)');
});

test('the SQL gift door grants exactly what Ultra grants (lib/event-ultra.ts EVENT_ULTRA_GRANTS)', () => {
  const file = readdirSync(MIGRATIONS).find((f) => f.endsWith('_supplier_gifts_event_ultra.sql'));
  assert.ok(file, 'the Ultra gift migration is missing');
  const sql = readFileSync(join(MIGRATIONS, file!), 'utf8');
  const lists = [...sql.matchAll(/ARRAY\[('[A-Z_]+'(?:,\s*'[A-Z_]+')*)\]/g)]
    .map((m) => m[1]!.split(',').map((s) => s.trim().replace(/'/g, '')))
    .filter((l) => l.includes('LIVE_STUDIO'));
  assert.equal(lists.length, 2, 'both gifted-access readers must name what Ultra grants');
  for (const l of lists) assert.deepEqual([...l].sort(), [...EVENT_ULTRA_GRANTS].sort());
});
