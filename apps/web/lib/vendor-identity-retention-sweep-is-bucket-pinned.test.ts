/**
 * THE RETENTION SWEEP IS NOT A GENERAL DELETE PRIMITIVE.
 *
 * ── WHAT THIS GUARDS ───────────────────────────────────────────────────────
 * `sweepVerifications` reads two attacker-influenced columns and hands whatever
 * it finds to an ADMIN-client delete. Migration 20271218766967 revoked the
 * INSERT grant and dropped the self-insert policy that made those columns
 * writable; this suite pins the SECOND lock, so the job stays harmless even if
 * a future writer of those columns appears or the grant is restored by a table
 * rebuild (pg_default_acl re-applies at CREATE TABLE time).
 *
 * ── WHY SOURCE SCANNING AND NOT AN IMPORT ──────────────────────────────────
 * `lib/vendor-identity-retention.ts` starts with `import 'server-only'`, and
 * `server-only` is NOT INSTALLED in this repo — importing the module from a
 * `node:test` fails outright. This is the same split `event-media-sweep.test.ts`
 * and `event-deletion-gate.test.ts` already use: the PURE rule is imported and
 * exercised for real in `vendor-identity-retention-core.test.ts`, and the wiring
 * that decides whether the rule is actually consulted is read out of the source.
 *
 * ⚠ SO BE PRECISE ABOUT WHAT THIS PROVES. It proves the sweep's code still
 * CONSULTS the rule and still refuses to clear a pointer it did not act on. It
 * does NOT execute the sweep. The rule's own behaviour is proved by the imported
 * tests next door.
 *
 * 🔑 RULE 0 — the bucket-pin idea is NOT new here. `lib/event-media-sweep.ts`
 * already ships `if (bucket !== R2_BUCKETS.media) return;` for exactly this
 * reason. What this one adds is that a refusal is COUNTED and SURFACED instead
 * of returning silently, because a refusal nobody can see is indistinguishable
 * from a delete that happened.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SWEEP = resolve(HERE, 'vendor-identity-retention.ts');
const MIGRATION = resolve(
  HERE,
  '../../../supabase/migrations/20271218766967_a_vendor_cannot_mint_its_own_verification.sql',
);

/**
 * Comment-stripped, always. Every claim below is about CODE — a docblock
 * quoting the very string being asserted would keep this suite green with the
 * mechanism deleted, which is how a guard becomes decoration.
 */
const sweepSource = (): string => stripComments(readFileSync(SWEEP, 'utf8'));

