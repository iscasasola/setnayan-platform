/**
 * THE IDENTITY RETENTION SWEEP IS NOT A GENERAL DELETE PRIMITIVE — proved by
 * RUNNING the per-row behaviour, not by reading the sweep's source.
 *
 * ── WHAT THIS REPLACES, AND WHY (2026-09-10) ───────────────────────────────
 * The first version of this file (PR #5401) checked that the NAME
 * `verificationRefIsInScope` appeared in `sweepVerifications` and that a loop
 * iterated a variable called `inScope`. A post-merge review executed the obvious
 * sabotage — `const inScope = [...present];` — and the suite stayed GREEN
 * (25/25) while the sweep deleted out of `setnayan-media` again and still
 * reported `assetsRefused`. `true || verificationRefIsInScope(..)` passed too.
 * A guard that checks a name appears is decoration.
 *
 * It also defended a hole in writing: a test titled "THE ASYMMETRY IS
 * DELIBERATE" asserted the APPLICATIONS sweep stays unpinned, because its refs
 * were "tenancy-pinned at WRITE time by SEC-1". That pin lived only in the
 * server action. The database let a vendor PATCH its own draft's `doc_uploads`
 * through PostgREST — proven as a real `authenticated` session in the replay —
 * and the next approve OR reject armed this job to delete another shop's
 * seven-year permit. That test is gone; the truth it should have stated is
 * asserted below: BOTH sweeps are pinned by TENANT (the vendor's own folder),
 * and the reviewer's valid point — a legitimate slot can live in the public
 * media bucket under `vendors/<own id>/` — is kept.
 *
 * ── HOW ────────────────────────────────────────────────────────────────────
 * The sweep (`lib/vendor-identity-retention.ts`, `server-only`) hands each row
 * to `applyApplicationScrub` / `applyVerificationScrub` (-core.ts) with the
 * admin client and `executeCleanupDelete` as its only I/O. These tests supply
 * FAKE I/O that records every delete and every pointer write, feed in the
 * reviewer's exact attack refs, and assert on what was deleted and cleared.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import type { PlannedDelete } from './cleanup-delete-scope';
import { isPlannedDelete } from './cleanup-delete-scope';
import {
  applyApplicationScrub,
  applyVerificationScrub,
} from './vendor-identity-retention-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(
  HERE,
  '../../../supabase/migrations/20271218766967_a_vendor_cannot_mint_its_own_verification.sql',
);

const V = '0b000000-0000-4000-8000-000000000001';
const VICTIM = '0b000000-0000-4000-8000-00000000dead';

/** The review's refs, verbatim in shape. */
const VICTIM_LOGO = `r2://setnayan-media/vendors/${VICTIM}/logo/logo.png`;
const OTHER_VENDOR_DTI = `r2://setnayan-vendor-verification/vendors/${VICTIM}/dti.pdf`;
const OWN_GOV_ID = `r2://setnayan-vendor-verification/vendors/${V}/verification/gov.png`;
const OWN_MEDIA_SLOT = `r2://setnayan-media/vendors/${V}/portfolio/p1.jpg`;

function fakeIo() {
  const deleted: string[] = [];
  const writes: unknown[] = [];
  return {
    deleted,
    writes,
    deleteObject: async (t: PlannedDelete) => {
      // The executor refuses anything that is not a planner-minted target; the
      // fake holds the sweep to the same contract.
      assert.equal(isPlannedDelete(t), true, 'the sweep handed the executor an unplanned target');
      deleted.push(`${t.bucket}/${t.key}`);
    },
    writeDocUploads: async (next: Record<string, unknown>) => {
      writes.push(next);
      return { ok: true };
    },
    clearColumns: async (patch: Record<string, null>) => {
      writes.push(patch);
      return { ok: true };
    },
  };
}

test('THE REVIEW’S APPLICATION EXPLOIT: a stranger’s logo and another shop’s permit are NOT deleted', async () => {
  const io = fakeIo();
  const out = await applyApplicationScrub(
    {
      vendor_profile_id: V,
      doc_uploads: {
        bank_account_proof: { r2_key: VICTIM_LOGO },
        portfolio_samples: [{ r2_key: OTHER_VENDOR_DTI }],
      },
    },
    io,
  );
  assert.deepEqual(io.deleted, [], 'our admin client would have deleted another tenant’s object');
  assert.deepEqual(io.writes, [], 'a refused slot was scrubbed — the pointer to a kept object is gone');
  assert.equal(out.refused, 2);
  assert.equal(out.scrubbed, false);
});

