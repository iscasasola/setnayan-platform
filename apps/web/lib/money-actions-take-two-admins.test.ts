/**
 * money-actions-take-two-admins.test.ts — an admin action that moves money may
 * not execute on one person's say-so.
 *
 * ── The defect (register LAU-19) ────────────────────────────────────────────
 * `admin_approval_requests` has enforced four eyes in the DATABASE since
 * 2026-09-30 — `admin_approval_four_eyes`: `decided_by <> initiated_by` — and
 * the live vocabulary gated six things:
 *
 *     grant_internal_account · grant_team_pool · promote_to_admin
 *     approve_vendor_partnership · approve_fraud_wipe_ban
 *     approve_journal_spotlight
 *
 * **Every one is a PRIVILEGE. None is money.** So a single admin could extend a
 * vendor's paid entitlement and write a `comp_grants` row carrying
 * `retail_value_centavos`, with nobody else involved.
 *
 * 🔑 THE INTENT WAS ALREADY IN THE SCHEMA and that is what makes it a defect
 * rather than a decision: `comp_grants.approved_by` exists, and the grant path
 * set it to `null` on every row. The column was built for a second admin and
 * never given one.
 *
 * ── What this holds ─────────────────────────────────────────────────────────
 * Three properties, each of which failing would restore the gap:
 *
 *   1. The REQUEST path grants nothing. `issueVendorSkuComp` must not write to
 *      `comp_grants` or move `papic_challenge_expires_at`.
 *   2. The EXECUTOR is reachable only from the approvals dispatcher. If a form
 *      or a surface could call it, the gate is decoration.
 *   3. The executor records WHO approved. `approved_by` must be the confirming
 *      admin, not null and not the initiator — otherwise the audit trail cannot
 *      show two people, which is the only thing four eyes is for.
 *
 * ⚠ Scope: this reads source. It proves the SHAPE of the gate. That the
 * database refuses `decided_by = initiated_by` is the constraint's job, and it
 * has been doing it since 2026-09-30.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const VENDORS = 'app/admin/vendors/actions.ts';

const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The body of a named exported async function, to its closing brace at col 0. */
function bodyOf(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `no exported function ${name}`);
  const end = src.indexOf('\n}', start);
  assert.ok(end > start, `could not find the end of ${name}`);
  return src.slice(start, end);
}

test('the comp REQUEST path grants nothing — it only opens an approval', () => {
  const body = bodyOf(read(VENDORS), 'issueVendorSkuComp');

  assert.doesNotMatch(
    body,
    /from\('comp_grants'\)/,
    'issueVendorSkuComp writes comp_grants directly — that is the single-admin grant this ' +
      'exists to remove',
  );
  assert.doesNotMatch(
    body,
    /papic_challenge_expires_at:/,
    'issueVendorSkuComp moves the entitlement expiry — the grant must happen only after a ' +
      'second admin confirms',
  );
  assert.match(
    body,
    /action_type:\s*'approve_comp_grant'/,
    'issueVendorSkuComp must OPEN an approval instead of granting',
  );
});

test('the comp EXECUTOR is reachable only from the approvals dispatcher', () => {
  const SKIP = new Set(['node_modules', '.next', 'dist']);
  const generated = /\.generated\.tsx?$/;
  const callers: string[] = [];
  let scanned = 0;

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (SKIP.has(entry)) continue;
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) {
        walk(abs);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry) || entry.includes('.test.')) continue;
      scanned += 1;
      const rel = abs.slice(WEB.length + 1);
      if (rel === VENDORS) continue; // its definition
      const body = stripComments(readFileSync(abs, 'utf8'));
      if (!body.includes('executeVendorSkuComp')) continue;

      // 🪤 NAMING A FUNCTION IS NOT REACHING IT. A file can hold the symbol as
      // prose or data and be no kind of door: `lib/two-admin-promise.ts`
      // documents which executor enforces which § 9.1 row, and said so in a
      // note string, which made this guard report it as a second caller.
      //
      // The property is REACHABILITY, so the decisive question is whether the
      // file CALLS it or IMPORTS it. A file doing neither cannot invoke it,
      // whatever it says. Tested by sabotage: adding a real call to that file
      // turns this red.
      const callsIt = /executeVendorSkuComp\s*\(/.test(body);
      const importsIt =
        /import[^;]*executeVendorSkuComp/.test(body) ||
        /await import\([^)]*\)[^;]*executeVendorSkuComp/.test(body);
      if (!callsIt && !importsIt) continue;

      // 🪤 A GENERATED REGISTRY NAMES THE FUNCTION; IT DOES NOT CALL IT.
      // `lib/admin-map/admin-jobs.generated.ts` lists every exported admin
      // function as DATA — `"name": "executeVendorSkuComp"` — so adding the
      // executor made this guard report a second door that does not exist.
      // Found when the generator was re-run after the money gate shipped.
      //
      // Excluded by SHAPE, not by filename: the name must appear only as a
      // JSON value. If a generated file ever contains a real invocation, the
      // `(` check below still catches it.
      if (generated.test(rel)) {
        const asData = /"name":\s*"executeVendorSkuComp"/.test(body);
        const asCall = /executeVendorSkuComp\s*\(/.test(body);
        if (asData && !asCall) continue;
      }
      callers.push(rel);
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));

  console.log(`[money-gate] ${scanned} sources scanned, ${callers.length} caller(s)`);
  assert.ok(scanned > 500, `only ${scanned} sources walked — wrong cwd?`);
  assert.deepEqual(
    callers,
    ['app/admin/approvals/actions.ts'],
    'executeVendorSkuComp must be called ONLY by the approvals dispatcher. Any other caller ' +
      'is a second door onto the money path, and a gate with a second door is decoration.',
  );
});

