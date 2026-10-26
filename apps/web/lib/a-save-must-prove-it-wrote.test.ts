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
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  SERVICE_UPDATE_MATCHED_NOTHING,
  wroteSomething,
} from '@/lib/a-write-that-matched-nothing';

const HERE = dirname(fileURLToPath(import.meta.url));

/*
 * 2026-10-26 — `updateVendorService` (the per-field save this guard first held) had no caller and was DELETED (reload
 * audit §3c). The service maker saves a card in ONE press through `commitVendorService` → the `save_vendor_service`
 * RPC, and the zero-row refusal moved INTO that function: `UPDATE … RETURNING vendor_service_id INTO v_service_id;
 * IF v_service_id IS NULL THEN RAISE 'Service not found.'`. So the source half now holds the LIVE path: the RPC
 * refuses an update that matched nothing, and the action turns that refusal into its error BEFORE `?saved=1`.
 */
const WEB = resolve(HERE, '..');
const commitBody = (() => {
  const src = stripComments(readFileSync(resolve(WEB, 'app/vendor-dashboard/services/actions.ts'), 'utf8'));
  const i = src.indexOf('export async function commitVendorService');
  assert.ok(i > -1, 'commitVendorService is gone — re-point this guard');
  const j = src.indexOf('\nexport async function ', i + 10);
  return src.slice(i, j > -1 ? j : undefined);
})();
const lastSaveFn = (() => {
  const dir = resolve(WEB, '../../supabase/migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const withFn = files.filter((f) => /CREATE OR REPLACE FUNCTION public\.save_vendor_service\(/.test(readFileSync(resolve(dir, f), 'utf8')));
  assert.ok(withFn.length > 0, 'no migration defines save_vendor_service — re-point this guard');
  const sql = readFileSync(resolve(dir, withFn[withFn.length - 1]!), 'utf8');
  return sql.slice(sql.lastIndexOf('CREATE OR REPLACE FUNCTION public.save_vendor_service('));
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

test('the update ASKS for the row it changed — and refuses when there was none', () => {
  const upd = lastSaveFn.indexOf('UPDATE public.vendor_services SET');
  assert.ok(upd > -1, 'save_vendor_service no longer updates the card — re-point this guard');
  const after = lastSaveFn.slice(upd, upd + 4000);
  assert.match(
    after,
    /RETURNING vendor_service_id INTO v_service_id;[\s\S]{0,1200}?IF v_service_id IS NULL THEN\s*RAISE EXCEPTION 'Service not found\.'/,
    'the update no longer reads back the row it changed — PostgREST reports error: null for a zero-row write',
  );
});

test('a refused save is said BEFORE the success redirect', () => {
  const rpc = commitBody.search(/\.rpc\('save_vendor_service'/);
  const refuse = commitBody.search(/if \(error\) return back\(error\.message\);/);
  const savedRedirect = commitBody.search(/\?saved=1/);
  assert.ok(rpc > -1, 'the maker no longer saves through save_vendor_service — re-point this guard');
  assert.ok(refuse > rpc, 'nothing reads the RPC refusal');
  assert.ok(savedRedirect > -1, 'the success redirect is gone — re-point this guard');
  assert.ok(refuse < savedRedirect, 'the refusal is read AFTER the ?saved=1 redirect, so it can never fire');
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
