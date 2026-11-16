/**
 * the-signup-service-is-never-asked.test.ts — 🧰 WALK STEP 3, FAULT 2 (2026-11-16): after Create the maker asked
 * "Add Florals to what you do?" of a shop that picked Florals at sign-up.
 *
 * Sign-up stores `vendor_profiles.services` as `[coarse category, picked leaf, …added]` (`app/open-shop/actions.ts`).
 * Cut 3 counted only the entries that are themselves live leaves, but a card's kind is asked about through
 * `coverageLeafForKind`, which maps a COARSE kind to its tile's leaf — so a coarse entry the read dropped was asked
 * about again. The claim tested here is the owner's sentence: never ask to add a service the shop already has, read
 * the way sign-up stores it. It is tested on the real rule (`coverageAskFor`), for EVERY coarse category sign-up can
 * store, not on the code's shape.
 *
 * Sabotage: make `signupCoveredLeaves` keep only live-leaf entries (cut 3's filter) → test 1 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { coverageAskFor, coverageLeafForKind, signupCoveredLeaves } from './service-card-maker';
import { VENDOR_CATEGORY_CANONICAL } from './vendor-category-taxonomy';
import type { LeafIndex } from './service-card-kind';

const WEB = join(__dirname, '..');

/** A leaf index holding exactly these live leaves (label = key, one family each). */
function leavesOf(keys: readonly string[]): LeafIndex {
  return {
    label: new Map(keys.map((k) => [k, k])),
    folder: new Map(keys.map((k) => [k, `family_${k}`])),
  } as unknown as LeafIndex;
}

test('1 · every coarse category sign-up can store is covered — a card of it is never asked about', () => {
  let checked = 0;
  for (const [coarse, m] of Object.entries(VENDOR_CATEGORY_CANONICAL)) {
    const tile = m.kind === 'tile' ? m.tile : m.kind === 'tiles' ? m.tiles[0] : null;
    if (!tile || tile === coarse) continue; // a coarse key that IS its leaf was already counted by cut 3
    const leaves = leavesOf([tile]);
    const covered = new Set(signupCoveredLeaves([coarse], leaves, new Set()).covered);
    assert.equal(coverageLeafForKind(coarse, leaves), tile, `anti-vacuity: ${coarse} does not resolve to ${tile}`);
    assert.equal(coverageAskFor(coarse, leaves, covered), null, `a shop that signed up as "${coarse}" is asked to add it`);
    assert.equal(coverageAskFor(tile, leaves, covered), null, `a shop that signed up as "${coarse}" is asked to add ${tile}`);
    checked++;
  }
  assert.ok(checked >= 10, `anti-vacuity: only ${checked} coarse categories were checked`);
});

test('2 · the shape sign-up writes — coarse first, then the picked leaf — lists the picked leaf only, covers both', () => {
  const leaves = leavesOf(['stylist_decorator', 'table_styling']);
  const got = signupCoveredLeaves(['reception_decor', 'table_styling'], leaves, new Set());
  assert.deepEqual(got.listed, ['table_styling'], 'the picked leaf is not the one listed (or a broader row was added beside it)');
  assert.deepEqual([...got.covered].sort(), ['stylist_decorator', 'table_styling']);
  /* A coarse-only shop still opens on its own service. */
  assert.deepEqual(signupCoveredLeaves(['reception_decor'], leaves, new Set()).listed, ['stylist_decorator']);
  /* A coverage row is not listed twice, and a service that is not a live leaf is never invented. */
  assert.deepEqual(signupCoveredLeaves(['reception_decor'], leaves, new Set(['stylist_decorator'])).covered, []);
  assert.deepEqual(signupCoveredLeaves(['not_a_kind', '', 'misc'], leaves, new Set()).covered, []);
  /* Anti-vacuity: a service the shop never picked IS still asked about. */
  assert.ok(coverageAskFor('table_styling', leaves, new Set()), 'an uncovered kind is no longer asked about at all');
});

test('3 · the maker context counts the sign-up services through that one rule (read only)', () => {
  const ctx = stripComments(readFileSync(join(WEB, 'lib/service-card-maker.server.ts'), 'utf8'));
  assert.match(ctx, /from\('vendor_profiles'\)\.select\('tier_state, is_founder, services'\)/, 'the sign-up services are not read');
  assert.match(ctx, /const signup = signupCoveredLeaves\(tierRow\?\.services, leaves, /);
  assert.match(ctx, /const coveredLeafSet = new Set\(\[\.\.\.vendorCoverages\.map\(\(c\) => c\.canonical_service\), \.\.\.signup\.covered\]\);/, 'a sign-up service is asked about again');
  assert.match(ctx, /const a = coverageAskFor\(k, leaves, coveredLeafSet\);/, 'the question no longer asks of the covered set');
});
