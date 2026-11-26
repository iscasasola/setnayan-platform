/**
 * 🔒 A7-20 (final check 25 Nov; drawing `prototypes/final-check-area-7_2026-11-25/` § 2, approved):
 *   2a · the result has ONE hero number — the average upload, said against what the stream needs — and the other two
 *        numbers as quiet rows; "Stream needs" is no longer its own tile.
 *   2b · a refused event read says "Couldn't load this event just now" with Try again — never the 404.
 *   2c · the progress fill moves by transform (scaleX) at Move 320, never by width over 500 ms.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));

const RUNNER = stripComments(readFileSync(join(HERE, '_components', 'venue-check-runner.tsx'), 'utf8'));
const body = (fn: string) => {
  const at = RUNNER.indexOf(`export function ${fn}(`);
  assert.ok(at > -1, `${fn} is gone`);
  const next = RUNNER.indexOf('\nexport function ', at + 10);
  return RUNNER.slice(at, next < 0 ? undefined : next);
};

test('2a · the result: one hero number against the stream, two quiet rows, no Upload or Stream needs tile', () => {
  const done = body('VenueCheckDone');
  assert.match(done, /data-venue-check-hero=""[\s\S]*text-sn-title text-ink">\{formatMbps\(judgement\.averageBps\)\}/);
  assert.match(done, /upload · the stream needs \{formatMbps\(STREAM_FULL_BPS\)\.replace\(/);
  assert.doesNotMatch(done, /label="Stream needs"|label="Upload"/, 'a tile is back');
  assert.match(done, /<Fact label="Slowest second"/);
  assert.match(done, /<Fact label="Delay"/);
  assert.equal((done.match(/<Fact /g) ?? []).length, 2, 'more than the two quiet rows');
  assert.doesNotMatch(RUNNER, /grid grid-cols-2/, 'the four equal tiles are back');
});

test('2c · the fill moves by transform at Move 320, never width over 500 ms', () => {
  const busy = body('VenueCheckBusy');
  assert.match(busy, /transform: `scaleX\(\$\{pct \/ 100\}\)`/);
  assert.match(busy, /transition: 'transform var\(--sn-m-move\) var\(--sn-m-settle\)'/);
  assert.match(busy, /motion-reduce:transition-none/);
  assert.doesNotMatch(RUNNER, /transition-\[width\]|duration-500/);
});

test('2b · a refused event read says so with Try again; only an answered miss is the 404', () => {
  const src = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
  const refused = src.indexOf('if (eventError) {');
  const missing = src.indexOf('if (!event) notFound();');
  assert.ok(refused > -1 && missing > refused, 'the refused read is not decided before the 404');
  assert.match(src.slice(refused, missing), /Couldn&rsquo;t load this event just now\. Nothing was changed\./);
  assert.match(src.slice(refused, missing), /label="Try again"/);
});
