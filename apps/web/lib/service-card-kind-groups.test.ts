/**
 * service-card-kind-groups.test.ts — "Something else" is the LIVE taxonomy, not the hard-coded SERVICE_GROUPS.
 * Owner 2026-11-04: "why is it that i only see these categories when we have a whole spectrum".
 *
 * Sabotage (2026-11-04): the loader's `liveKindGroups(` call swapped back for a `SERVICE_GROUPS.map` → "the loader
 * draws the folds from the live tree" red; `if (alreadyListed.has(...)) continue;` deleted → "not listed twice" red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { liveKindGroups, MISC_KIND } from '@/lib/service-card-kind-groups';
import { SERVICE_GROUPS } from '@/lib/vendors';
import { stripComments } from '@/lib/strip-comments';
import type { CoverageParent } from '@/lib/vendor-coverages';

const TREE: CoverageParent[] = [
  {
    folderId: 'f-food',
    label: 'Food & drink',
    branches: [
      { tileId: 't1', label: 'Food cart', leaves: [{ canonicalService: 'sorbetes_cart', label: 'Sorbetes cart', allowedEventTypes: null }] },
      { tileId: 't2', label: 'Catering', leaves: [{ canonicalService: 'buffet_catering', label: 'Buffet catering', allowedEventTypes: null }] },
    ],
  },
  {
    folderId: 'f-rent',
    label: 'Rentals',
    branches: [{ tileId: 't3', label: 'Power', leaves: [{ canonicalService: 'generator_hire', label: 'Generator hire', allowedEventTypes: null }] }],
  },
];
const open = () => ({ standing: 'open' as const });
const base = { tree: TREE, standingOf: open, ownCategories: [] as string[], leadWithOwnWords: false, kindLabel: (k: string) => `L:${k}` };
const keys = (g: ReturnType<typeof liveKindGroups>) => g.flatMap((x) => x.options.map((o) => o.value));

test('one fold per live top-level group, its own label, every live leaf with its live label', () => {
  const g = liveKindGroups(base);
  assert.deepEqual(g.slice(0, 2).map((x) => x.label), ['Food & drink', 'Rentals']);
  assert.deepEqual(g[0]!.options.map((o) => o.label), ['Sorbetes cart', 'Buffet catering']);
  assert.equal(g[0]!.options[0]!.hint, 'Food cart', 'the branch rides along as the small hint');
  assert.ok(keys(g).includes('generator_hire'));
});

test('a SERVICE_GROUPS-only kind is NOT offered (the hard-coded list no longer draws this sheet)', () => {
  const k = new Set(keys(liveKindGroups(base)));
  const legacyOnly = SERVICE_GROUPS.flatMap((x) => x.members).filter((m) => m !== MISC_KIND);
  for (const m of legacyOnly) assert.ok(!k.has(m), `legacy kind ${m} leaked into the folds`);
});

test('…unless the shop already has a card under it — then it is kept, as covered, never stranded', () => {
  const g = liveKindGroups({ ...base, ownCategories: ['photographer'] });
  const mine = g.find((x) => x.key === 'your-cards');
  assert.ok(mine, 'a card under a no-longer-live kind was stranded');
  assert.deepEqual(mine!.options.map((o) => [o.value, o.label, o.standing]), [['photographer', 'L:photographer', 'covered']]);
});

test('standing comes from the rule handed in — a plan lock still shows, with its reason', () => {
  const g = liveKindGroups({
    ...base,
    standingOf: (k) => (k === 'generator_hire' ? { standing: 'locked', why: 'Upgrade' } : { standing: 'open' }),
  });
  const gen = g.flatMap((x) => x.options).find((o) => o.value === 'generator_hire');
  assert.equal(gen?.standing, 'locked');
  assert.equal(gen?.why, 'Upgrade');
});

test('a kind the shop covers in its own words is not listed twice; a covered kind re-bands when own words lead', () => {
  const g = liveKindGroups({ ...base, alreadyListed: new Set(['buffet_catering']) });
  assert.ok(!keys(g).includes('buffet_catering'));
  const r = liveKindGroups({ ...base, leadWithOwnWords: true, standingOf: () => ({ standing: 'covered' }) });
  assert.ok(r.flatMap((x) => x.options).every((o) => o.standing === 'open'), 'a covered live kind competed with the shop’s own word');
});

test('Miscellaneous stays reachable — the miss line tells suppliers to pick it', () => {
  assert.ok(keys(liveKindGroups(base)).includes(MISC_KIND));
  const withLiveMisc = liveKindGroups({
    ...base,
    tree: [...TREE, { folderId: 'x', label: 'Other', branches: [{ tileId: 'm', label: 'Other', leaves: [{ canonicalService: MISC_KIND, label: 'Miscellaneous', allowedEventTypes: null }] }] }],
  });
  assert.equal(keys(withLiveMisc).filter((k) => k === MISC_KIND).length, 1, 'misc listed twice');
});

test('the loader draws the folds from the live tree, and no longer from SERVICE_GROUPS', () => {
  const src = stripComments(readFileSync(join(__dirname, 'service-card-maker.server.ts'), 'utf8'));
  assert.match(src, /liveKindGroups\(\{\s*tree,/, 'the loader stopped building the folds from the live tree');
  assert.ok(!/SERVICE_GROUPS/.test(src), 'the loader reads the hard-coded SERVICE_GROUPS again');
});
