/**
 * 👗 THE BRIDE'S FABRIC STEP, DATA SIDE (plan step B15; prototype INTEGRATION-PLAN v186).
 *   1 · Gown = gown_body or skirt; accent = sleeves_accents; lining = lining. Wool suiting is not offered for a gown.
 *   2 · Headings by family, in the family order; men's-only and lining-only types are hidden from the gown and accent.
 *   3 · The designer's own cloths come first, each under its type; a cloth of a hidden type is not offered.
 *   4 · The `open` read carries the three slots and still never a price.
 * Run: cd apps/web && npx tsx --test lib/gown-fabric-groups.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GOWN_FABRIC_FAMILY_ORDER, gownFabricGroups, type GownFabricTypeOption } from './gown-maker';

type T = Pick<GownFabricTypeOption, 'id' | 'name' | 'family' | 'usedFor'>;
const TYPES: T[] = [
  { id: 'satin', name: 'Satin', family: 'satins', usedFor: ['gown_body', 'skirt', 'entourage'] },
  { id: 'mikado', name: 'Mikado', family: 'structured', usedFor: ['gown_body', 'skirt'] },
  { id: 'tulle', name: 'Tulle', family: 'sheers', usedFor: ['skirt', 'sleeves_accents'] },
  { id: 'lace', name: 'Lace', family: 'laces', usedFor: ['gown_body', 'sleeves_accents'] },
  { id: 'wool', name: 'Wool suiting', family: 'suitings', usedFor: ['mens_suit'] },
  { id: 'china_silk', name: 'China silk', family: 'linings', usedFor: ['lining'] },
  { id: 'jusi', name: 'Jusi', family: 'handwoven', usedFor: ['barong', 'sleeves_accents'] },
];
const ids = (g: ReturnType<typeof gownFabricGroups>) => g.flatMap((x) => x.choices.map((c) => c.id));

test('1 · each slot offers only the types that suit it', () => {
  assert.deepEqual(ids(gownFabricGroups('gown', TYPES)), ['satin', 'mikado', 'tulle', 'lace']);
  assert.ok(!ids(gownFabricGroups('gown', TYPES)).includes('wool'), 'wool suiting is offered for a gown');
  assert.deepEqual(ids(gownFabricGroups('accent', TYPES)), ['tulle', 'lace', 'jusi']);
  assert.deepEqual(ids(gownFabricGroups('lining', TYPES)), ['china_silk']);
});

test('2 · headings by family, in order; men’s-only and lining-only hidden from the bride’s gown and accent', () => {
  const g = gownFabricGroups('gown', TYPES);
  assert.deepEqual(g.map((x) => x.label), ['Satins', 'Structured', 'Sheers', 'Laces']);
  const order = g.map((x) => GOWN_FABRIC_FAMILY_ORDER.indexOf(x.family));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  for (const slot of ['gown', 'accent'] as const) {
    const f = gownFabricGroups(slot, TYPES).map((x) => x.family);
    assert.ok(!f.includes('suitings') && !f.includes('linings'), `${slot} offers a men’s or lining-only family`);
  }
});

test('3 · the designer’s own cloths first, each under its type; a hidden type’s cloth is not offered', () => {
  const shop = [
    { id: 'f1', name: 'Duchess satin', typeId: 'satin', kind: 'fabric' as const },
    { id: 'f2', name: 'Navy wool', typeId: 'wool', kind: 'fabric' as const },
    { id: 'f3', name: 'Chantilly', typeId: 'lace', kind: 'lace' as const },
  ];
  const g = gownFabricGroups('gown', TYPES, shop);
  assert.deepEqual(g[0]!.choices.map((c) => [c.kind, c.id]), [['designer', 'f1'], ['type', 'satin']]);
  assert.ok(!ids(g).includes('f2'), 'a cloth of a type not offered for a gown was offered');
  const laces = g.find((x) => x.family === 'laces')!;
  assert.deepEqual(laces.choices[0], { kind: 'designer', id: 'f3', name: 'Chantilly', typeId: 'lace', lace: true });
});

test('4 · the open read carries the three slots, and still never a price', () => {
  const src = readFileSync(join(__dirname, '..', 'app/_components/gown-maker/gown-actions.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  const open = src.slice(src.indexOf("if (op !== 'open')"));
  for (const slot of ['gown', 'accent', 'lining']) assert.match(open, new RegExp(`${slot}: gownFabricGroups\\('${slot}', types\\.data, fabrics\\.data\\)`));
  const groups = readFileSync(join(__dirname, 'gown-maker.ts'), 'utf8');
  const fn = groups.slice(groups.indexOf('export function gownFabricGroups'));
  assert.doesNotMatch(fn.slice(0, fn.indexOf('\n}\n')), /price|centavos/i, 'a price reaches the bride’s fabric choices');
});