/** The body of one `async function <name>(` … up to the next top-level `}`. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`async function ${name}(`);
  assert.notEqual(
    start,
    -1,
    `${name}() is gone from the sweep. If it was renamed, re-point this guard — ` +
      'do not delete the assertion.',
  );
  const rest = source.slice(start);
  const end = rest.indexOf('\n}');
  assert.notEqual(end, -1, `Could not find the end of ${name}()`);
  return rest.slice(0, end);
}

test('THE PIN: sweepVerifications consults the bucket rule before deleting', () => {
  const body = functionBody(sweepSource(), 'sweepVerifications');
  assert.match(
    body,
    /verificationRefIsInScope/,
    'sweepVerifications no longer asks whether the ref is in scope. A forged or ' +
      'mistaken `government_id_r2_key` naming r2://setnayan-media/<victim key> ' +
      'would be deleted by our own admin client. That is the reported ' +
      'vulnerability, restored.',
  );
});

test('the delete loop iterates the IN-SCOPE columns, never the raw set', () => {
  const body = functionBody(sweepSource(), 'sweepVerifications');
  assert.match(
    body,
    /for \(const col of inScope\) \{/,
    'The delete loop is back on the unfiltered column list, so the scope rule ' +
      'is computed and then ignored — a guard that runs and decides nothing.',
  );
  assert.doesNotMatch(
    body,
    /for \(const col of present\) \{\s*try \{/,
    'A delete loop over `present` bypasses the filter entirely.',
  );
});

test('A REFUSED POINTER IS NEVER NULLED — the RA 10173 half', () => {
  // 🔑 Nulling the pointer for a ref we declined to delete would leave the
  // object retained past its declared retention period with nothing left
  // pointing at it — a compliance failure committed in the name of security,
  // and strictly worse than either alternative.
  const body = functionBody(sweepSource(), 'sweepVerifications');
  assert.match(
    body,
    /for \(const col of inScope\) patch\[col\] = null;/,
    'The clear-patch is built from something other than the in-scope columns. ' +
      'If it is built from `present`, a refused document is now unreachable AND ' +
      'still stored.',
  );
  assert.doesNotMatch(
    body,
    /for \(const col of present\) patch\[col\] = null;/,
    'The clear-patch nulls every column including the refused ones.',
  );
});

test('a row where everything was refused is not counted as scrubbed', () => {
  const body = functionBody(sweepSource(), 'sweepVerifications');
  assert.match(
    body,
    /if \(inScope\.length === 0\) continue;/,
    'With nothing in scope the row must be skipped before the UPDATE. Writing an ' +
      'empty patch would stamp the row as handled and hide the refusal.',
  );
});

test('THE REFUSAL IS COUNTED AND SAID OUT LOUD', () => {
  // A refusal nobody can see is indistinguishable from a delete that happened.
  const src = sweepSource();
  assert.match(
    src,
    /assetsRefused: number;/,
    'The summary no longer reports refusals, so the sweep can decline to delete ' +
      'identity documents indefinitely and report a clean run.',
  );
  assert.match(
    functionBody(src, 'sweepVerifications'),
    /summary\.assetsRefused \+= 1;/,
    'Refusals are no longer counted.',
  );
  assert.match(
    src,
    /console\.error\(\s*`\[vendor-identity-retention\] \$\{summary\.assetsRefused\}/,
    'The loud line for a non-zero refusal count is gone. These columns are ' +
      'service_role-only — a refusal means a ref got in that never should have.',
  );
});

test('THE ASYMMETRY IS DELIBERATE: the applications sweep is NOT bucket-pinned', () => {
  // ⛔ Measured, not assumed. app/vendor-dashboard/verify/actions.ts accepts a
  // slot ref under EITHER vendorVerificationDocPolicy (bucket
  // setnayan-vendor-verification) OR vendorOwnedMediaPolicy — and the latter
  // sets no `bucket`, so parseClientRef defaults it to the PUBLIC media bucket.
  // A real application's identity slot can therefore legitimately hold
  // r2://setnayan-media/vendors/<own-id>/…
  //
  // Making the two sweeps symmetric — the obvious tidy-up — would REFUSE to
  // delete a document we promised the NPC we delete. Those refs are already
  // tenancy-pinned at WRITE time by SEC-1; the column path has no write-time
  // control at all, which is the whole reason it needs one here.
  const body = functionBody(sweepSource(), 'sweepApplications');
  assert.doesNotMatch(
    body,
    /verificationRefIsInScope/,
    'sweepApplications has been given the verification bucket pin. Its refs ' +
      'legitimately live in the public media bucket too, so this now strands ' +
      'real identity documents past their declared retention. Read ' +
      'verificationRefIsInScope’s docblock before changing this.',
  );
});

test('the migration revokes at TABLE level and drops the orphaned INSERT policy', () => {
  const sql = stripComments(readFileSync(MIGRATION, 'utf8'));
  assert.match(
    sql,
    /REVOKE INSERT, UPDATE, DELETE ON public\.vendor_verifications FROM %I/,
    'The table-level revoke is gone. A column-by-column revoke leaves the NEXT ' +
      'column granted, and has_table_privilege() reads FALSE while it stands.',
  );
  assert.match(
    sql,
    /DROP POLICY IF EXISTS vendor_verifications_self_insert/,
    'The orphaned INSERT policy is back. With pg_default_acl re-granting INSERT ' +
      'on any table rebuild, the policy is the only thing left refusing the write.',
  );
  assert.doesNotMatch(
    sql,
    /DROP POLICY IF EXISTS vendor_verifications_self_read/,
    'The READ policy must survive — removing it is a wider narrowing than the ' +
      'finding supports and is its own decision.',
  );
});
