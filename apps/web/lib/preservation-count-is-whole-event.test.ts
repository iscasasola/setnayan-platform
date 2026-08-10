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
const GRID = readFileSync(
  resolve(HERE, '..', 'app/dashboard/[eventId]/studio/papic/_components/papic-gallery-grid.tsx'),
  'utf8',
);
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

test('🚨 the meter is NOT computed from the capped gallery array', () => {
  const grid = codeOnly(GRID);
  const meter = grid.slice(grid.indexOf('function PreservationMeterLine'));
  assert.ok(
    !/photos\s*\./.test(meter),
    'the meter reads the gallery array again — that array is capped at 120 per source',
  );
  assert.match(meter, /totals/, 'it must take a counted total instead');
});

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

test('🚨 the meter prices the selection in CREDITS, derived — never re-typed', () => {
  // Owner 2026-08-10: 1 credit = 1 photo, 8 credits = a 10-second video, and
  // preservation is ₱500/year per 5,000 credits' worth. A count of ITEMS is not
  // a bill — one video costs eight times what a photo costs.
  const raw = codeOnly(GRID).slice(codeOnly(GRID).indexOf('function PreservationMeterLine'));
  // ⚠ CLASS NAMES ARE NOT PRICES. A first cut flagged `bg-success-500` as a
  // hard-coded ₱500. Strip styling before looking for numbers, or the guard
  // cries wolf on a colour token and teaches you to skim past it.
  const meter = raw.replace(/className="[^"]*"/g, '').replace(/className=\{[^}]*\}/g, '');
  // ⚠ ASSERT THE USE, NOT THE PRESENCE. A first cut checked that `keptCredits`
  // and `blocksNeeded(` merely APPEARED — so swapping the bill to
  // `blocksNeeded(totals.kept)` (a video billed as a photo, one eighth of the
  // truth) sailed through, because the word was still on screen elsewhere.
  // "Keep the call, discard its result" beats every presence check.
  assert.match(
    meter,
    /blocksNeeded\(\s*totals\.keptCredits\s*\)/,
    'the bill must be computed from CREDITS — item counts bill a video as a photo',
  );
  assert.match(meter, /PRESERVATION_BLOCK_PHP/, 'the price must come from the constant');
  assert.match(
    meter,
    /formatPhp\(\s*annualPhp\s*\)/,
    'the yearly figure must be the derived one, not typed into the copy',
  );
  // Any bare peso amount in the copy is a hard-coded price, however it is spelled.
  assert.ok(
    !/[₱P]\s?\d/.test(meter),
    'a peso amount is written into the copy — derive it from the constant',
  );
  assert.ok(!/\b5,?000\b/.test(meter), 'the block size is hard-coded — derive it');
  assert.match(meter, /PAPIC_POINTS_PER_CLIP/, 'the video credit cost must be the constant');
  assert.ok(
    !/video is \d/.test(meter),
    'the video credit cost is written into the copy — use the constant',
  );

  // …and the credits themselves must be WEIGHTED, or every figure above is a
  // count of items wearing the word "credits".
  const counter = codeOnly(LIB).slice(codeOnly(LIB).indexOf('export async function fetchPreservationTotals'));
  assert.match(
    counter,
    /papicCaptureCost\(\s*'clip'\s*\)/,
    'clips must be weighted at the clip cost — an unweighted sum is not credits',
  );
  assert.match(counter, /papicCaptureCost\(\s*'photo'\s*\)/);
});

test('🚨 the meter promises no "forever" and claims no deletion', () => {
  const meter = codeOnly(GRID).slice(codeOnly(GRID).indexOf('function PreservationMeterLine'));
  assert.ok(!/forever/i.test(meter), '"forever" was retired 2026-08-07 — do not reintroduce it');
  // ⚠ BAN THE CLAIM, NOT THE WORD. A blunt /delete/i ban flagged the sentence
  // "nothing is ever deleted" — which is the exact reassurance the owner asked
  // for, twice ("again. not delete. just compress"). What must never appear is
  // an ASSERTION that we delete; a denial of it is the point.
  const deletionClaim = /(we|is|are|will be|gets?|going to be)\s+delet/i;
  const denial = /(never|not|nothing[^.]*ever)\s+[^.]*delet/i;
  const claims = meter.match(deletionClaim);
  assert.ok(
    !claims || denial.test(meter),
    `the copy asserts deletion — the vocabulary is "compressed"/"size": ${claims?.[0]}`,
  );
});

test('🚨 the price reads as a FUTURE choice, never a standing bill', () => {
  // Everything is kept by default (a couple picks what to RELEASE), so a couple
  // who has done nothing still has every capture selected. Saying "keeping this
  // costs ₱500 a year" to them presents a bill for a selection they never made
  // and a period that is included free. The figure must be conditional and
  // clearly after the free window.
  const meter = codeOnly(GRID).slice(codeOnly(GRID).indexOf('function PreservationMeterLine'));
  assert.match(
    meter,
    /would be \{formatPhp\(annualPhp\)\}/,
    'the price must be conditional ("would be"), not stated as an amount owed',
  );
  assert.match(meter, /included/, 'the free window must be named as included');
  assert.match(
    meter,
    /three months after your event ends/,
    'and the free window must say when it ends, in the words the owner set',
  );
  assert.ok(
    !/costs \{formatPhp/.test(meter),
    'a bare "costs ₱X a year" reads as a debt for a choice the couple never made',
  );
});

test('the meter stays silent when there is nothing to say', () => {
  const meter = codeOnly(GRID).slice(codeOnly(GRID).indexOf('function PreservationMeterLine'));
  assert.match(meter, /!totals\s*\|\|\s*totals\.total\s*===\s*0/, 'no totals, or none held → render nothing');
});

test('🚨 the gallery cannot be mounted without an event id', () => {
  // It was optional, so a caller that forgot it silently rendered a gallery with
  // no preserve toggle and no meter — no build error, no visible cause.
  const grid = codeOnly(GRID);
  const props = grid.slice(grid.indexOf('photos: GalleryPhoto[];'), grid.indexOf('}) {'));
  assert.ok(!/eventId\?:/.test(props), 'eventId must be REQUIRED, so forgetting it breaks the build');
  assert.match(props, /eventId:\s*string;/);
});
