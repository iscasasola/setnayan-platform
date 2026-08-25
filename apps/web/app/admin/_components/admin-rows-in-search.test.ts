/**
 * admin-rows-in-search.test.ts — a search can land on a ROW, and the link it
 * builds points at something that exists.
 *
 * The owner's first sentence was "take me to the pricing for papic services",
 * and the drawn prototype answers it by landing on the Papic rows. The route map
 * indexes pages; rows come from the database. This is that half.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

import { skuAnchorId } from '@/lib/admin-map/sku-anchor';
import { rankBySentence } from '@/lib/admin-map/rank-by-sentence';

import { buildDestinations, type Dest, type RowDest } from './admin-destinations';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');

/** Real shapes from the production catalog, so the probe is not invented. */
const ROWS: RowDest[] = (
  [
    ['PAPIC_GUEST_100', 'Papic — add 100 shots', true],
    ['PAPIC_GUEST', 'Papic — add 3,000 shots', true],
    ['PAPIC_GUEST_10K', 'Papic — add 10,000 shots', true],
    ['PAPIC_SEATS', 'Papic (5 Seats)', false],
    ['COUPLE_WEBSITE_PRO', 'Event Hub Pro', true],
  ] as [string, string, boolean][]
).map(([code, title, active]) => ({
  label: title,
  href: `/admin/pricing?tab=pricing#${skuAnchorId(code)}`,
  hay: `${title} ${code} ${code.replace(/_/g, ' ')} price prices`.toLowerCase(),
  hint: active ? 'price' : 'price · off sale',
}));

function score(d: Dest, needle: string): number {
  if (!needle) return 1;
  const l = d.label.toLowerCase();
  let raw = 0;
  const i = l.indexOf(needle);
  if (i === 0) raw = 100;
  else if (i > 0) raw = Math.max(20, 60 - i);
  else if (d.hay.includes(needle)) raw = 15;
  else {
    let p = 0;
    for (let c = 0; c < l.length && p < needle.length; c++) if (l[c] === needle[p]) p++;
    raw = p === needle.length ? 8 : 0;
  }
  if (d.source === 'map') return raw / 2;
  if (d.source === 'row') return raw / 3;
  return raw;
}

const rank = (q: string, rows = ROWS) =>
  rankBySentence(buildDestinations(rows), q, score, 6).hits;

test('the link and the element it points at come from ONE helper', () => {
  // 🔑 The quietest failure in this family: a href written in one file and an
  // `id` typed in another. The link works, the page opens, and it never scrolls.
  const editor = readFileSync(
    join(WEB, 'app/admin/pricing/_components/catalog-editor.tsx'),
    'utf8',
  );
  assert.match(editor, /id=\{skuAnchorId\(/, 'the price row stopped stamping the shared anchor');
  assert.match(
    editor,
    /from '@\/lib\/admin-map\/sku-anchor'/,
    'the row editor stopped importing the shared helper',
  );
  const reader = readFileSync(join(WEB, 'lib/admin-map/admin-row-index.ts'), 'utf8');
  assert.match(reader, /skuAnchorId\(code\)/, 'the href stopped using the shared helper');
  // And the id it produces is a legal HTML id every time.
  for (const code of ['PAPIC_GUEST_10K', 'COUPLE_WEBSITE_PRO', 'SDE']) {
    assert.match(skuAnchorId(code), /^sku-[a-z0-9-]+$/);
  }
});

test('the anchor helper is a leaf — no server module can ride into the browser', () => {
  // The row editor is a 'use client' component. If the helper lived beside the
  // database reader, importing it would pull the service-role client into the
  // admin bundle.
  const leaf = readFileSync(join(WEB, 'lib/admin-map/sku-anchor.ts'), 'utf8');
  assert.ok(!/^import /m.test(leaf), 'sku-anchor.ts grew an import — it must stay a leaf');
});

test('a price row is findable by its own words', () => {
  const hits = rank('papic 3000 shots');
  assert.equal(hits[0]!.label, 'Papic — add 3,000 shots');
  assert.match(hits[0]!.href, /#sku-papic-guest$/);
});

test('a row never outranks the page that holds it for a vague query', () => {
  // "pricing" is a page word, not a row word. If a row could win here, one
  // catalogue entry would shadow the screen that edits all of them.
  assert.match(rank('pricing')[0]!.href, /^\/admin\/pricing\?tab=pricing$/);
  assert.match(rank('papic prices')[0]!.href, /^\/admin\/pricing/);
  assert.equal(rank('papic prices')[0]!.href.includes('#'), false);
});

test('rows are grouped as prices, and an off-sale one says so', () => {
  const dests = buildDestinations(ROWS);
  const rows = dests.filter((d) => d.source === 'row');
  assert.equal(rows.length, ROWS.length);
  const retired = rows.find((r) => r.label === 'Papic (5 Seats)');
  assert.ok(retired, 'the retired row vanished');
  assert.match(retired.group, /off sale/, 'a retired price no longer says it is off sale');
});

test('with no rows the destination list is exactly what it was', () => {
  const withNone = buildDestinations().map((d) => d.href).join('>');
  const withRows = buildDestinations(ROWS)
    .filter((d) => d.source !== 'row')
    .map((d) => d.href)
    .join('>');
  assert.equal(withNone, withRows, 'adding rows disturbed the pages');
});

test('the reader shows RETIRED prices, unlike the customer catalog', () => {
  // 🪤 fetchV2CustomerCatalog filters `is_active = true` and name-excludes SKUs,
  // because it feeds the PUBLIC price page. Reusing it here would hide 17 of the
  // 22 Papic rows from the person whose job is to edit them.
  // 🪤 STRIPPED FIRST, and it caught me on the first run: this module's own
  // docblock NAMES fetchV2CustomerCatalog to explain why it does not use it, so
  // a raw-source match reported the defect the comment exists to prevent. Prose
  // about a thing is not the thing — the house rule, paid for again.
  const reader = stripComments(
    readFileSync(join(WEB, 'lib/admin-map/admin-row-index.ts'), 'utf8'),
  );
  assert.ok(
    !reader.includes('fetchV2CustomerCatalog'),
    'the admin row reader is reusing the customer catalog and will hide retired prices',
  );
  assert.ok(!/\.eq\('is_active'/.test(reader), 'the admin row reader started filtering is_active');
  assert.match(reader, /is_active/, 'the reader stopped reading is_active at all');
});

test('the layout actually hands the rows to the palette', () => {
  const layout = readFileSync(join(WEB, 'app/admin/layout.tsx'), 'utf8');
  assert.match(layout, /await fetchAdminRows\(\)/, 'the layout stopped fetching rows');
  assert.match(layout, /<AdminCommandPalette rows=\{/, 'the palette stopped receiving them');
});
