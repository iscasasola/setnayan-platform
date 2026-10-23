/**
 * The unrecorded-upload sweep keeps up, never deletes a copy a row points at
 * (Guard A), and one refused key never stalls the queue behind it.
 *
 * Review 2026-10-23 (major 6): the first sweep read the 200 OLDEST rows of any
 * kind, once a day — settled rows piled up at the head and hid every unsettled
 * one, a refused row sat at the head forever, and an attempt's promoted final
 * copy (a crash between the copy and the charge) was never looked at.
 *
 * The per-row rule is pure (lib/papic-upload/sweep-plan.ts) and is RUN here with
 * fakes; the query shape around it is read from the comment-stripped source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { finalKeyFor, stagingKeyFor } from '@/lib/papic-upload/tiers';
import { sweepUnsettledIntent, type SweepPlanDeps } from '@/lib/papic-upload/sweep-plan';

const SRC = stripComments(readFileSync(join(process.cwd(), 'lib', 'papic-upload-sweep.ts'), 'utf8'));
const INTENTS = stripComments(readFileSync(join(process.cwd(), 'lib', 'papic-upload-intents.server.ts'), 'utf8'));
const REGISTRY = stripComments(readFileSync(join(process.cwd(), 'lib', 'periodic-job-registry.ts'), 'utf8'));

const FINAL = 'r2://setnayan-media/papic/guest/g/cap-00000000-0000-4000-8000-000000000001-original-a0123abcd.jpg';

function fakes(over: Partial<SweepPlanDeps> & { referenced?: boolean } = {}) {
  const calls: string[] = [];
  const deps: SweepPlanDeps = {
    deleteStaging: over.deleteStaging ?? (async () => (calls.push('staging'), 'deleted')),
    isReferenced: over.isReferenced ?? (async () => (calls.push('ref?'), over.referenced ?? false)),
    deleteFinal: over.deleteFinal ?? (async (ref) => (calls.push(`final:${ref}`), 'deleted')),
  };
  return { deps, calls };
}

test('an unrecorded attempt loses its staging upload AND its unreferenced final copy', async () => {
  const { deps, calls } = fakes();
  assert.equal(await sweepUnsettledIntent(FINAL, deps), 'forget');
  assert.deepEqual(calls, ['staging', 'ref?', `final:${FINAL}`]);
});

test('🛡 Guard A: a final copy a row points at is NEVER deleted — and the intent is still forgotten', async () => {
  const { deps, calls } = fakes({ referenced: true });
  assert.equal(await sweepUnsettledIntent(FINAL, deps), 'forget');
  assert.ok(!calls.some((c) => c.startsWith('final:')), 'deleted a referenced final copy');
});

test('🛡 Guard A: the sweep checks references through the ONE shared, fail-closed check', () => {
  // The check itself (fail closed, every key column) is held in
  // lib/papic-upload/a-lost-answer-never-erases-a-shot.test.ts; here: the sweep uses it.
  assert.match(SRC, /isReferenced: \(ref\) => refIsReferenced\(admin, r\.lane, ref\)/);
  assert.match(SRC, /deleteFinalIfUnreferenced\(admin, r, ref\)/);
  assert.match(INTENTS, /export async function refIsReferenced\([\s\S]*?if \(error\) \{[\s\S]*?return true;/);
});

test('no final copy → only the staging upload is touched', async () => {
  const { deps, calls } = fakes();
  assert.equal(await sweepUnsettledIntent(null, deps), 'forget');
  assert.deepEqual(calls, ['staging']);
});

test('a refused or throwing delete sets the row ASIDE — it is never forgotten, never left at the head', async () => {
  assert.equal(await sweepUnsettledIntent(FINAL, fakes({ deleteStaging: async () => 'refused' }).deps), 'set_aside');
  assert.equal(await sweepUnsettledIntent(FINAL, fakes({ deleteFinal: async () => 'refused' }).deps), 'set_aside');
  assert.equal(
    await sweepUnsettledIntent(FINAL, fakes({ deleteStaging: async () => { throw new Error('r2 down'); } }).deps),
    'set_aside',
  );
  // the set-aside mark is written, and the unsettled query skips marked rows
  assert.match(SRC, /update\(\{ sweep_refused_at:/);
  const unsettled = SRC.slice(SRC.indexOf(".is('settled_at', null)"));
  assert.match(unsettled.slice(0, 300), /\.is\('sweep_refused_at', null\)/);
});

test('it keeps up: unsettled and settled rows are queried SEPARATELY, in batches, until empty', () => {
  assert.match(SRC, /\.not\('settled_at', 'is', null\)/, 'settled rows have their own query');
  assert.match(SRC, /\.is\('settled_at', null\)/, 'unsettled rows have their own query');
  assert.equal((SRC.match(/for \(;;\) \{/g) ?? []).length, 2, 'each query loops batch after batch');
  assert.equal((SRC.match(/if \(rows\.length < BATCH\) break;/g) ?? []).length, 2);
  assert.match(SRC, /Date\.now\(\) - started > BUDGET_MS/, 'a time budget bounds the loop');
  // hourly, not daily
  assert.match(REGISTRY, /PAPIC_UPLOAD_SWEEP_GAP_MS = 60 \* 60 \* 1000/);
  assert.match(REGISTRY, /key: 'papic-upload-sweep',[\s\S]{0,80}gapMs: PAPIC_UPLOAD_SWEEP_GAP_MS/);
});

test('it waits longer than the phone does — never a piece a phone is about to record', () => {
  assert.match(SRC, /UNSETTLED_SWEEP_AFTER_MS = SHOT_TTL_MS \+ 24 \* 60 \* 60 \* 1000/);
  // a settled row outlives its presigned URL (5 min) before it is forgotten
  assert.match(SRC, /SETTLED_FORGET_AFTER_MS = 15 \* 60 \* 1000/);
});

test('🛡 Guard A: the staging delete can only ever touch a STAGING key, through the pinned executor', () => {
  assert.doesNotMatch(SRC, /\br2Delete\b|DeleteObjectCommand/, 'a raw delete in the sweep');
  const fn = INTENTS.slice(INTENTS.indexOf('export async function deleteStagingObject'));
  assert.match(fn.slice(0, 400), /if \(!finalKeyFor\(keyOf\(intent\.r2_ref\)\)\) return 'refused';/);
  assert.match(fn.slice(0, 400), /cleanupDelete\(intent\.r2_ref, intentScope\(intent\)\)/);
  const finalKey = 'papic/guest/g/cap-00000000-0000-4000-8000-000000000001-display.webp';
  assert.equal(finalKeyFor(finalKey), null);
  assert.ok(finalKeyFor(stagingKeyFor(finalKey)!));
});

test('the capture routes fire the sweep too — a quiet admin console cannot stall it', () => {
  for (const route of ['app/api/papic/guest-capture/route.ts', 'app/api/vendor/papic-capture/route.ts']) {
    const src = stripComments(readFileSync(join(process.cwd(), route), 'utf8'));
    assert.match(src, /after\(\(\) => maybeRunPapicUploadSweep\(\)\)/, `${route} does not fire the sweep`);
  }
});
