/**
 * NO PAPIC CAPTURE ROUTE TAKES FILE BYTES — the bytes go straight to storage.
 *
 * MEASURED (production, 2026-10-23): POST /api/papic/guest-capture with a 6 MB
 * body → 413 FUNCTION_PAYLOAD_TOO_LARGE from Vercel BEFORE our code ran (1 MB →
 * our own 401). A Vercel function refuses any request body over 4.5 MB, and a
 * 10-second guest clip is designed at ~12.5 MB — so every normal clip failed,
 * and nothing in the repo could have said so: the route's own size cap (40 MB)
 * was a promise the platform never let it keep.
 *
 * The rule, held from both ends:
 *   1. SERVER — every API route that writes a Papic capture row (derived: it
 *      names a capture table AND inserts/records into it) reads no body as
 *      bytes: no `formData()`, `arrayBuffer()`, `blob()` on the request, and no
 *      multipart at all.
 *   2. CLIENT — nothing in app/ or lib/ posts to a capture route except the one
 *      uploader module (lib/papic-upload/lanes.ts), which sends JSON.
 *   3. The sign path presigns ONE key, bound to the shot + tier, with
 *      Content-Type AND Content-Length signed, for minutes (relay "clean and
 *      safe", b).
 *
 * 🛡 Sabotage runs recorded in HANDOVER.md (break → red → restore → green).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import {
  CAPTURE_PUT_TTL_SECONDS,
  captureTierKey,
  stagingKeyFor,
  validateTierRequest,
  TIER_RULES,
} from './tiers';

const WEB = process.cwd().endsWith('/apps/web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
}

const CAPTURE_TABLES = /\.from\('(papic_guest_captures|vendor_papic_captures|papic_photos)'\)\s*\.insert\(|papic_record_guest_capture_and_spend|papic_record_guest_capture\b/;
const BYTE_READS = /\b(?:req|request)\s*\.\s*(?:formData|arrayBuffer|blob)\s*\(|\.arrayBuffer\s*\(\s*\)|multipart\/form-data/;

function captureRoutes(): string[] {
  const files: string[] = [];
  walk(join(WEB, 'app', 'api'), files);
  return files
    .filter((f) => f.endsWith('/route.ts'))
    .map((f) => relative(WEB, f).split('\\').join('/'))
    .filter((rel) => CAPTURE_TABLES.test(read(rel)));
}

test('the walk finds the two camera routes (not vacuous)', () => {
  const routes = captureRoutes();
  for (const r of ['app/api/papic/guest-capture/route.ts', 'app/api/vendor/papic-capture/route.ts']) {
    assert.ok(routes.includes(r), `${r} no longer looks like a capture route — re-point this guard`);
  }
});

test('🚫 no capture route reads a request body as bytes', () => {
  const offenders = captureRoutes()
    .filter((r) => BYTE_READS.test(read(r)));
  assert.deepEqual(
    offenders,
    [],
    'a capture route reads file bytes through a Vercel function again — anything over 4.5 MB is ' +
      'refused by the platform (413) before the route runs. Sign a PUT instead (lib/papic-upload/).',
  );
  // …and the camera routes refuse a multipart body out loud.
  for (const r of ['app/api/papic/guest-capture/route.ts', 'app/api/vendor/papic-capture/route.ts']) {
    assert.match(read(r), /'bytes_not_accepted'/, `${r} must refuse a non-JSON body by name`);
  }
});

test('🚫 only the uploader module talks to a capture route, and it sends JSON', () => {
  const files: string[] = [];
  walk(join(WEB, 'app'), files);
  walk(join(WEB, 'lib'), files);
  const callers = files
    .map((f) => relative(WEB, f).split('\\').join('/'))
    .filter((rel) => !rel.startsWith('app/api/'))
    // The route registry names the path; it calls nothing.
    .filter((rel) => rel !== 'lib/routes.ts')
    .filter((rel) => /['"`]\/api\/(?:papic\/guest-capture|vendor\/papic-capture)['"`]/.test(read(rel)));
  assert.deepEqual(callers, ['lib/papic-upload/lanes.ts']);
  const lanes = read('lib/papic-upload/lanes.ts');
  assert.match(lanes, /'Content-Type': 'application\/json'/);
  assert.doesNotMatch(lanes, /FormData/);
});

test('🔒 (b) one key per shot + tier, Content-Type and Content-Length signed, minutes to live', () => {
  const intents = read('lib/papic-upload-intents.server.ts');
  const sign = intents.slice(intents.indexOf('export async function signCaptureTierPut'));
  const body = sign.slice(0, sign.indexOf('\n}\n'));
  assert.match(body, /validateTierRequest\(input\)/, 'type + size checked before signing');
  assert.match(body, /captureTierKey\(\{/, 'the key is derived, never taken from the request');
  assert.match(body, /stagingKeyFor\(key\)/, 'the phone writes only a staging key');
  assert.match(body, /presignUploadUrl\(\{[\s\S]*?key: stagingKey,[\s\S]*?contentType,[\s\S]*?sizeBytes: input\.sizeBytes,[\s\S]*?ttlSeconds: CAPTURE_PUT_TTL_SECONDS,/);
  const uploads = read('lib/uploads.ts');
  const presign = uploads.slice(uploads.indexOf('export async function presignUploadUrl'));
  assert.match(presign.slice(0, 900), /ContentLength: args\.sizeBytes/);
  assert.match(presign.slice(0, 900), /signableHeaders: new Set\(\['content-type', 'content-length'\]\)/);
  assert.ok(CAPTURE_PUT_TTL_SECONDS > 0 && CAPTURE_PUT_TTL_SECONDS <= 600, 'minutes, never hours');

  // The key carries the shot and the tier and nothing a caller chose.
  const id = '00000000-0000-4000-8000-000000000009';
  const k = captureTierKey({ lane: 'guest', ownerId: 'g1', clientCaptureId: id, tier: 'display', contentType: 'image/webp' })!;
  assert.ok(k.includes(id) && k.includes('-display.'));
  assert.ok(stagingKeyFor(k)!.includes('/incoming/'));
  // A size or a type the tier does not allow is refused before any URL exists.
  assert.deepEqual(validateTierRequest({ tier: 'thumb', contentType: 'image/webp', sizeBytes: TIER_RULES.thumb.maxBytes + 1 }), { ok: false, error: 'too_large' });
  assert.deepEqual(validateTierRequest({ tier: 'display', contentType: 'text/html', sizeBytes: 1000 }), { ok: false, error: 'bad_type' });
  assert.deepEqual(validateTierRequest({ tier: 'clip_raw', contentType: 'video/mp4', sizeBytes: 12_500_000 }), { ok: true }, 'a 10 s clip fits');
});

test('🔒 a row never points at a key a presigned URL can reach', () => {
  for (const r of ['app/api/papic/guest-capture/route.ts', 'app/api/vendor/papic-capture/route.ts']) {
    const src = read(r);
    assert.match(src, /promoteTier\(/, `${r} must write checked bytes to the final key`);
    assert.doesNotMatch(src, /\.r2_ref,\s*\n?\s*\}\)\s*;?\s*\n?\s*.*update/, `${r} writes a staging ref onto a row`);
  }
});
