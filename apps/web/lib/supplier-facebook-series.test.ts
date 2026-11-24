/**
 * supplier-facebook-series.test.ts: the 21 supplier Facebook posts ship exactly as approved (owner 2026-11-24:
 * "supplier posts to december appoved") and stay OUT of the queue until the Meta app is Live.
 *
 *   1. Held: while SUPPLIER_SERIES_RELEASE is null, no migration queues a series row. Once it is set, the release
 *      migration must equal what the source generates.
 *   2. The captions: 21 posts numbered 1–21, ≤ 3 lines of ≤ 12 words, one link to a real page.
 *   3. The house words and money rule: no typed peso figure, no "vendor", "website" or "down payment".
 *   4. The images: one 1080 × 1080 JPEG per post, small enough for Facebook.
 *   5. The release SQL: an 'announcement' row per post with its own image, the link inside the caption, a
 *      publish_after on its day, re-runnable, and never a `journal:` ref (so the Articles sweep #8268 never doubles).
 *
 * SABOTAGE (run 2026-11-24; each turned this file red): a stray migration inserting 'supplier-series-2026-11:01' (1) ·
 * a 13-word line (2) · "₱999" in a caption (3) · supplier-07.jpg deleted (4) · the link dropped from the body (5).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  SUPPLIER_FACEBOOK_SERIES,
  SUPPLIER_SERIES_REF_PREFIX,
  SUPPLIER_SERIES_RELEASE,
  supplierPostBody,
  supplierPostDay,
  supplierPostImage,
  supplierPostRef,
  supplierSeriesReleaseSql,
} from '@/lib/supplier-facebook-series';

const APP = path.resolve(__dirname, '../app');
const PUBLIC = path.resolve(__dirname, '../public');
const MIGRATIONS = path.resolve(__dirname, '../../../supabase/migrations');
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Width and height from a JPEG's start-of-frame marker. */
function jpegSize(buf: Buffer): { w: number; h: number } | null {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

test('1 · held: no migration queues the series until the release is set', () => {
  const touching = fs
    .readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql') && fs.readFileSync(path.join(MIGRATIONS, f), 'utf8').includes(SUPPLIER_SERIES_REF_PREFIX));
  if (SUPPLIER_SERIES_RELEASE === null) {
    assert.deepEqual(touching, [], 'the series is held until the Meta app is Live: no migration may queue it yet');
    return;
  }
  assert.deepEqual(touching, [SUPPLIER_SERIES_RELEASE.migration], 'exactly one migration queues the series');
  assert.equal(
    fs.readFileSync(path.join(MIGRATIONS, SUPPLIER_SERIES_RELEASE.migration), 'utf8'),
    supplierSeriesReleaseSql(SUPPLIER_SERIES_RELEASE),
    'the release migration differs from its source: run (cd apps/web && npx tsx scripts/gen-supplier-facebook-series.ts --write)',
  );
});

test('2 · 21 captions of ≤ 3 lines of ≤ 12 words, one link to a real page', () => {
  assert.equal(SUPPLIER_FACEBOOK_SERIES.length, 21);
  assert.deepEqual(
    SUPPLIER_FACEBOOK_SERIES.map((p) => p.n),
    Array.from({ length: 21 }, (_, i) => i + 1),
  );
  for (const p of SUPPLIER_FACEBOOK_SERIES) {
    assert.ok(p.lines.length >= 1 && p.lines.length <= 3, `post ${p.n}: ${p.lines.length} lines`);
    for (const line of p.lines) {
      assert.ok(words(line) <= 12, `post ${p.n}: "${line}" has ${words(line)} words`);
      assert.doesNotMatch(line, /https?:|www\.|setnayan\.com/i, `post ${p.n}: the link goes after the lines, once`);
    }
    const page = path.join(APP, '(shell)', p.link.slice(1));
    assert.ok(
      fs.existsSync(path.join(APP, p.link.slice(1))) || fs.existsSync(page),
      `post ${p.n}: ${p.link} is not a page under app/`,
    );
    assert.equal((supplierPostBody(p).match(/https:\/\//g) ?? []).length, 1, `post ${p.n}: exactly one link`);
  }
});

test('3 · the house words: no typed peso, no vendor, website or down payment', () => {
  for (const p of SUPPLIER_FACEBOOK_SERIES) {
    const text = p.lines.join(' ');
    assert.doesNotMatch(text, /₱|\bphp\s?\d|\bpeso/i, `post ${p.n}: a typed price`);
    assert.doesNotMatch(text, /\bvendors?\b|\bwebsite\b|down payment|setnayan\.ph/i, `post ${p.n}: a retired word`);
  }
});

test('4 · one 1080 × 1080 JPEG per post', () => {
  for (const p of SUPPLIER_FACEBOOK_SERIES) {
    const file = path.join(PUBLIC, supplierPostImage(p));
    assert.ok(fs.existsSync(file), `post ${p.n}: ${supplierPostImage(p)} is missing`);
    const buf = fs.readFileSync(file);
    assert.deepEqual(jpegSize(buf), { w: 1080, h: 1080 }, `post ${p.n}: not a 1080 × 1080 JPEG`);
    assert.ok(buf.length < 400_000, `post ${p.n}: ${buf.length} bytes is too heavy`);
  }
});

test('5 · the release SQL: one announcement per post, its image, its link, its day', () => {
  const release = { start: '2026-12-01', everyDays: 2 };
  const sql = supplierSeriesReleaseSql(release);
  assert.doesNotMatch(sql, /journal:/, 'never a journal: ref (that is the Articles sweep, #8268)');
  assert.match(sql, /WHERE NOT EXISTS/);
  assert.match(sql, /'announcement'/);
  for (const p of SUPPLIER_FACEBOOK_SERIES) {
    assert.ok(sql.includes(`'${supplierPostRef(p)}'`), `post ${p.n}: no row`);
    assert.ok(sql.includes(supplierPostImage(p)), `post ${p.n}: no image`);
    assert.ok(sql.includes(supplierPostBody(p)), `post ${p.n}: the caption with its link`);
    assert.ok(supplierPostBody(p).endsWith(`https://www.setnayan.com${p.link}`), `post ${p.n}: the link ends the caption`);
  }
  assert.equal(supplierPostDay(SUPPLIER_FACEBOOK_SERIES[0], release), '2026-12-01');
  assert.equal(supplierPostDay(SUPPLIER_FACEBOOK_SERIES[20], release), '2027-01-10');
  assert.equal(new Set(SUPPLIER_FACEBOOK_SERIES.map(supplierPostRef)).size, 21, 'refs are unique');
});