test('the vendor’s OWN uploads are deleted — in either place the intake accepts — and only those slots scrubbed', async () => {
  const io = fakeIo();
  const out = await applyApplicationScrub(
    {
      vendor_profile_id: V,
      doc_uploads: {
        government_id: { r2_key: OWN_GOV_ID },
        portfolio_samples: [{ r2_key: OWN_MEDIA_SLOT }],
        dti_certificate: { r2_key: `r2://setnayan-vendor-verification/vendors/${V}/verification/dti.pdf` },
      },
    },
    io,
  );
  assert.deepEqual(io.deleted.sort(), [
    `setnayan-media/vendors/${V}/portfolio/p1.jpg`,
    `setnayan-vendor-verification/vendors/${V}/verification/gov.png`,
  ]);
  assert.equal(io.writes.length, 1);
  assert.deepEqual(Object.keys(io.writes[0] as object), ['dti_certificate'], 'the seven-year permit must survive');
  assert.equal(out.scrubbed, true);
});

test('a mixed application deletes and scrubs ONLY the own slot; the foreign slot stays exactly as it was', async () => {
  const io = fakeIo();
  await applyApplicationScrub(
    {
      vendor_profile_id: V,
      doc_uploads: {
        government_id: { r2_key: OWN_GOV_ID },
        bank_account_proof: { r2_key: VICTIM_LOGO },
      },
    },
    io,
  );
  assert.deepEqual(io.deleted, [`setnayan-vendor-verification/vendors/${V}/verification/gov.png`]);
  assert.deepEqual(io.writes, [{ bank_account_proof: { r2_key: VICTIM_LOGO } }]);
});

test('THE COLUMN EXPLOIT FROM #5401: a media ref on vendor_verifications is refused and its pointer kept', async () => {
  const io = fakeIo();
  const out = await applyVerificationScrub(
    {
      vendor_profile_id: V,
      government_id_r2_key: 'r2://setnayan-media/vendors/8f14e45f-ceea-467a-9f2a-1c2d3e4f5a6b/logo/a-logo.png',
      bank_account_proof_r2_key: OTHER_VENDOR_DTI,
    },
    io,
  );
  assert.deepEqual(io.deleted, []);
  assert.deepEqual(io.writes, [], 'an empty or partial patch was written for a fully-refused row');
  assert.deepEqual([...out.refusedColumns].sort(), ['bank_account_proof_r2_key', 'government_id_r2_key']);
  assert.equal(out.scrubbed, false, 'a fully refused row must not be counted as scrubbed');
});

test('a mixed verification row nulls ONLY the column whose object it deleted', async () => {
  const io = fakeIo();
  await applyVerificationScrub(
    {
      vendor_profile_id: V,
      government_id_r2_key: `r2://setnayan-vendor-verification/vendors/${V}/id.jpg`,
      bank_account_proof_r2_key: VICTIM_LOGO,
    },
    io,
  );
  assert.deepEqual(io.deleted, [`setnayan-vendor-verification/vendors/${V}/id.jpg`]);
  assert.deepEqual(io.writes, [{ government_id_r2_key: null }]);
});

test('a failed pointer write is reported, never counted as scrubbed', async () => {
  const io = fakeIo();
  const out = await applyVerificationScrub(
    { vendor_profile_id: V, government_id_r2_key: `r2://setnayan-vendor-verification/vendors/${V}/id.jpg` },
    { ...io, clearColumns: async () => ({ ok: false }) },
  );
  assert.equal(out.scrubbed, false);
  assert.equal(out.writeFailed, true);
});

test('the sweep’s only delete is the executor — no raw primitive, no second road', () => {
  // Wiring, deliberately narrow: the BEHAVIOUR is proved above. What is left to
  // pin is that the I/O file hands those functions the real executor.
  const sweep = stripComments(readFileSync(resolve(HERE, 'vendor-identity-retention.ts'), 'utf8'));
  const occurrences = (sweep.match(/deleteObject:\s*executeCleanupDelete\b/g) ?? []).length;
  assert.equal(occurrences, 2, 'both sweeps must delete through executeCleanupDelete');
  assert.doesNotMatch(sweep, /\br2Delete\b|\bdeletePublicAsset\b/);
});

test('the #5401 migration still revokes at TABLE level and drops the orphaned INSERT policy', () => {
  const sql = stripComments(readFileSync(MIGRATION, 'utf8'));
  assert.match(
    sql,
    /REVOKE INSERT, UPDATE, DELETE ON public\.vendor_verifications FROM %I/,
    'The table-level revoke is gone. A column-by-column revoke leaves the NEXT ' +
      'column granted, and has_table_privilege() reads FALSE while it stands.',
  );
  assert.match(sql, /DROP POLICY IF EXISTS vendor_verifications_self_insert/);
  assert.doesNotMatch(sql, /DROP POLICY IF EXISTS vendor_verifications_self_read/);
});
