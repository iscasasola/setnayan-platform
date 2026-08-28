/**
 * THE CHECKLIST READS EVERY REFUSAL — a job that refuses to run without a field
 * must SAY so, whatever shape the refusal is written in.
 *
 * ── THE DEFECT THIS EXISTS FOR (2026-08-28) ─────────────────────────────────
 * `refusedWhenEmpty` is what tells an operator which fields a job will not run
 * without. It was derived from ONE binding shape — `const x = String(formData
 * .get('k') …)` — so it saw 195 of the ~415 bindings in this admin, UNDER HALF.
 * 145 more are a bare `const x = formData.get('k')` and 68 are
 * `const x = helper(formData.get('k'))`. Every one of those jobs was published
 * as refusing NOTHING: `refundOrder` demands a 20-character reason so there is
 * a paper trail for the couple, and the checklist said it needed nothing.
 *
 * 🔑 BOTH HALVES CAN FAIL, IN OPPOSITE DIRECTIONS, AND BOTH ARE PINNED HERE:
 *   · too narrow → a job silently understates what it needs (the bug above);
 *   · too wide  → a checklist "demands things nobody has to give" — this file's
 *     own words. `setCategoryIcon` writes `next === '' ? null : next`, where an
 *     empty icon LEGITIMATELY CLEARS the icon. A first cut read that ternary as
 *     a refusal and published `icon_name` as required.
 *
 * ⚠ AND A FIRST CUT OF THE FIX SILENTLY NARROWED: matching only
 * `throw`/`redirect` DROPPED 33 jobs that plainly do refuse, because this admin
 * also says no with `fail(…)`, `return { ok: false }`, `redirectBack(…)`, a
 * bare `return;` and `return err(…)`. A guard that narrows without saying so is
 * worse than the gap it replaced, which is why every shape is pinned below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refusesWhenEmpty } from './scan-admin-jobs';

/* ── 1 · EVERY WAY THIS ADMIN SAYS NO ─────────────────────────────────────── */

const REFUSALS: [string, string][] = [
  ['throw', `if (!reason) throw new Error('need it');`],
  ['fail()', `if (!reason || !reason.includes('@')) fail('Enter the email.');`],
  ['return { ok: false }', `if (!reason.trim()) return { ok: false, message: 'A price needs a name.' };`],
  ['redirectBack()', `if (!reason) redirectBack(formData, 'error', 'nope');`],
  ['redirect()', `if (!reason) redirect('/admin?error=Missing');`],
  ['bare return', `if (!reason) return;`],
  ['return err()', `if (!reason || !planId) return err('Missing plan to activate.');`],
  ['length floor', `if (!reason || reason.length < 20) {\n  throw new Error('too short');\n}`],
];

for (const [shape, body] of REFUSALS) {
  test(`a refusal written as ${shape} counts`, () => {
    assert.equal(
      refusesWhenEmpty(body, 'reason'),
      true,
      `this shape stopped counting as a refusal — every job using it has just ` +
        `silently dropped a field from the operator checklist`,
    );
  });
}

/* ── 2 · WHAT MUST NOT COUNT ──────────────────────────────────────────────── */

test('a ternary mapping empty → null is NOT a refusal', () => {
  // The real setCategoryIcon / retireRetailRow / saveVendorRow shape: an empty
  // value is LEGAL and is stored as null. Reading it as a refusal tells an
  // operator a field is required when leaving it blank is the whole point.
  assert.equal(
    refusesWhenEmpty(`const iconName = next === '' ? null : next;`, 'next'),
    false,
    'an empty-to-null ternary was read as a refusal',
  );
  assert.equal(
    refusesWhenEmpty(
      `const description = descRaw === '' ? null : descRaw;\nreturn { ok: true };`,
      'descRaw',
    ),
    false,
  );
});

test('a guard that does not refuse does not count', () => {
  // Branching on emptiness to do something ELSE is not refusing to run.
  assert.equal(
    refusesWhenEmpty(`if (!label) { label = 'Untitled'; }`, 'label'),
    false,
    'a defaulting branch was read as a refusal',
  );
});

test('an emptiness test on a DIFFERENT local does not count', () => {
  assert.equal(refusesWhenEmpty(`if (!other) throw new Error('x');`, 'reason'), false);
  // …and a name that merely CONTAINS the local must not match either.
  assert.equal(refusesWhenEmpty(`if (!reasonCode) throw new Error('x');`, 'reason'), false);
});

/* ── 3 · THE FLOOR — an empty parse reports a perfectly clean sweep ───────── */

test('FLOOR: the shipped checklist still declares a real number of refusals', async () => {
  const { ADMIN_JOBS } = (await import('./admin-jobs.generated')) as {
    ADMIN_JOBS: { name: string; refusedWhenEmpty: string[] }[];
  };
  const total = ADMIN_JOBS.reduce((n, j) => n + j.refusedWhenEmpty.length, 0);
  // Measured 108 the day the binding was widened (was 75, of which 5 were the
  // ternary false positive). Floored well under that: this exists so a scanner
  // that silently matches NOTHING fails loudly instead of passing quietly.
  assert.ok(
    total >= 90,
    `only ${total} refused-when-empty entries across the admin — the scan has ` +
      `stopped reading refusals; it was 108 when this floor was written`,
  );
  const refund = ADMIN_JOBS.find((j) => j.name === 'refundOrder');
  assert.ok(
    refund?.refusedWhenEmpty.includes('reason'),
    'refundOrder no longer declares that it needs a reason — the exact job whose ' +
      'missing 20-character paper trail proved this scan was half-blind',
  );
});