test('the executor records the SECOND admin — approved_by is the confirmer', () => {
  const body = bodyOf(read(VENDORS), 'executeVendorSkuComp');

  assert.match(
    body,
    /approved_by:\s*confirmingAdminId/,
    'comp_grants.approved_by must hold the CONFIRMING admin. It was null on every row before ' +
      '2026-09-22, which is why the column existed and proved nothing.',
  );
  assert.match(
    body,
    /granted_by:\s*initiatedByAdminId/,
    'granted_by must stay the INITIATOR — if both columns held the same person the audit trail ' +
      'would show one admin, which is what four eyes exists to disprove',
  );
  assert.doesNotMatch(
    body,
    /approved_by:\s*null/,
    'approved_by is null again — the gate writes no evidence that two people were involved',
  );
});

/**
 * ── The same three properties, for the § 9.1 refund gate ────────────────────
 * Added 2026-09-22 with `approve_large_refund`. A refund over ₱25,000 moves
 * more money in one press than a comp does, so it gets the same shape: the
 * request path refunds nothing, the executor has one door, and the door is the
 * approvals dispatcher.
 */
const PAYMENTS = 'app/admin/payments/actions.ts';

test('the refund REQUEST path refunds nothing above the threshold', () => {
  const src = read(PAYMENTS);
  const body = bodyOf(src, 'refundOrder');

  // The gate must sit BEFORE the flip. If `applyRefund` were called first, the
  // money would already be recorded as returned by the time anyone was asked.
  const gateAt = body.indexOf('refundNeedsTwoAdmins(');
  const applyAt = body.indexOf('applyRefund(');
  assert.ok(gateAt >= 0, 'refundOrder no longer consults the § 9.1 threshold');
  assert.ok(applyAt >= 0, 'refundOrder no longer performs the refund at all');
  assert.ok(
    gateAt < applyAt,
    'refundOrder performs the refund BEFORE testing the § 9.1 threshold. The approval would open ' +
      'after the money was already recorded as returned, which is a receipt, not a gate.',
  );

  // And the gated branch must open an approval rather than fall through.
  const gated = body.slice(gateAt, applyAt);
  assert.match(
    gated,
    /action_type: 'approve_large_refund'/,
    'the over-threshold branch does not open an approve_large_refund request',
  );
});

test('the refund EXECUTOR is reachable only from the approvals dispatcher', () => {
  const SKIP = new Set(['node_modules', '.next', 'dist']);
  const callers: string[] = [];
  let scanned = 0;

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (SKIP.has(entry)) continue;
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) {
        walk(abs);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry) || entry.includes('.test.')) continue;
      scanned += 1;
      const rel = abs.slice(WEB.length + 1);
      if (rel === PAYMENTS) continue; // its definition
      const body = stripComments(readFileSync(abs, 'utf8'));
      if (!body.includes('executeLargeRefund')) continue;

      // Same shape rule as the comp executor above: naming is not reaching.
      const callsIt = /executeLargeRefund\s*\(/.test(body);
      const importsIt =
        /import[^;]*executeLargeRefund/.test(body) ||
        /await import\([^)]*\)[^;]*executeLargeRefund/.test(body);
      if (!callsIt && !importsIt) continue;
      callers.push(rel);
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));

  // 🔑 FLOOR THE SCAN. A walk that finds nothing reads exactly like a walk that
  // proves nothing; print what was searched.
  console.log(`[money-gate] scanned ${scanned} source files for executeLargeRefund callers`);
  assert.ok(scanned > 500, `only ${scanned} files scanned — the walk is not reaching the tree`);

  assert.deepEqual(
    callers.sort(),
    ['app/admin/approvals/actions.ts'],
    'executeLargeRefund must be called ONLY by the approvals dispatcher. Any other caller is a ' +
      'second door onto the money path, and a gate with a second door is decoration.',
  );
});

test('the refund executor records the CONFIRMING admin, not the initiator', () => {
  const body = bodyOf(read(PAYMENTS), 'executeLargeRefund');
  assert.match(
    body,
    /actingAdminId: confirmingAdminId/,
    'executeLargeRefund no longer attributes the refund to the confirming admin. The audit trail ' +
      'must be able to show two people — that is the only thing four eyes is for.',
  );
  // It must also re-read the order rather than trust a payload up to 72h old.
  assert.match(
    body,
    /from\('orders'\)/,
    'executeLargeRefund no longer re-reads the order. A request can sit for 72 hours, in which ' +
      'time the order can be refunded, cancelled or paid again.',
  );
});
