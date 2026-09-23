/**
 * every-approval-type-can-be-approved.test.ts — a request that can be OPENED
 * must be able to be APPROVED.
 *
 * ── The defect (register LAU-20) ────────────────────────────────────────────
 * `approve_journal_spotlight` could be requested, was listed on
 * `/admin/approvals`, and **threw on approve**.
 *
 * `initiateSponsored` writes the pending row with `target_id` (the spotlight)
 * and no `target_user_id`, because a spotlight is not a person — the same
 * non-user shape `approve_fraud_wipe_ban` already used. The dispatcher in
 * `app/admin/approvals/actions.ts` special-cased only the fraud type before
 * `if (!row.target_user_id) throw new Error('Request has no target user')`, so
 * every other non-user type fell into that throw.
 *
 * 🔑 IT WAS REVENUE-BLOCKING AND IT LOOKED LIKE NOTHING. The single-admin path
 * refuses sponsored rows deliberately and says *"Sponsored placements need
 * two-admin approval — use the sponsored queue."* That queue is the page that
 * threw. Opening the request worked; only the last step failed, which is why
 * nobody met it until someone tried to publish a paid placement.
 *
 * ── What this holds ─────────────────────────────────────────────────────────
 * The general property, not the one instance: **every action_type the system
 * can CREATE has an arm in the dispatcher.** A new type added to the vocabulary
 * and raised somewhere, with no arm, fails here instead of at the moment an
 * admin presses Approve on real money.
 *
 * ⚠ Scope, stated: this reads source. It proves an arm EXISTS for each created
 * type; it does not prove the arm is correct. The `.update()` inside each arm is
 * the db test's job, not this one's.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const DISPATCHER = 'app/admin/approvals/actions.ts';

const SOURCE_EXT = /\.(ts|tsx)$/;
const SKIP = new Set(['node_modules', '.next', 'dist']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (SOURCE_EXT.test(entry) && !entry.includes('.test.')) out.push(abs);
  }
  return out;
}

/** Types some code actually WRITES into admin_approval_requests. */
function createdActionTypes(): Map<string, string> {
  const found = new Map<string, string>();
  for (const abs of walk(join(WEB, 'app'))) {
    const code = stripComments(readFileSync(abs, 'utf8'));
    if (!code.includes('admin_approval_requests')) continue;
    // `action_type: 'x'` inside an insert, and the literal passed through a form.
    for (const m of code.matchAll(/action_type:\s*'([a-z_]+)'/g)) {
      const t = m[1]!;
      if (!found.has(t)) found.set(t, abs.slice(WEB.length + 1));
    }
  }
  return found;
}

test('every action_type the app can create has an arm in the dispatcher', () => {
  const created = createdActionTypes();
  const dispatcher = stripComments(readFileSync(join(WEB, DISPATCHER), 'utf8'));

  // Floors first — a sweep that found nothing must not read as success.
  assert.ok(
    created.size >= 2,
    `only ${created.size} action_type(s) found in app/ — the matcher stopped working`,
  );
  assert.ok(dispatcher.length > 500, 'the dispatcher source looks empty');

  const armless: string[] = [];
  for (const [type, where] of created) {
    // An arm is a comparison against the literal, in either operand order.
    const armed =
      dispatcher.includes(`row.action_type === '${type}'`) ||
      dispatcher.includes(`'${type}' === row.action_type`);
    if (!armed) armless.push(`${type}  (created in ${where})`);
  }

  console.log(
    `[approval-arms] ${created.size} created type(s), ${armless.length} with no dispatcher arm`,
  );
  assert.deepEqual(
    armless,
    [],
    'An approval type can be OPENED but not APPROVED. The request succeeds, the row is listed ' +
      `on /admin/approvals, and pressing Approve falls through to a throw.\nAdd an arm in ` +
      `${DISPATCHER}:\n  ` + armless.join('\n  '),
  );
});

test('a non-user target is handled BEFORE the target_user_id throw', () => {
  const src = stripComments(readFileSync(join(WEB, DISPATCHER), 'utf8'));
  const throwAt = src.indexOf("throw new Error('Request has no target user')");
  assert.ok(throwAt > 0, 'the target_user_id throw has moved — re-read this file');

  // Every arm for a type that targets something OTHER than a user must sit
  // above that throw, or it can never be reached.
  for (const type of ['approve_fraud_wipe_ban', 'approve_journal_spotlight']) {
    const armAt = src.indexOf(`row.action_type === '${type}'`);
    assert.ok(armAt > 0, `no arm for ${type}`);
    assert.ok(
      armAt < throwAt,
      `${type} targets a non-user (it rides in target_id), so its arm must come BEFORE the ` +
        'target_user_id throw. Below it, the arm is unreachable and approving throws.',
    );
  }
});
