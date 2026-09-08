/**
 * A "saved" message must be earned by an observed write.
 *
 * ── WHY (measured 2026-09-08) ──────────────────────────────────────────────
 * `updateVendorService` checked only `error` and then redirected to
 * `?saved=1`. PostgREST returns `error: null` for an update that matched ZERO
 * rows, so "wrote the card" and "wrote nothing" were the same value and both
 * ended at the success message. Nothing in the suite noticed, because nothing
 * asked the action what it had written.
 *
 * These are source guards over the action plus unit tests over the helper. The
 * source half exists because the helper can be perfect and the caller can still
 * never call it — which was precisely the state before this change.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  SERVICE_UPDATE_MATCHED_NOTHING,
  wroteSomething,
} from '@/lib/a-write-that-matched-nothing';

const HERE = dirname(fileURLToPath(import.meta.url));

/** `updateVendorService`'s body only — comments stripped, so prose cannot pass a guard. */
const updateBody = (() => {
  const src = stripComments(
    readFileSync(
      resolve(HERE, '../app/vendor-dashboard/services/actions.ts'),
      'utf8',
    ),
  );
  const i = src.indexOf('export async function updateVendorService');
  assert.ok(i > -1, 'updateVendorService is gone — re-point this guard');
  const j = src.indexOf('export async function setServiceLinks');
  assert.ok(j > i, 'the next export moved — re-point this guard');
  return src.slice(i, j);
})();

test('wroteSomething fails CLOSED on everything that is not a non-empty array', () => {
  assert.equal(wroteSomething([{ vendor_service_id: 'x' }]), true);
  assert.equal(wroteSomething([]), false);
  assert.equal(wroteSomething(null), false);
  assert.equal(wroteSomething(undefined), false);
  // A bare object is what a `.single()` call returns; it is NOT evidence of a
  // row count and must not read as one.
  assert.equal(wroteSomething({ vendor_service_id: 'x' }), false);
  assert.equal(wroteSomething(1), false);
});

test('the update ASKS for the rows it changed', () => {
  assert.match(
    updateBody,
    /\.select\(['"]vendor_service_id['"]\)/,
    'the update does not .select() — without it a zero-row write is indistinguishable ' +
      'from a successful one, because PostgREST reports error: null for both',
  );
});

test('a zero-row update refuses BEFORE the success redirect', () => {
  const emptyCheck = updateBody.search(/updatedRows\s*\|\|\s*updatedRows\.length === 0/);
  const savedRedirect = updateBody.search(/\?saved=1/);
  assert.ok(emptyCheck > -1, 'nothing checks whether the update matched a row');
  assert.ok(savedRedirect > -1, 'the success redirect is gone — re-point this guard');
  assert.ok(
    emptyCheck < savedRedirect,
    'the zero-row check runs AFTER the ?saved=1 redirect, so it can never fire',
  );
});

test('the refusal names the fact, and does not guess the cause', () => {
  // From inside the action a wrong id and an RLS-excluded row are identical, so
  // a message that blamed either would be inventing a diagnosis.
  assert.match(SERVICE_UPDATE_MATCHED_NOTHING, /did not save/i);
  assert.match(SERVICE_UPDATE_MATCHED_NOTHING, /nothing changed/i);
  assert.ok(
    !/permission denied|RLS|policy|42501/i.test(SERVICE_UPDATE_MATCHED_NOTHING),
    'the message claims a specific cause the action cannot actually distinguish',
  );
});

test('the action uses the shared sentence, not a local one', () => {
  assert.match(
    updateBody,
    /SERVICE_UPDATE_MATCHED_NOTHING/,
    'the action hand-rolled its own wording for a zero-row write',
  );
});
