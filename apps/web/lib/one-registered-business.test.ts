/**
 * 🔒 "UNLIMITED" = ONE REGISTERED BUSINESS — the TypeScript half (owner 2026-11-22, DECISION_LOG "SUPPLIER PLAN
 * ANTI-ABUSE RULES LOCKED"). The rule is decided in SQL and pinned by
 * `tests/db/one-registered-business-one-verified-shop.db.test.ts`; this file pins the words, the decision the server
 * takes before it writes, and the wiring.
 *
 *   1 · FAIL CLOSED: only `clear` lets an approval go on; `held` and `unreadable` refuse.
 *   2 · nothing given is taken back: an already-verified shop is never refused (the trigger reads the same way).
 *   3 · the sentences are plain: they name the holder, say nothing changed, never a column or a constraint.
 *   4 · a database refusal is recognised by its errcode + constraint, and nothing else is mistaken for it.
 *   5 · the wiring: EVERY way a shop becomes verified asks before it writes, through the ONE server check, and that
 *       check asks the ONE SQL predicate; the branch add asks before its insert.
 *
 * SABOTAGE (2026-11-22, each reverted): `approvalRefusal` made to return null for `unreadable` → 1 RED; the
 * `verifyRefusalFor` call removed from `applyApplicationDecision` → 5 RED; the branch check moved after the
 * included-branch insert → 5 RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BRANCH_NEEDS_REGISTRATION_MESSAGE,
  VERIFIED_ELSEWHERE_UNREADABLE,
  approvalRefusal,
  isOneRegisteredBusinessRefusal,
  oneVerifiedShopRefusal,
} from './one-registered-business';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const MIGRATION = readFileSync(
  join(WEB, '../../supabase/migrations/20271359913146_one_registered_business_one_verified_shop.sql'),
  'utf8',
);

test('1 · fail closed: only a clear check lets an approval on', () => {
  assert.equal(approvalRefusal('pending_review', { kind: 'clear' }), null);
  assert.equal(approvalRefusal('unverified', { kind: 'unreadable' }), VERIFIED_ELSEWHERE_UNREADABLE);
  const held = approvalRefusal('pending_review', { kind: 'held', holderId: 'x', holderName: 'Casa Lumina' });
  assert.ok(held && held.includes('Casa Lumina'), 'a held number did not refuse, or did not name the holder');
  for (const from of [null, undefined, 'unverified', 'pending_review', 'rejected', 'demoted']) {
    assert.notEqual(approvalRefusal(from, { kind: 'unreadable' }), null, `unreadable let ${String(from)} through`);
  }
});

test('2 · an already-verified shop is never refused (a renewal, or a pair verified before the rule)', () => {
  assert.equal(approvalRefusal('verified', { kind: 'held', holderId: 'x', holderName: 'Other' }), null);
  assert.equal(approvalRefusal('verified', { kind: 'unreadable' }), null);
});

test('3 · the sentences are plain', () => {
  const words = [
    oneVerifiedShopRefusal('Casa Lumina'),
    oneVerifiedShopRefusal(null),
    oneVerifiedShopRefusal('   '),
    VERIFIED_ELSEWHERE_UNREADABLE,
    BRANCH_NEEDS_REGISTRATION_MESSAGE,
  ];
  for (const w of words) {
    assert.doesNotMatch(w, /registration_number|vendor_|constraint|23514|null|undefined|“\s*”/i, w);
  }
  assert.match(oneVerifiedShopRefusal(null), /another shop/);
  assert.match(oneVerifiedShopRefusal('Casa Lumina'), /nothing was changed/);
  assert.match(VERIFIED_ELSEWHERE_UNREADABLE, /nothing was changed/);
  assert.doesNotMatch(BRANCH_NEEDS_REGISTRATION_MESSAGE, /vendor/i, 'supplier, never vendor');
});

test('4 · a database refusal is recognised by errcode + constraint, and nothing else is', () => {
  assert.equal(
    isOneRegisteredBusinessRefusal({
      code: '23514',
      message: 'This registration number already belongs to another verified shop. One registered business has one verified shop.',
    }),
    'verified_elsewhere',
  );
  assert.equal(
    isOneRegisteredBusinessRefusal({ code: '23514', constraint: 'vendor_branches_carry_shop_registration', message: 'x' }),
    'branch_needs_registration',
  );
  assert.equal(isOneRegisteredBusinessRefusal({ code: '23505', message: 'duplicate key value' }), null);
  assert.equal(isOneRegisteredBusinessRefusal({ code: '23514', message: 'some other check' }), null);
  assert.equal(isOneRegisteredBusinessRefusal(null), null);
  // The words the recogniser looks for are the words the triggers raise.
  assert.match(MIGRATION, /already belongs to another verified shop/);
  assert.match(MIGRATION, /CONSTRAINT = 'vendor_profiles_one_verified_per_registration'/);
  assert.match(MIGRATION, /CONSTRAINT = 'vendor_branches_carry_shop_registration'/);
  assert.match(MIGRATION, /ERRCODE = '23514'/);
  assert.doesNotMatch(MIGRATION, /ERRCODE = '23505'/, '23505 would send the paper claim into its collision loop');
});

test('5 · every way a shop becomes verified asks first, through the one check; the branch add asks before it inserts', () => {
  const server = read('lib/one-registered-business.server.ts');
  assert.match(server, /\.rpc\('registration_number_verified_holder'/, 'the server check does not ask the SQL predicate');

  // The application engine (admin Approve, Work list, AND the automatic approval all come through it).
  const engine = read('lib/verification-decision.server.ts');
  const ask = engine.indexOf('verifyRefusalFor(');
  const firstWrite = engine.indexOf(".from('vendor_verification_applications')\n      .update(");
  assert.ok(ask > 0, 'applyApplicationDecision does not ask');
  assert.ok(firstWrite > 0 && ask < firstWrite, 'the engine writes the application before it asks');

  // The visibility approve and the vouch.
  const visibility = read('app/admin/verify/actions.ts');
  const vAsk = visibility.indexOf('verifyRefusalFor(');
  const vAudit = visibility.indexOf("action: 'vendor_visibility_change'");
  assert.ok(vAsk > 0 && vAsk < vAudit, 'the visibility approve does not ask before it writes');
  const vouch = read('app/admin/vendors/verification-bypass-actions.ts');
  const bAsk = vouch.indexOf('verifyRefusalFor(');
  const bWrite = vouch.indexOf("verification_state: 'verified'");
  assert.ok(bAsk > 0 && bAsk < bWrite, 'the vouch does not ask before it writes');

  // Every file that writes `verification_state: 'verified'` outside tests and labs is one of the three above.
  // (A new door must ask too — add it here once it does.)
  const doors = [
    'lib/verification-decision.server.ts',
    'app/admin/verify/actions.ts',
    'app/admin/vendors/verification-bypass-actions.ts',
  ];
  for (const d of doors) assert.match(read(d), /verifyRefusalFor\(/, `${d} does not ask`);

  // The branch add.
  const branches = read('app/vendor-dashboard/branches/actions.ts');
  const bCreate = branches.indexOf('export async function createBranch');
  const bCheck = branches.indexOf('branchNeedsRegistrationRefusal(', bCreate);
  const bInsert = branches.indexOf(".from('vendor_branches').insert(", bCreate);
  assert.ok(bCheck > bCreate, 'createBranch does not ask for the shop’s number');
  assert.ok(bInsert > 0 && bCheck < bInsert, 'createBranch inserts before it asks');

  // The admin sees the number on the shop and on each branch.
  const record = read('app/admin/vendors/[vendorProfileId]/page.tsx');
  assert.match(record, /registration_number_raw/);
  assert.match(record, /\['Registration number', registrationCell\]/);
  assert.match(record, /header: 'Registration number'/);
  assert.match(record, /verifiedElsewhere\(shopId, admin\)/);
});
