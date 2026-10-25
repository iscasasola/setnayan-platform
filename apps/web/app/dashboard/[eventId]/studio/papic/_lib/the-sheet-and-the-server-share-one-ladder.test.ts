/**
 * GUARD — + Add photos prices a pick with the SAME function the server charges with (owner 2026-10-25: *"adding
 * photos will use up papic credits"*).
 *
 * The rule (owner 2026-08-11, DECISION_LOG 2026-09-16 PAP-13): a photo spends 1 credit; a snippet 2–8 by its length —
 * 1–2 s = 2 · 3 s = 3 · 4–6 s = 5 · 7–10 s = 8. It is billed by `papicCaptureCost` in `recordSeatCapture`
 * (`app/papic/actions.ts`) and gated by it at the presign (`app/api/upload/route.ts`). The sheet now says, BEFORE
 * anything uploads, whether the pot covers a pick — so a second copy of the ladder in the sheet would be a promise
 * that can drift from the charge. This file holds:
 *
 *   1. the numbers (the owner's ladder, written once, here — the test is the spec);
 *   2. the sheet's helper is built on `papicCaptureCost`, imported from the one module the server imports it from;
 *   3. neither the sheet nor its helper re-types the ladder (no band literals, no own rounding of seconds).
 *
 * Comments are stripped before matching: the fix's own docblocks quote the numbers they forbid.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { papicCaptureCost } from '@/lib/papic-cameras-pure';
import { PAPIC_UPLOADS_CAMERA_INDEX, papicSeatCaptureSource } from '@/lib/papic-cameras';
import { clipLadderWords, costInfoLine, coverVerdict, creditsCount, selectionCost } from './upload-credits';

const PAPIC = dirname(dirname(fileURLToPath(import.meta.url)));
const WEB = join(PAPIC, '..', '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SHEET = read('app/dashboard/[eventId]/studio/papic/_components/add-to-library.tsx');
const HELPER = read('app/dashboard/[eventId]/studio/papic/_lib/upload-credits.ts');
const RECORD = read('app/papic/actions.ts');
const PRESIGN = read('app/api/upload/route.ts');
const CAMERAS = read('lib/papic-cameras.ts');

test('💰 an ADDED photo costs 2, a CAMERA photo 1 (owner 2026-10-26) — one function, keyed on the source', () => {
  assert.equal(papicCaptureCost('photo', null, 'upload'), 2, 'a photo added by hand');
  assert.equal(papicCaptureCost('photo', null, 'camera'), 1, 'a photo taken with the camera');
  assert.equal(papicCaptureCost('photo'), 1, 'no source given is a camera shot — every existing caller is unchanged');
  assert.equal(papicSeatCaptureSource(PAPIC_UPLOADS_CAMERA_INDEX), 'upload');
  for (const i of [0, 1, 100, 101, 102, 110, 200, null, undefined]) assert.equal(papicSeatCaptureSource(i), 'camera', `seat ${i}`);
  // ⏸ an added CLIP is not ruled yet: it keeps the camera ladder until the owner says otherwise.
  for (const s of [1, 3, 5, 9]) assert.equal(papicCaptureCost('clip', s * 1000, 'upload'), papicCaptureCost('clip', s * 1000, 'camera'));
});

test('the sheet prices every file as an added one: a photo 2 · a snippet 2 / 3 / 5 / 8 by its length', () => {
  assert.equal(selectionCost([{ kind: 'photo' }]), 2);
  const clip = (s: number) => selectionCost([{ kind: 'clip', durationMs: s * 1000 }]);
  assert.deepEqual([1, 2, 3, 4, 6, 7, 10].map(clip), [2, 2, 3, 5, 5, 8, 8]);
  assert.equal(clip(2.4), 3, 'seconds round UP — a 2.4 s snippet is a 3-second snippet');
  assert.equal(selectionCost([{ kind: 'clip', durationMs: null }]), 8, 'an unmeasured snippet costs the most, never the least');
});

test('a pick costs exactly what the server will charge for it, file by file', () => {
  const pick = [
    { kind: 'photo' as const },
    { kind: 'clip' as const, durationMs: 2_000 },
    { kind: 'clip' as const, durationMs: 5_500 },
    { kind: 'photo' as const },
    { kind: 'clip' as const, durationMs: 9_900 },
  ];
  // The server's charge for the Uploads seat: the record step's own call, with the source it derives from the seat.
  const source = papicSeatCaptureSource(PAPIC_UPLOADS_CAMERA_INDEX);
  const server = pick.reduce((n, p) => n + papicCaptureCost(p.kind, 'durationMs' in p ? p.durationMs : null, source), 0);
  assert.equal(selectionCost(pick), server);
  assert.equal(server, 2 + 2 + 5 + 2 + 8);
});

test('the pot decides BEFORE anything uploads — short says by how much; unread or a pass never blocks', () => {
  assert.deepEqual(coverVerdict(17, 9), { ok: false, cost: 17, left: 9, short: 8 });
  assert.deepEqual(coverVerdict(9, 9), { ok: true, cost: 9 });
  assert.deepEqual(coverVerdict(1, 0), { ok: false, cost: 1, left: 0, short: 1 });
  assert.equal(coverVerdict(500, 'unmetered').ok, true, 'the Unlock pass shoots unmetered — as at the gate');
  assert.equal(coverVerdict(500, null).ok, true, 'an unread pot is not a refusal — the server still decides each file');
});

test('the ⓘ’s words are BUILT from the bands, so they cannot drift from the charge', () => {
  assert.equal(clipLadderWords(), '1–2 s · 2, 3 s · 3, 4–6 s · 5, 7–10 s · 8');
  assert.match(costInfoLine(), /^Each photo you add uses 2 credits — a photo taken with the camera uses 1 credit\. /);
  assert.equal(creditsCount(1), '1 credit');
  assert.equal(creditsCount(1240), '1,240 credits');
});

test('🔒 ONE function: the helper prices with papicCaptureCost, from the module the server bills and gates with', () => {
  const PURE = /import\s*\{[^}]*\bpapicCaptureCost\b[^}]*\}\s*from\s*'@\/lib\/papic-cameras-pure'/;
  // The server imports it through `@/lib/papic-cameras`, which re-exports the pure module whole (it stays importable
  // where the service-role client is not) — the SAME function object, held here too.
  const VIA = /import\s*\{[^}]*\bpapicCaptureCost\b[^}]*\}\s*from\s*'@\/lib\/papic-cameras(?:-pure)?'/;
  assert.match(CAMERAS, /^export \* from '@\/lib\/papic-cameras-pure';$/m, 'lib/papic-cameras no longer re-exports the pure prices whole');
  assert.doesNotMatch(CAMERAS, /export (?:async )?function papicCaptureCost|const papicCaptureCost\s*=/, 'lib/papic-cameras defines its own papicCaptureCost');
  assert.match(HELPER, PURE, 'the sheet’s helper no longer prices with papicCaptureCost from lib/papic-cameras-pure');
  assert.match(HELPER, /papicCaptureCost\(/, 'the helper imports the function but never calls it');
  assert.match(RECORD, VIA, 'recordSeatCapture no longer bills with the shared papicCaptureCost');
  assert.match(RECORD, /meterCost = papicCaptureCost\(/, 'the record step no longer bills by papicCaptureCost');
  // 💰 …and both seams charge by the SOURCE they read off the seat (2026-10-26) — dropping it bills an upload as 1.
  assert.match(
    RECORD,
    /meterCost = papicCaptureCost\(\s*kind === 'clip' \? 'clip' : 'photo',\s*durationMs,\s*papicSeatCaptureSource\(/,
    'the record step no longer charges an added photo by its source',
  );
  assert.match(
    PRESIGN,
    /: papicCaptureCost\(cameraKind, null, papicSeatCaptureSource\(seat\.seat_index/,
    'the presign no longer gates an added photo by its source',
  );
  assert.match(HELPER, /papicCaptureCost\([^;]*'upload'\)/, 'the sheet no longer prices its files as added ones');
  assert.match(PRESIGN, VIA, 'the presign no longer gates with the shared papicCaptureCost');
  assert.match(SHEET, /from '\.\.\/_lib\/upload-credits'/, 'the sheet no longer reads its prices from the shared helper');
  assert.match(SHEET, /coverVerdict\(selectionCost\(/, 'the sheet no longer prices the pick before it uploads');
});

test('🔒 no second ladder: neither the sheet nor its helper re-types the bands or rounds seconds itself', () => {
  for (const [name, src] of [['add-to-library.tsx', SHEET], ['upload-credits.ts', HELPER]] as const) {
    assert.doesNotMatch(src, /maxSeconds\s*:/, `${name} declares its own clip band`);
    assert.doesNotMatch(src, /\[\s*2\s*,\s*3\s*,\s*5\s*,\s*8\s*\]/, `${name} carries the ladder as a literal`);
    assert.doesNotMatch(src, /Math\.ceil\([^)]*1000/, `${name} rounds a snippet’s seconds itself — that is papicSnippetCost’s job`);
    assert.doesNotMatch(src, /papicSnippetCost|PAPIC_POINTS_PER_PHOTO|PAPIC_POINTS_PER_UPLOADED_PHOTO/, `${name} prices from a lower-level piece than papicCaptureCost`);
  }
});
