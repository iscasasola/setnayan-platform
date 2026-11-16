/**
 * 🔒 THE PORTFOLIO'S SECTIONS KEEP THE SUPPLIER'S ORDER (ruling 5940) — `lib/portfolio-section-order.ts`.
 *   · "Your best work" is FIRST in the shipped order;
 *   · a stored order puts the named sections first, in its order;
 *   · a stored key the app no longer draws is ignored, and NO stored order can hide a section;
 *   · a save keeps known keys only, each once, at most the column's cap;
 *   · the column exists in a migration, readable and writable by the shop's own session only, and the one writer is
 *     the shipped field save (no new server action — the export budget is at its ceiling).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PORTFOLIO_SECTIONS,
  cleanPortfolioOrder,
  moveSection,
  orderPortfolioSections,
} from './portfolio-section-order';

test('the shipped order starts with Your best work', () => {
  assert.equal(PORTFOLIO_SECTIONS[0], 'best');
  assert.deepEqual(orderPortfolioSections([]), [...PORTFOLIO_SECTIONS]);
  assert.deepEqual(orderPortfolioSections(null), [...PORTFOLIO_SECTIONS]);
});

test('a stored order leads; every unnamed section keeps its shipped place after it', () => {
  const got = orderPortfolioSections(['video', 'albums']);
  assert.deepEqual(got.slice(0, 2), ['video', 'albums']);
  assert.equal(got.length, PORTFOLIO_SECTIONS.length, 'a stored order hid a section');
  assert.deepEqual(got.slice(2), PORTFOLIO_SECTIONS.filter((k) => k !== 'video' && k !== 'albums'));
});

test('unknown, repeated and absent keys never break or hide anything', () => {
  const got = orderPortfolioSections(['nope', 'songs', 'songs', 42, null], ['page', 'best', 'video']);
  assert.deepEqual(got, ['best', 'page', 'video'], 'a section this shop does not draw came back, or one went missing');
});

test('a save keeps known keys once, capped', () => {
  assert.deepEqual(cleanPortfolioOrder(['page', 'page', 'x', 'best']), ['page', 'best']);
  assert.ok(cleanPortfolioOrder([...PORTFOLIO_SECTIONS, ...PORTFOLIO_SECTIONS]).length <= 24);
});

test('a step up or down moves exactly one section', () => {
  assert.deepEqual(moveSection(['a', 'b', 'c'], 1, -1), ['b', 'a', 'c']);
  assert.deepEqual(moveSection(['a', 'b', 'c'], 2, 1), ['a', 'b', 'c']);
});

test('the column is born with its grants, and the shipped field save is its one writer', () => {
  const dir = join(process.cwd(), '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_portfolio_sections_keep_the_suppliers_order.sql'));
  assert.ok(file, 'the section-order migration is missing');
  const sql = readFileSync(join(dir, file!), 'utf8').replace(/--.*$/gm, '');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS portfolio_section_order TEXT\[\] NOT NULL DEFAULT/);
  assert.match(sql, /GRANT UPDATE \(portfolio_section_order\) ON public\.vendor_profiles TO authenticated/);
  assert.match(sql, /REVOKE SELECT \(portfolio_section_order\) ON public\.vendor_profiles FROM anon/);
  const actions = readFileSync(join(process.cwd(), 'app/vendor-dashboard/actions.ts'), 'utf8');
  assert.match(actions, /case 'portfolio_order': \{/);
  assert.match(actions, /portfolio_section_order: cleanPortfolioOrder\(/);
});
