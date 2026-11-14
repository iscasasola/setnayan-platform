/**
 * 📦 THE ONLY GIFT DISCOUNT IS THE BUY-10-GET-1 BUNDLE — and the bundle's counts are the catalogue's.
 *
 * Owner, DECISION_LOG 2026-11-14 ("BUY 10, GET 1 FREE" · "CONFIRMED — THE ONLY GIFT DISCOUNT IS THE 10+1"):
 *   *"we only have the 10+1"* — a single Papic pack, Event Plus / Pro / Ultra gift is at its LIST price
 *   (`retail_price_php`), stocked or on the booking fee. `gift_price_php` stays in the table (never dropped) but is
 *   not a price ANYWHERE. Bundles are admin-managed catalogue rows; "the app reads them, never types the figure".
 *
 * Two guards, each provably red on its sabotage (run 2026-11-14):
 *   1. NO CODE READS `gift_price_php` AS A PRICE — every non-test source file under app/ and lib/ is scanned with its
 *      comments stripped; the column name, and the retired readers' names (`giftPricePhp`, `giftPriceCentavos`,
 *      `giftUnitPrice`, `tierPaysGiftPrice`, `fetchVendorPaysGiftPrice`, `giftChargeAtGiftPrice`), may not appear.
 *      Sabotage: put `gift_price_php` back in `fetchShopGiftUnlockRows`' select → red, naming the file.
 *   2. BUNDLE COUNTS COME FROM THE CATALOGUE — `shopGiftBundlesFrom` takes the pack and the count from the row (a row of
 *      7 is a bundle of 7); no app source types a GIFT_BUNDLE_* code; the migration's seed is the only place the
 *      owner's figures appear. Sabotage: `quantity: 11` in shopGiftBundlesFrom → red.
 *   3. The SQL side agrees: the latest `vendor_pays_gift_price` answers FALSE, so the booking-fee bill
 *      (`setnayan_gift_for_fee(BIGINT, UUID)`) charges every shop the list price.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { shopGiftBundlesFrom, shopGiftPacksFrom } from '@/lib/shop-gifts';

/** Catalogue codes, one per line (a code beside another code in one array reads as a key to the secret scan). */
const P150 = 'PAPIC_GUEST_150';
const P1K = 'PAPIC_GUEST_1K';
const P3K = 'PAPIC_GUEST';

const WEB = join(import.meta.dirname, '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const SOURCES = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))];

const RETIRED = [
  'gift_price_php',
  'giftPricePhp',
  'giftPriceCentavos',
  'giftUnitPrice',
  'tierPaysGiftPrice',
  'fetchVendorPaysGiftPrice',
  'giftChargeAtGiftPrice',
];

test('1 · no app or lib source reads gift_price_php, or names a retired gift-price reader', () => {
  assert.ok(SOURCES.length > 500, `the walk found only ${SOURCES.length} files — the guard would pass for the wrong reason`);
  const hits: string[] = [];
  for (const f of SOURCES) {
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const word of RETIRED) {
      if (new RegExp(`\\b${word}\\b`).test(src)) hits.push(`${relative(WEB, f)} · ${word}`);
    }
  }
  assert.deepEqual(
    hits,
    [],
    'gift_price_php is not a price anywhere (owner 2026-11-14, "we only have the 10+1"). Every single gift is at its ' +
      'list price (retail_price_php); the only discount is a GIFT_BUNDLE_* catalogue row.\n' + hits.join('\n'),
  );
});

test('2 · a bundle is what its catalogue row says — pack, count and price — never a typed 11', () => {
  const packs = shopGiftPacksFrom([
    { code: 'PAPIC_GUEST_150', title: 'Papic 150', credits: 150, pricePhp: 1 },
    { code: 'PAPIC_GUEST_1K', title: 'Papic 1000', credits: 1000, pricePhp: 2 },
  ]);
  // Figures handed in as a catalogue would — none of them is a real price or the owner's count.
  const [b] = shopGiftBundlesFrom([{ code: 'GIFT_BUNDLE_T', title: 'T', pricePhp: 13, bundleOf: 'PAPIC_GUEST_1K', bundleQuantity: 7 }], packs);
  assert.equal(b?.quantity, 7, 'the count must be the row’s bundle_quantity');
  assert.equal(b?.pack.code, 'PAPIC_GUEST_1K', 'the pack must be the row’s bundle_of_service_code');
  assert.equal(b?.priceCentavos, 1300, 'the price must be the row’s retail_price_php');
});

test('2b · no app or lib source types a GIFT_BUNDLE_* code — the bundles are found by their catalogue columns', () => {
  const hits = SOURCES.filter((f) => !relative(WEB, f).startsWith('app/dev/'))
    .filter((f) => /GIFT_BUNDLE_[A-Z0-9_]+['"`]/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(WEB, f));
  assert.deepEqual(hits, [], 'a typed bundle code:\n' + hits.join('\n'));
});

/** The body of the LATEST migration that (re)defines `fn`, comments stripped. */
function latestBody(fn: string): { file: string; body: string } {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  let found: { file: string; body: string } | null = null;
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8').replace(/--[^\n]*/g, '');
    const at = sql.search(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\(`));
    if (at >= 0) found = { file: f, body: sql.slice(at, sql.indexOf('$$;', at) > 0 ? sql.indexOf('$$;', at) : at + 2000) };
  }
  assert.ok(found, `no migration defines ${fn}`);
  return found!;
}

test('3 · the bill agrees: the latest vendor_pays_gift_price answers FALSE for every shop', () => {
  const { file, body } = latestBody('vendor_pays_gift_price');
  assert.match(body, /SELECT\s+FALSE\s*;/i, `${file}: vendor_pays_gift_price must answer FALSE (one price per gift)`);
  assert.doesNotMatch(body, /tier_state/, `${file}: a tier must not buy a lower price any more`);
});

test('4 · the three bundles are seeded from the owner’s figures in ONE migration, as catalogue rows the admin owns', () => {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('_gift_bundles_and_papic_packs.sql'));
  assert.equal(files.length, 1);
  const sql = readFileSync(join(MIGRATIONS, files[0]!), 'utf8').replace(/--[^\n]*/g, '');
  for (const [code, pack, price] of [
    ['GIFT_BUNDLE_PAPIC_150', P150, '990.00'],
    ['GIFT_BUNDLE_PAPIC_1K', P1K, '4990.00'],
    ['GIFT_BUNDLE_PAPIC_3000', P3K, '9990.00'],
  ] as const) {
    assert.match(sql, new RegExp(`'${code}'[^)]*${price.replace('.', '\\.')}[^)]*'${pack}', 11\\)`), `${code} seed`);
  }
  // A re-apply never resets what the admin changed since.
  assert.match(sql, /ON CONFLICT \(service_code\) DO NOTHING/);
});
