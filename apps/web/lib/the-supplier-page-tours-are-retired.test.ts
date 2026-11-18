/**
 * the-supplier-page-tours-are-retired.test.ts — 🔦 the supplier has ONE tour (walker W1-B14 · owner 16 Nov 2026).
 *
 * The walker found three auto-tours opening one after another on the supplier dashboard. The journey
 * (`supplier_spotlight_v1`) already walks every tab, so the owner ruled the seven per-page tours that no longer
 * auto-open are DELETED — Shop · Hub · Dates · Money · Today · Clients · Collections — with their mount, their path
 * rule, their words and their lab screens. Held as properties:
 *   1 · none of the seven keys is a tour any more (TOURS and TOUR_KEYS);
 *   2 · the path rule and the layout mount are gone, and nothing in the app imports them;
 *   3 · the tours that stay are still there — the journey and a new shop's tour after step 6.
 *
 * A `tour_seen_keys` row that still lists a retired key is harmless: nothing reads those keys.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { TOURS, TOUR_KEYS } from '@/lib/tours';

const WEB = process.cwd();

const RETIRED = [
  'vendor_shop_v1',
  'vendor_hub_v1',
  'vendor_dates_v1',
  'vendor_money_v1',
  'vendor_today_v3',
  'vendor_people_v1',
  'vendor_collections_v1',
] as const;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

test('1 · none of the seven supplier page tours is a tour any more', () => {
  for (const k of RETIRED) {
    assert.ok(!(TOUR_KEYS as ReadonlyArray<string>).includes(k), `${k} is back in TOUR_KEYS`);
    assert.ok(!(k in TOURS), `${k} is back in TOURS`);
  }
});

test('2 · the path rule and the layout mount are gone, and nothing imports them', () => {
  for (const f of [
    'lib/supplier-page-tours.ts',
    'app/vendor-dashboard/_components/supplier-page-spotlight.tsx',
    'app/vendor-dashboard/_components/supplier-page-spotlight-mount.tsx',
  ]) {
    assert.ok(!existsSync(join(WEB, f)), `${f} is back`);
  }
  const files = ['app', 'lib'].flatMap((r) => walk(join(WEB, r)));
  assert.ok(files.length > 500, `anti-vacuity: only ${files.length} source files were read`);
  const hits = files
    .filter((f) => {
      const src = stripComments(readFileSync(f, 'utf8'));
      return /supplier-page-tours|supplier-page-spotlight|SupplierPageSpotlight/.test(src) || RETIRED.some((k) => src.includes(`'${k}'`));
    })
    .map((f) => relative(WEB, f));
  assert.deepEqual(hits, [], 'a retired supplier page tour is still wired in');
  assert.doesNotMatch(stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/layout.tsx'), 'utf8')), /SupplierPageSpotlight/);
});

test('3 · the supplier tours that stay are still there', () => {
  for (const k of ['supplier_spotlight_v1', 'vendor_setup_tour_v1'] as const) {
    assert.ok(TOUR_KEYS.includes(k), `${k} left TOUR_KEYS`);
    assert.ok(TOURS[k].spotlight, `${k} lost its spotlight`);
  }
  assert.match(
    stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/layout.tsx'), 'utf8')),
    /<Spotlight tourKey="supplier_spotlight_v1"/,
    'the journey is no longer mounted in the supplier layout',
  );
});
