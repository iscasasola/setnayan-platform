/**
 * the-found-you-line-reaches-the-supplier.test.ts — owner 16 Nov 2026 (DECISION_LOG e5d166cd (2)): a supplier sees where
 * and when a couple found them — "Found you on Setnayan · from Search, 3 Nov" — on their client card and on the fee bill.
 *
 *   · the line is built ONCE, beside the admin's `foundReceiptLine`, from the same found-record (no second copy);
 *   · the date is the MANILA day the couple first opened the shop (a 1:30 AM Manila open is that day, not UTC's);
 *   · every surface the fee counts as Setnayan-found has plain words — and an unknown value prints no raw code;
 *   · the client card and the bill both read the record scoped to the shop and event they already proved, and draw it;
 *   · the bill shows it on every bill with a charge, not only after a dispute;
 *   · the admin's receipt now names the surface too.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { FOUND_SURFACE_WORDS, foundReceiptLine, foundYouLine } from './booking-fee-dispute';
import { SOURCED_INQUIRY_SOURCES } from './booking-fee-gate';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the line reads as ruled, on the Manila day', () => {
  // 17:30 UTC on 2 Nov is 1:30 AM on 3 Nov in Manila.
  assert.equal(foundYouLine('2026-11-02T17:30:00Z', 'search'), 'Found you on Setnayan · from Search, 3 Nov');
  assert.equal(foundYouLine('2026-11-03T02:00:00Z', 'explore'), 'Found you on Setnayan · from Discover, 3 Nov');
  assert.equal(foundYouLine(null, 'search'), null, 'no record draws nothing');
  assert.equal(foundYouLine('not a date', 'search'), null, 'an unreadable date draws nothing');
  assert.equal(foundYouLine('2026-11-03T02:00:00Z', 'some_new_code'), 'Found you on Setnayan · 3 Nov', 'a raw code reached a person');
});

test('every Setnayan surface the fee counts has plain words', () => {
  assert.deepEqual(Object.keys(FOUND_SURFACE_WORDS).sort(), [...SOURCED_INQUIRY_SOURCES].sort());
  for (const [k, w] of Object.entries(FOUND_SURFACE_WORDS)) {
    assert.doesNotMatch(w, /_/, `${k} prints a code, not a word`);
    const line = foundYouLine('2026-11-03T02:00:00Z', k) ?? '';
    assert.ok(line.includes(`from ${w}, `), line);
    assert.doesNotMatch(line, /fee|commission|charge/i, 'the found line talks about money');
  }
});

test('the admin receipt names the surface too, and keeps its old line when no surface was read', () => {
  assert.match(foundReceiptLine('2026-07-11T23:30:00Z', 3, 'search'), /here from Search on July 12, 2026, 3 times/);
  assert.match(foundReceiptLine('2026-07-11T23:30:00Z', 3), /^The couple first opened this shop here on July 12, 2026, 3 times/);
  assert.match(
    code('app/admin/disputes/_components/booking-fee-disputes-section.tsx'),
    /foundReceiptLine\([^)]*f\?\.first_source/,
    'the admin queue does not hand the surface to its receipt',
  );
});

/** The found-record read in a page: from `event_vendor_found`, naming both columns, scoped by the given shop id. */
function assertScopedRead(src: string, rel: string, shop: RegExp) {
  const at = src.indexOf(".from('event_vendor_found')");
  assert.ok(at >= 0, `${rel} no longer reads the found-record`);
  const chain = src.slice(at, src.indexOf('.maybeSingle()', at));
  assert.match(chain, /\.select\('[^']*first_found_at[^']*first_source[^']*'\)/, `${rel}: the read lost a column`);
  assert.match(chain, /\.eq\('event_id', /, `${rel}: the read is not scoped to the event`);
  assert.match(chain, shop, `${rel}: the read is not scoped to the proven shop`);
}

test('the client card reads the record for this shop and draws the line', () => {
  const rel = 'app/vendor-dashboard/clients/[eventId]/page.tsx';
  const src = code(rel);
  assertScopedRead(src, rel, /\.eq\('vendor_profile_id', profile\.vendor_profile_id\)/);
  assert.match(src, /const foundLine = foundYouLine\(foundRow\?\.first_found_at, foundRow\?\.first_source\)/);
  assert.match(src, /foundLine=\{foundLine\}/, 'the line is not handed to the card');
  assert.match(src, /\{foundLine \? \([\s\S]{0,160}★ \{foundLine\}/, 'the card does not draw the line');
});

test('the bill reads the record for its own charge and draws the line on every bill', () => {
  const rel = 'app/vendor-dashboard/booking-fees/[orderId]/page.tsx';
  const src = code(rel);
  assertScopedRead(src, rel, /\.eq\('vendor_profile_id', c\.vendor_profile_id\)/);
  const block = src.slice(src.indexOf('let foundLine'), src.indexOf('const canDispute'));
  assert.ok(block.length > 0, 'anti-vacuity: the found block moved');
  assert.match(block, /^\s*foundLine = foundYouLine\(f\?\.first_found_at, f\?\.first_source\);$/m, 'the found line is set under a condition');
  assert.deepEqual(
    block.match(/[^\n]*auto_accepted[^\n]*/g)?.map((l) => l.trim()),
    ["if (disputeStatus === 'auto_accepted') disputeViewCount = f?.view_count ?? null;"],
    'something besides the dispute count waits for an accepted dispute',
  );
  assert.doesNotMatch(src.slice(src.indexOf('let foundLine') - 400, src.indexOf('let foundLine')), /auto_accepted/, 'the read waits for a dispute');
  assert.match(src, /\{foundLine \? \([\s\S]{0,160}★ \{foundLine\}/, 'the bill does not draw the line');
});

test('the words stay pure — no server-only import, no server action', () => {
  const lib = code('lib/booking-fee-dispute.ts');
  assert.doesNotMatch(lib, /server-only|['"]use server['"]/);
});

test('the surface words are the labels couples saw — editorial reads "Articles", never "Real Stories"', () => {
  assert.equal(FOUND_SURFACE_WORDS.editorial, 'Articles');
  assert.equal(foundYouLine('2026-11-02T17:30:00Z', 'editorial'), 'Found you on Setnayan · from Articles, 3 Nov');
  for (const [code, words] of Object.entries(FOUND_SURFACE_WORDS)) {
    assert.doesNotMatch(words, /real\s*stories/i, `${code} still names the retired Real Stories section`);
  }
  assert.equal(FOUND_SURFACE_WORDS.auto_build, '“Reach my best matches”');
  assert.equal(FOUND_SURFACE_WORDS.influencer, '“Book through this chapter”');
  assert.equal(FOUND_SURFACE_WORDS.favorites, 'Saved suppliers');
});
