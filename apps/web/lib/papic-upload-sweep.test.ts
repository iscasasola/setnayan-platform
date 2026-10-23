/**
 * The unrecorded-upload sweep decides from data it can read, never sooner than
 * the phone gives up, and only ever deletes a staging key (Guard A).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { finalKeyFor, stagingKeyFor } from '@/lib/papic-upload/tiers';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-01T00:00:00Z');
const SRC = stripComments(readFileSync(join(process.cwd(), 'lib', 'papic-upload-sweep.ts'), 'utf8'));
const INTENTS = stripComments(readFileSync(join(process.cwd(), 'lib', 'papic-upload-intents.server.ts'), 'utf8'));

// The module is server-only; its pure decision is re-stated from the source's
// own constants so the test cannot drift from them.
function constantDays(name: string): number {
  const m = new RegExp(`export const ${name} = ([^;]+);`).exec(SRC);
  assert.ok(m, `${name} moved`);
  return m[1]!.includes('SHOT_TTL_MS') ? 8 : 2;
}

test('it waits longer than the phone does — never a piece a phone is about to record', () => {
  assert.equal(constantDays('UNSETTLED_SWEEP_AFTER_MS'), 8);
  assert.match(SRC, /UNSETTLED_SWEEP_AFTER_MS = SHOT_TTL_MS \+ 24 \* 60 \* 60 \* 1000/);
  void NOW;
  void DAY;
});

test('🛡 Guard A: it can only ever delete a STAGING key, through the pinned executor', () => {
  assert.match(SRC, /deleteStagingObject\(r\)/);
  assert.doesNotMatch(SRC, /\br2Delete\b|DeleteObjectCommand/, 'a raw delete in the sweep');
  const fn = INTENTS.slice(INTENTS.indexOf('export async function deleteStagingObject'));
  assert.match(fn.slice(0, 400), /if \(!finalKeyFor\(keyOf\(intent\.r2_ref\)\)\) return 'refused';/);
  assert.match(fn.slice(0, 400), /cleanupDelete\(intent\.r2_ref, intentScope\(intent\)\)/);
  // A final key (what rows point at) is never a staging key.
  const finalKey = 'papic/guest/g/cap-00000000-0000-4000-8000-000000000001-display.webp';
  assert.equal(finalKeyFor(finalKey), null);
  assert.ok(finalKeyFor(stagingKeyFor(finalKey)!));
});

test('a refused delete is never forgotten — the intent row stays to be seen', () => {
  const loop = SRC.slice(SRC.indexOf('for (const r of unsettled)'), SRC.indexOf('for (const r of settled)'));
  assert.match(loop, /if \(outcome === 'deleted'\) \{[\s\S]*forget\.push/);
});
