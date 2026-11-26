/**
 * lib/print-mark-has-no-buffer.test.ts — THE MAKER DOES NOT DOWNLOAD NODE'S `Buffer`.
 *
 * `lib/print-mark.ts` reaches the browser on every event page (the event
 * layout's monogram: event-monogram → monogram-svg-safe → logo-layers →
 * print-mark). On a client build a bare `Buffer` makes Next inject the whole
 * `buffer` polyfill (with base64-js and ieee754): measured ~8.2 KB gzipped in
 * the Maker's first load (`scripts/check-maker-js-budget.mjs`), for one line
 * only the print server ever runs. So the file decodes base64 with `atob`, and
 * these checks hold both halves: no `Buffer` comes back, and the bytes are the
 * bytes `Buffer.from(s, 'base64')` gave.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { rasterMarkPayload } from './print-mark';

test('print-mark.ts names no Buffer (it would pull the buffer polyfill into the Maker)', () => {
  const src = stripComments(readFileSync(join(__dirname, 'print-mark.ts'), 'utf8'));
  assert.doesNotMatch(src, /\bBuffer\b/, 'Decode with atob — a bare Buffer ships ~8 KB of polyfill to every event page.');
});

const wrap = (b64: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><image width="10" height="20" href="data:image/png;base64,${b64}"/></svg>`;

test('the raster mark decodes to the same bytes Buffer gave', () => {
  const samples: string[] = [];
  for (let n = 1; n <= 40; n++) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 97 + n * 31) % 256);
    const b64 = Buffer.from(bytes).toString('base64');
    samples.push(b64, b64.replace(/=+$/, ''));
  }
  // Lone trailing sextets and odd padding the regex still lets through.
  samples.push('A', 'QUJD', 'QUJDR', 'QUI', 'QUI=', 'QQ', 'QQ=', 'QQ==', 'QUJDRA=', 'QUJDRA', '+/+/', 'ab=');
  for (const b64 of samples) {
    const got = rasterMarkPayload(wrap(b64));
    assert.ok(got, `wrapper with ${b64} should parse`);
    assert.deepEqual(Array.from(got.bytes), Array.from(Buffer.from(b64, 'base64')), `bytes for ${b64}`);
    assert.equal(got.mime, 'image/png');
    assert.equal(got.w, 10);
    assert.equal(got.h, 20);
  }
});
