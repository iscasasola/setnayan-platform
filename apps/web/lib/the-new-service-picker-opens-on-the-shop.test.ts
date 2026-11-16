/**
 * the-new-service-picker-opens-on-the-shop.test.ts — 🧰 WALK STEP 3, FAULT 3 (2026-11-16): "What you offer" opened on
 * the whole catalogue, venues first, instead of the shop's own service.
 *
 * Two doors open on it: the maker's own "What you offer" sheet (it leads with "What you cover" — the kinds counted in
 * `the-signup-service-is-never-asked.test.ts`), and the dashboard's New service, which opens on THE ONE Add-a-service
 * picker. A shop with no card yet had nothing "On your shop", so the picker drew the catalogue only. Now the shop's own
 * services with no card arrive already picked ("Make 1 card"), the catalogue under them.
 *
 * Sabotage: start `picked` at `[]` again → test 2 red; drop `shopServices` from the maker context → test 2 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { CARD_QUEUE_MAX, shopServicesPicked } from './card-queue';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const TREE = [
  { label: 'Venues', branches: [{ label: 'Reception', leaves: [{ canonicalService: 'reception_hall', label: 'Reception hall' }] }] },
  {
    label: 'Flowers & styling',
    branches: [{ label: 'Florals', leaves: [{ canonicalService: 'bridal_bouquet', label: 'Bridal bouquet' }, { canonicalService: 'florals', label: 'Florals' }] }],
  },
];

test('1 · the shop’s own services with no card open picked — in its order, once, only what the tree offers', () => {
  assert.deepEqual(shopServicesPicked(TREE, ['florals'], []), [{ key: 'florals', label: 'Florals', path: 'Flowers & styling › Florals' }]);
  /* One that already has a card is "On your shop", never picked twice; a retired one is never picked. */
  assert.deepEqual(shopServicesPicked(TREE, ['bridal_bouquet', 'florals', 'florals', 'gone'], ['bridal_bouquet']).map((p) => p.key), ['florals']);
  /* Unread cards → nothing is picked (the picker says it could not read them instead). */
  assert.deepEqual(shopServicesPicked(TREE, ['florals'], null), []);
  /* No more than one press makes. */
  const many = Array.from({ length: CARD_QUEUE_MAX + 3 }, (_, i) => ({ canonicalService: `s${i}`, label: `S${i}` }));
  const big = [{ label: 'All', branches: [{ label: 'All', leaves: many }] }];
  assert.equal(shopServicesPicked(big, many.map((l) => l.canonicalService), []).length, CARD_QUEUE_MAX);
  /* Anti-vacuity: a venue the shop does not do is never put first. */
  assert.ok(!shopServicesPicked(TREE, ['florals'], []).some((p) => p.key === 'reception_hall'));
});

test('2 · the New service picker STARTS on them, from the maker context, with the catalogue still under it', () => {
  const picker = read('app/vendor-dashboard/services/new/_components/add-service-picker.tsx');
  assert.match(
    picker,
    /const \[picked, setPicked\] = useState<[^>]+>\(\(\) =>\s*shopServicesPicked\(tree, shopServices, onShop\),?\s*\);/,
    'the picker opens with nothing picked again — the whole catalogue first',
  );
  assert.match(picker, /<ServicePicker\b/, 'the full catalogue is no longer reachable from the picker');
  const maker = read('app/vendor-dashboard/services/new/_components/new-service-maker.tsx');
  assert.match(maker, /<AddServicePicker\b[^>]*\bshopServices=\{ctx\.shopServices\}/, 'the page does not hand the shop’s services to the picker');
  const ctx = read('lib/service-card-maker.server.ts');
  assert.match(ctx, /shopServices: coveredChoices\.map\(\(o\) => o\.value\),/, 'the maker context no longer says which services the shop does');
  /* …and the maker's own "What you offer" sheet leads with those same kinds. */
  const canvas = read('app/vendor-dashboard/services/_components/canvas-maker.tsx');
  const kindSheet = canvas.slice(canvas.indexOf('id="canvas-kind"'), canvas.indexOf('heading="Something else"'));
  assert.ok(kindSheet.length > 200, 'anti-vacuity: the What you offer sheet was not found');
  assert.match(kindSheet, /coveredChoices\.length > 0 \?/, 'the shop’s own kinds no longer lead the What you offer sheet');
});
