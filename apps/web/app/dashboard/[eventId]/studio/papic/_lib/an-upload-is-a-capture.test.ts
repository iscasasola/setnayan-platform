/**
 * GUARD — an upload is a capture, and it goes through the same door.
 *
 * Owner 2026-08-26: *"papic is the source where they collect media files for
 * that event"*, *"they can upload their work via papic credits as well per
 * event"*, and an uploaded photo takes *"the same spot as 1 papic photo"*.
 *
 * 🔑 THE WHOLE VALUE OF THIS FEATURE IS THAT IT WROTE NO NEW MACHINERY. It
 * presigns through the shipped `/api/upload` seat route and records through the
 * shipped `recordSeatCapture`, so it inherits the credit metering, the
 * per-camera burst limiter, the server-side clip cap, the always-on safety
 * screen, the derivatives and the Drive copy untouched. **A second capture path
 * is the failure this codebase pays for most** — and it is exactly what a
 * future "just POST the file to a new route" edit would create.
 *
 * ⚠ TWO PROPERTIES BELOW ARE NOT STYLE, THEY ARE MONEY AND SAFETY:
 *
 *   1. A CLIP'S LENGTH IS MEASURED AND REFUSED, NEVER PASSED THROUGH.
 *      `papicSnippetCost` bills an absent or nonsense duration at the TOP band —
 *      the only direction a tampered client cannot profit from — so an
 *      unmeasured clip silently overcharges a couple for their own upload.
 *   2. A CLIP ALWAYS CARRIES A POSTER. The safety screen reads a clip through
 *      its poster frame; a posterless clip stays `unscreened` **forever**, and
 *      unscreened media is excluded from every guest surface silently. Better to
 *      refuse the file than to store it in permanent limbo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAPIC = dirname(dirname(fileURLToPath(import.meta.url)));
const PICKER = readFileSync(join(PAPIC, '_components/add-to-library.tsx'), 'utf8');
const SENDER = readFileSync(join(PAPIC, '..', '..', '..', '..', '..', 'lib', 'upload-send.ts'), 'utf8');
const PAGE = readFileSync(join(PAPIC, 'page.tsx'), 'utf8');
const MEMORIES = readFileSync(join(PAPIC, '..', '..', 'memories', 'page.tsx'), 'utf8');

test('the picker still exists and still uploads — or every rule below is vacuous', () => {
  assert.ok(/export function AddToLibrary/.test(PICKER), 'the picker is gone');
  assert.ok(/type="file"/.test(PICKER), 'the picker no longer takes a file');
});

test('🚨 it uses the SHARED presign route, not a new one', () => {
  // 2026-10-25: the bytes go through the shared sender (`lib/upload-send.ts` — the signer, the stall watchdog and the
  // progress `<FileUpload>` uses), which presigns at /api/upload; the seat token rides along, so the server still
  // decides where the bytes land and whether the camera may shoot.
  assert.ok(
    /import\('@\/lib\/upload-send'\)/.test(PICKER) && /sendToStorage\(/.test(PICKER),
    'the picker no longer sends through the shared sender — a hand-rolled PUT has no stall clock, so a dead upload spins for ever',
  );
  assert.ok(
    /doFetch\('\/api\/upload'/.test(SENDER),
    'the shared sender no longer presigns through /api/upload. A new route means a second place that decides where bytes land and whether a camera may shoot — the server derives both from the seat token today.',
  );
  assert.ok(
    /papicSeatToken: token/.test(PICKER),
    'the presign no longer identifies the seat — the server derives the storage prefix AND the claimer check from it',
  );
});

test('🚨 it records through the SHARED capture path, not a new insert', () => {
  assert.ok(
    /recordSeatCapture\(/.test(PICKER),
    'the picker no longer records through recordSeatCapture. That call IS the metering, the burst limiter, the clip cap and the screen — a direct insert bypasses all four.',
  );
  assert.ok(
    !/from\('papic_photos'\)/.test(PICKER),
    'the picker writes papic_photos directly — that is a photo with no credit spent and no screen run',
  );
});

test('🚨 a clip is MEASURED and REFUSED, never passed through unmeasured', () => {
  assert.ok(/probeVideo\(/.test(PICKER), 'clips are no longer measured');
  assert.ok(
    /durationMs > MAX_CLIP_MS/.test(PICKER),
    'an over-length clip is no longer refused. papicSnippetCost bills an absent or nonsense duration at the TOP band, so this silently overcharges a couple for their own upload.',
  );
  assert.ok(
    /if \(!probe\)/.test(PICKER),
    'an unreadable clip is no longer refused — it would be recorded with no duration and billed at the top band',
  );
});

test('🚨 a clip always carries a poster, or it is refused', () => {
  const clip = /if \(r\.probe\) \{[\s\S]*?\} else \{/.exec(PICKER)?.[0] ?? '';
  assert.ok(clip, 'the clip branch was restructured beyond recognition');
  assert.ok(
    /poster = await send\(r\.probe\.poster/.test(clip),
    'a clip no longer uploads a poster. The safety screen reads a clip THROUGH its poster; a posterless clip stays unscreened forever and is excluded from every guest surface silently.',
  );
  const posterAt = clip.indexOf('poster = await send');
  const clipAt = clip.indexOf('clip = await send(r.file');
  assert.ok(posterAt > 0 && clipAt > posterAt, 'the clip is uploaded before its poster — a failed poster then leaves a stored clip that can never be screened');
  assert.ok(/if \(!poster\.ok\) \{[\s\S]{0,80}continue;/.test(clip), 'a failed poster no longer stops its clip');
});

test('🚨 refusals name something a person can actually do', () => {
  // "out_of_points" sends somebody to support. "You're out of credits" sends
  // them to the ladder two cards down. A refusal that misdescribes itself sends
  // people to fix the thing that was never the problem.
  assert.ok(/function readable\(/.test(PICKER), 'the refusal translator is gone');
  // `camera_points_exhausted` is the code BOTH seams actually send for an empty pot (2026-10-25) — the two older
  // names were the only ones listed, so an out-of-credits couple was told to "try again in a moment".
  for (const code of ['camera_points_exhausted', 'out_of_points', 'capture_window_closed', 'clip_too_long', 'uploads_closed', 'awaiting_payment']) {
    assert.ok(PICKER.includes(`'${code}'`), `${code} no longer has words a person can read`);
  }
  const fn = /function readable\([\s\S]*?\n}/.exec(PICKER)?.[0] ?? '';
  assert.ok(!/return code/.test(fn), 'a raw error code is handed straight to a person');
});

test('the picker only renders for a camera this couple actually holds', () => {
  assert.ok(
    // 📍 + Add photos lives in Memories now (2026-10-23) — the picker and its claimer check moved with it.
    /token \? \(\s*<AddToLibrary/.test(MEMORIES),
    'the picker renders without a resolved token — every upload would be refused by the presign with no explanation',
  );
  assert.ok(
    /const token = seat\?\.claimer_user_id === user\.id \?/.test(MEMORIES),
    'the studio no longer checks that the Uploads camera belongs to THIS person — a token resolved for somebody else is a camera handed to the wrong hands',
  );
});
