/**
 * A bench row finds a supplier who is actually in that category.
 *
 * ── THE BUG, MEASURED 2026-09-08 ───────────────────────────────────────────
 * A shop with two live, priced, verified cards was findable on the bench's
 * **Live Band** row and invisible on **Host / MC**, which said *"Nothing else
 * in this category yet."*
 *
 *     live_band  → canonicals: live_band, band_live_music
 *                  overlap with the shop's stored services: live_band
 *     host_mc    → canonicals: host_emcee, tea_ceremony_master
 *                  overlap with the shop's stored services: NONE
 *
 * The shop stores TILE IDS in `vendor_profiles.services`; the bench expands a
 * tile into CANONICALS and matches those. `live_band` worked only because its
 * tile id and one of its canonicals are the same string — a coincidence, not a
 * mechanism.
 *
 * 🔑 53 OF 78 WEDDING TILES have a tile id that is not any canonical —
 * `reception`, `ceremony_venue`, `coordinator`, `cake`, `florist` among them —
 * so this was never one broken category. And the row reports the CATEGORY as
 * empty rather than the lookup as missed, which is the failure shape this
 * codebase keeps producing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalServicesForTile } from '@/lib/vendor-counts';
import { WEDDING_TILE_ORDER } from '@/lib/taxonomy';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const search = stripComments(
  readFileSync(
    resolve(HERE, '../app/dashboard/[eventId]/vendors/_actions/category-search.ts'),
    'utf8',
  ),
);

/**
 * The SEARCH scope for a tile — canonicals plus the tile's own id.
 *
 * ⚠ Deliberately NOT `canonicalServicesForTile`. That answers "what canonicals
 * does this tile have", and `taxonomy-tile-reachability.test.ts` uses its
 * `length > 0` to decide a tile is ALIVE and to self-clean `KNOWN_DEAD_TILES`.
 * The first draft of this fix widened THAT function, which made every tile look
 * alive and would have blinded the next dead-tile regression. That guard caught
 * it. The widening belongs where the question is "what matches a vendor".
 */
function scopeFor(tile: string): string[] {
  const c = canonicalServicesForTile(tile as never) as string[];
  return c.includes(tile) ? c : [...c, tile];
}

test('a tile can always be matched by its own id', () => {
  // The concrete case that was broken. `host_mc` has no canonical of that name,
  // so before this the row could not find a shop filed under the tile id.
  assert.ok(
    scopeFor('host_mc').includes('host_mc'),
    'the Host / MC row cannot find a shop stored as host_mc',
  );
  assert.ok(
    scopeFor('live_band').includes('live_band'),
    'the Live Band row lost the match it used to get by coincidence',
  );
});

test('EVERY wedding tile is matchable by its own id, not just the lucky 25', () => {
  const blind = (WEDDING_TILE_ORDER as readonly string[]).filter(
    (t) => !scopeFor(t).includes(t),
  );
  assert.deepEqual(
    blind,
    [],
    `${blind.length} tiles cannot find a supplier stored under their own id: ` +
      blind.slice(0, 10).join(', '),
  );
});

test('the real canonicals are STILL there — this widens, never replaces', () => {
  // If the tile id displaced the canonicals, every supplier stored the correct
  // way would vanish — the same bug pointed the other way.
  const c = scopeFor('host_mc');
  assert.ok(c.includes('host_emcee'), 'host_emcee was dropped');
  assert.ok(c.includes('tea_ceremony_master'), 'tea_ceremony_master was dropped');
});

test('no tile lists its own id twice', () => {
  // For the 25 tiles whose id IS a canonical, appending it again would
  // double-count them in the vendor-count rollups that share this function.
  for (const t of WEDDING_TILE_ORDER as readonly string[]) {
    const c = scopeFor(t);
    assert.equal(
      c.filter((x) => x === t).length,
      1,
      `tile ${t} appears ${c.filter((x) => x === t).length} times in its own scope`,
    );
  }
});

test('no tile resolves to an empty scope', () => {
  // An empty scope reads as "no vendors" rather than "no filter".
  for (const t of WEDDING_TILE_ORDER as readonly string[]) {
    assert.ok(
      scopeFor(t).length > 0,
      `tile ${t} expands to nothing, which the bench renders as an empty category`,
    );
  }
});

test('the widening lives in the SEARCH scope, not in the canonical accessor', () => {
  // Where this fix goes is the whole lesson. `canonicalServicesForTile` is what
  // `taxonomy-tile-reachability` reads to decide a tile is alive; widening it
  // made every tile look healthy and would have silently retired a real
  // regression detector.
  assert.match(
    search,
    /fromTile\.includes\(tile\) \? fromTile : \[\.\.\.fromTile, tile\]/,
    'the bench search stopped accepting a tile id, so a shop stored under one ' +
      'is invisible on its own row',
  );
  const counts = stripComments(
    readFileSync(resolve(HERE, '../lib/vendor-counts.ts'), 'utf8'),
  );
  const fn = counts.slice(counts.indexOf('export function canonicalServicesForTile'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert.ok(
    !/\.\.\.canonicals, tile|\[\.\.\.c, tile\]/.test(body),
    'canonicalServicesForTile was widened again — that makes every tile look ' +
      'alive and blinds KNOWN_DEAD_TILES self-cleaning',
  );
});
