/**
 * 🧰 Shop › Services, one row per service (v13 S5) — `lib/shop-services-summary.ts`.
 *
 *   1. a service is a coverage row; its cards are the ones filed under it; a card filed under none still counts;
 *   2. LIVE = a card switched on — never an invented allowance; READY = built, none on;
 *   3. the tools are the Hub's own defaults for that service (`vendor-dayof-modules.ts`), the scanner said apart;
 *   4. the figures: an unread list is "—" on all three, never 0.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { servicesFigures, serviceToolsOf, shopServiceRows, type ShopCardLite } from './shop-services-summary';
import { DAY_OF_MODULES, familiesForServices } from './vendor-dayof-modules';
import { TILE_PARENT } from './taxonomy';

const card = (id: string, cov: number | null, category: string, price: number | null, on = true): ShopCardLite => ({
  vendor_service_id: id,
  coverage_id: cov,
  category,
  is_active: on,
  starting_price_php: price,
});
const label = (cs: string) => `L:${cs}`;

test('1 · one row per service, its cards counted under it; loose cards are one more row, never dropped', () => {
  const rows = shopServiceRows(
    [
      { id: 1, canonical_service: 'catering' },
      { id: 2, canonical_service: 'cake' },
    ],
    [card('a', 1, 'catering', 45_000), card('b', 1, 'catering', 30_000), card('c', 2, 'cake', 8_000, false), card('d', null, 'photographer', 9_000)],
    label,
  );
  assert.deepEqual(
    rows.map((r) => [r.key, r.label, r.cards, r.live, r.fromPhp, r.firstCardId]),
    [
      ['cov-1', 'L:catering', 2, true, 30_000, 'a'],
      ['cov-2', 'L:cake', 1, false, 8_000, 'c'],
      ['none', 'Not filed under a service', 1, true, 9_000, 'd'],
    ],
  );
});

test('2 · a service with no card is Ready with no price — not live, not "from ₱0"', () => {
  const [r] = shopServiceRows([{ id: 7, canonical_service: 'catering' }], [], label);
  assert.equal(r!.cards, 0);
  assert.equal(r!.live, false);
  assert.equal(r!.fromPhp, null);
  assert.equal(r!.firstCardId, null);
});

test('3 · the tools are the Hub defaults for the service; the scanner is said apart, once', () => {
  // A coordinate-family service turns the seat scanner on (the Hub's own map, never a typed key).
  const anyCoordinate = Object.keys(TILE_PARENT).find((k) => familiesForServices([k]).has('coordinate'));
  assert.ok(anyCoordinate, 'premise: a coordinate-family service key exists');
  const coord = serviceToolsOf([anyCoordinate!]);
  const scanner = DAY_OF_MODULES.find((m) => m.id === 'qr_scanner')!.label;
  assert.equal(coord.scanner, scanner);
  assert.ok(!coord.tools.includes(scanner), 'the scanner is listed twice');
  assert.ok(coord.tools.length > 0);
  // A key that names no family falls back to the Hub's own `setup` family — never an empty line.
  const none = serviceToolsOf(['__not_a_service__']);
  assert.equal(none.scanner, null);
  assert.deepEqual(
    none.tools,
    DAY_OF_MODULES.filter((m) => m.defaultOnFor.includes('setup') && m.id !== 'qr_scanner').map((m) => m.label),
  );
});

test('4 · the figures — services · live · tools ready; unread = "—" on every one, never 0', () => {
  const rows = shopServiceRows([{ id: 1, canonical_service: 'x' }], [card('a', 1, 'x', 1_000, false)], label);
  const f = servicesFigures(rows);
  assert.deepEqual(f.map((x) => x.key), ['services', 'live', 'tools']);
  assert.equal(f[0]!.value, '1');
  assert.equal(f[0]!.word, 'service');
  assert.equal(f[1]!.value, '0');
  assert.equal(f[1]!.hot, true, 'a shop with services and none live is the figure that waits on it');
  assert.equal(f[2]!.value, String(rows[0]!.tools.length + (rows[0]!.scanner ? 1 : 0)));
  for (const x of servicesFigures(null)) assert.equal(x.value, null, `${x.key} reads a number on a refused read`);
  for (const x of f) assert.ok(x.href.startsWith('/vendor-dashboard/shop'), `${x.key} is not a door`);
});
