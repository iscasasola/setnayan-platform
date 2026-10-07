/**
 * 🔍 THE GALLERY PICKER STILL CAPS THE QUERY (owner 2026-10-06, DECISION_LOG
 * "EACH MOOD BOARD PART CAN SEARCH SUPPLIERS' PHOTOS": the search box, From ▾,
 * Near ▾ and "Matches my colours" are ADDITIONS to the shipped MB10 picker —
 * `normalizeGalleryQuery` stays the server-side cap).
 *
 * Whatever Studio's filters ask, one page is at most `GALLERY_MAX_LIMIT` rows
 * and paging stops at `GALLERY_MAX_OFFSET`; the words reach the database as
 * letters, digits and spaces only (no filter syntax); From ▾ is a known
 * option, turned into the shop's canonical services from taxonomy tiles; Near
 * ▾ is a known region. And the server action still runs every request through
 * `normalizeGalleryQuery` and `.range()`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { GALLERY_MAX_LIMIT, GALLERY_MAX_OFFSET, GALLERY_PAGE_SIZE, normalizeGalleryQuery } from './moodboard-gallery';
import { GALLERY_FROM } from './inspiration-slots';

test('the filters never lift the cap', () => {
  const q = normalizeGalleryQuery({ slotKey: 'flowers', limit: 1e9, offset: 1e9, q: 'peonies', from: 'florists', near: 'NCR' });
  assert.ok(q);
  assert.equal(q!.limit, GALLERY_MAX_LIMIT);
  assert.equal(q!.offset, GALLERY_MAX_OFFSET);
  assert.equal(normalizeGalleryQuery({ slotKey: 'flowers', q: 'x'.repeat(500) })!.limit, GALLERY_PAGE_SIZE);
});

test('the words carry no filter syntax', () => {
  const q = normalizeGalleryQuery({ slotKey: 'flowers', q: 'white roses,label.eq.x)(%_*' });
  assert.ok(q?.q);
  assert.doesNotMatch(q!.q!, /[,.()%_*]/);
  assert.ok(q!.q!.length <= 40);
  assert.equal(normalizeGalleryQuery({ slotKey: 'flowers', q: '  ' })!.q, undefined);
});

test('From ▾ is a known option, read as the shop’s services; Near ▾ a known region', () => {
  assert.deepEqual(GALLERY_FROM.map((f) => f.label), ['Everyone', 'Florists', 'Stylists', 'Tables', 'Venues']);
  const florists = normalizeGalleryQuery({ slotKey: 'flowers', from: 'florists' });
  assert.ok(florists?.fromServices && florists.fromServices.length > 0);
  assert.equal(normalizeGalleryQuery({ slotKey: 'flowers', from: 'everyone' })!.fromServices, undefined);
  assert.equal(normalizeGalleryQuery({ slotKey: 'flowers', from: 'anyone; drop table' })!.fromServices, undefined);
  assert.equal(normalizeGalleryQuery({ slotKey: 'flowers', near: 'NCR' })!.near, 'NCR');
  assert.equal(normalizeGalleryQuery({ slotKey: 'flowers', near: 'Atlantis' })!.near, undefined);
});

test('the server action still caps every request', () => {
  const src = stripComments(readFileSync(join(__dirname, '../app/dashboard/[eventId]/studio/mood-board/actions.ts'), 'utf8'));
  const body = src.slice(src.indexOf('export async function fetchGalleryAssets'), src.indexOf('export async function applyGalleryPick'));
  assert.match(body, /normalizeGalleryQuery\(input\)/);
  assert.match(body, /\.range\(query\.offset, query\.offset \+ query\.limit - 1\)/);
  assert.doesNotMatch(body, /input\.(q|from|near)\b/, 'a raw filter reached the query around the cap');
});
