/**
 * D2 (2026-09-11): the "Repertoire" (song bank & setlist) card on the
 * shop-tools shelf listed itself for EVERY shop — a caterer or a stylist got
 * a card whose destination page (`/vendor-dashboard/repertoire`) would just
 * redirect them back out, since that page already gates on `isMusicVendor`.
 * Anchored on `shopToolShelves`'s actual output, the same way
 * `the-moodboard-card-reaches-every-trade.test.ts` pins the sibling card —
 * a source grep for the href cannot see whether it's conditioned at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shopToolShelves } from './shop-tool-shelves';
import { isMusicToolCategory } from '@/lib/songs';

function couplesSeeHrefs(hasMusicRepertoireAccess: boolean): string[] {
  const shelves = shopToolShelves(false, hasMusicRepertoireAccess);
  const shelf = shelves.find((s) => s.key === 'couples-see');
  assert.ok(shelf, 'the couples-see shelf must exist');
  return shelf!.tools.map((t) => t.href);
}

test('a live-band shop gets the Repertoire card', () => {
  const allowed = isMusicToolCategory(['live_band']);
  assert.equal(allowed, true);
  assert.ok(couplesSeeHrefs(allowed).includes('/vendor-dashboard/repertoire'));
});

test('a caterer does NOT get the Repertoire card', () => {
  const allowed = isMusicToolCategory(['catering']);
  assert.equal(allowed, false);
  assert.ok(!couplesSeeHrefs(allowed).includes('/vendor-dashboard/repertoire'));
});

test('a legacy band_dj / string_quartet category still gets the card (widened, not dropped)', () => {
  assert.equal(isMusicToolCategory(['band_dj']), true);
  assert.equal(isMusicToolCategory(['string_quartet']), true);
});
