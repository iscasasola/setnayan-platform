/**
 * ⚖ EVENT HUB PRO PART-HOLDERS KEEP THEIR FULL PRO (owner 2026-10-28, on PR #7005: "Keep their full Pro").
 * Full Pro moved ₱5,000 → ₱6,590; parts bought under the old cap stay everything. The cap and the cutover live ONLY
 * in migration `*_hub_pro_parts_keep_the_old_cap.sql`; this pins the pure half and the wiring. The real-rows proof
 * (an old-week holder keeps it, the same total after the cutover does not) is
 * `tests/db/event-hub-pro-parts-and-the-cap.db.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { hubLegacyPartLinesFrom, hubOwnershipFrom, type HubPartId } from './hub-parts';
import { stripComments } from './strip-comments';

const prices = new Map<string, number>([
  ['COUPLE_HUB_PART_REVEAL', 1000],
  ['COUPLE_HUB_PART_BACKGROUND', 1000],
  ['COUPLE_HUB_PART_PHOTOS', 1000],
  ['COUPLE_HUB_PART_STYLE', 1000],
  ['COUPLE_HUB_PART_MUSIC', 500],
  ['COUPLE_HUB_PART_PRINTS', 500],
]);
const six: HubPartId[] = ['reveal', 'background', 'photos', 'style', 'music', 'prints'];
const base = { fullHeld: false, partHeld: () => false, paidParts: six, prices, fullPrice: 6590 };

test('parts under today’s price are not everything — unless they reached the old cap before the cutover', () => {
  // The sku names above are this test's own sample; skip loudly if the table renamed them.
  assert.equal(hubOwnershipFrom(base).paidPhp, 5000, 'the sample parts no longer price — the sku names moved');
  assert.equal(hubOwnershipFrom(base).full, false, 'no grandfather given → today’s price');
  assert.equal(hubOwnershipFrom({ ...base, legacy: { capPhp: 5000, paidParts: six } }).full, true, 'old-week parts at the old cap');
  assert.equal(hubOwnershipFrom({ ...base, legacy: { capPhp: 5000, paidParts: six.slice(0, 5) } }).full, false, '₱4,500 of old parts');
  assert.equal(hubOwnershipFrom({ ...base, legacy: { capPhp: 5000, paidParts: [] } }).full, false, 'parts bought after the cutover');
  assert.equal(hubOwnershipFrom({ ...base, legacy: null }).full, false, 'an unread grandfather is not applied');
  assert.equal(hubOwnershipFrom({ ...base, legacy: { capPhp: 0, paidParts: six } }).full, false, 'a zero cap is no cap');
});

test('the old-cap answer is read strictly — anything malformed is no grandfather, never a guessed cap', () => {
  assert.deepEqual(hubLegacyPartLinesFrom({ cap_php: 5000, lines: [{ service_key: 'X', status: 'paid' }] }), {
    capPhp: 5000,
    lines: [{ service_key: 'X', status: 'paid' }],
  });
  for (const bad of [null, undefined, 'x', {}, { cap_php: 0, lines: [] }, { cap_php: 'abc', lines: [] }, { cap_php: 5000 }]) {
    assert.equal(hubLegacyPartLinesFrom(bad), null, JSON.stringify(bad));
  }
});

test('the live reader asks the old-cap RPC and feeds it through the same status rule and part map', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'lib/couple-website-pro.ts'), 'utf8'));
  assert.match(src, /supabase\.rpc\('event_hub_pro_legacy_part_lines'/);
  assert.match(src, /legacy: \{\s*capPhp: legacy\.capPhp,\s*paidParts: legacy\.lines\s*\.filter\(\(r\) => counts\(r\.status\)\)\s*\.map\(\(r\) => hubPartOfPaidCode\(r\.service_key\)\)/);
  // The old figure is never typed in the app — it lives in the migration.
  assert.ok(!/\b5_?000\b/.test(src), 'the old cap is typed in the app');
});
