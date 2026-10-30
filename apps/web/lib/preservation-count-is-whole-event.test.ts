/**
 * GUARD — the preservation meter counts the WHOLE event, or says nothing.
 *
 * 🚨 IT USED TO COUNT THE GALLERY ARRAY. `fetchPapicGallery` caps each source at
 * `GALLERY_LIMIT` (120), so at any real wedding the meter's "N of M kept" and
 * every percentage built on it were plainly wrong — and wrong in the direction
 * that looks plausible, which is the kind a couple never questions.
 *
 * 🔑 A NUMBER A COUPLE CANNOT CHECK IS WORSE THAN NO NUMBER. The meter now takes
 * a server-side count and renders NOTHING when that count is unavailable.
 *
 * ⚠ AND A FAILED COUNT MUST NOT BECOME A ZERO. A rejected Supabase query
 * resolves with `{ error }` and a null count — it never throws. Reading that as
 * 0 would tell a couple they are keeping **none** of their photos, which is the
 * single most alarming thing this screen could say, at the moment it is least
 * true.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIB = readFileSync(resolve(HERE, 'papic-gallery.ts'), 'utf8');
// The meter's own tests read `papic-gallery-grid.tsx`, deleted 2026-10-31 (unmounted since 2026-10-23; its last
// import went with #7108). The counter's tests below still hold.
const codeOnly = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** The counting function's body. */
function counter(): string {
  const i = LIB.indexOf('export async function fetchPreservationTotals');
  assert.ok(i > 0, 'the whole-event counter must exist');
  const body = codeOnly(LIB.slice(i));
  assert.ok(body.length > 200, 'the counter body came back suspiciously short');
  return body;
}

test('🚨 the count is a server-side count, not a length of a fetched list', () => {
  const fn = counter();
  assert.match(fn, /count:\s*'exact'/, 'must use an exact count');
  assert.match(fn, /head:\s*true/, 'and must not fetch the rows to count them');
  assert.ok(
    !/\.limit\(/.test(fn),
    'a limit in the counter re-introduces exactly the truncation this fixes',
  );
});

test('🚨 a failed count returns null — never a confident zero', () => {
  const fn = counter();
  assert.match(
    fn,
    /error\s*\?\s*null\s*:/,
    'a rejected query resolves with { error } and a null count; it must not become 0',
  );
  assert.match(fn, /return null;/, 'and the whole read must degrade to null');
});

test('vendor captures are excluded from both halves', () => {
  // They belong to the supplier and are never preservable by the couple.
  // Counting them inflates the denominator, so the couple appears to be keeping
  // less of their own event than they are.
  const fn = counter();
  assert.ok(
    !/vendor_papic_captures/.test(fn),
    'vendor captures must not be counted — the couple cannot preserve them',
  );
  assert.match(fn, /papic_photos/);
  assert.match(fn, /papic_guest_captures/);
});

test('already-compressed captures are excluded', () => {
  // Once the original is gone there is nothing left to keep, so counting it as
  // "not kept" invites a couple to act on a choice that no longer exists.
  assert.match(counter(), /is\('full_res_dropped_at',\s*null\)/);
});

