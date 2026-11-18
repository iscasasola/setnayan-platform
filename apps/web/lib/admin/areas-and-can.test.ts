/**
 * Areas × levels and can() — DECISION_LOG 2026-11-13.
 *
 *   · a Basic admin is REFUSED an Escalated action (the headline promise);
 *   · Escalated includes Basic; the owner can do everything; an unreadable
 *     scope list or an unknown area is always NO;
 *   · the TypeScript area list, owner address and approval vocabulary agree
 *     with the migration — two lists that disagree each pass their own suite.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  ADMIN_AREAS,
  APPROVAL_ACTION_AREA,
  areaForApprovalAction,
  areaForAuditAction,
  auditRowArea,
} from './areas';
import { canWith, levelIn, refusalFor, type AdminPowers } from './can';
import { OWNER_EMAIL, isOwnerProfile } from './owner';

const MIGRATIONS = join(__dirname, '../../../../supabase/migrations');
const MIGRATION = readdirSync(MIGRATIONS).find((f) => f.endsWith('_admin_team_areas_levels_and_owner_self_approval.sql'));
const SQL = MIGRATION ? readFileSync(join(MIGRATIONS, MIGRATION), 'utf8') : '';

const basicHelp: AdminPowers = { userId: 'u1', isOwner: false, scopes: [{ area: 'help', level: 'basic' }, { area: 'payments', level: 'basic' }] };
const escalatedPayments: AdminPowers = { userId: 'u2', isOwner: false, scopes: [{ area: 'payments', level: 'escalated' }] };
const owner: AdminPowers = { userId: 'o', isOwner: true, scopes: [] };
const unreadable: AdminPowers = { userId: 'u3', isOwner: false, scopes: null };

test('a BASIC admin is refused an ESCALATED action in the same area', () => {
  assert.equal(canWith(basicHelp, 'payments', 'basic'), true);
  assert.equal(canWith(basicHelp, 'payments', 'escalated'), false);
  assert.match(refusalFor(basicHelp, 'payments', 'escalated'), /Escalated in Payments — you have Basic there/);
});

test('a Basic admin is refused a whole area they were not given', () => {
  assert.equal(canWith(basicHelp, 'refunds', 'basic'), false);
  assert.equal(levelIn(basicHelp, 'refunds'), null);
});

test('Escalated includes Basic in the same area — and only that area', () => {
  assert.equal(canWith(escalatedPayments, 'payments', 'basic'), true);
  assert.equal(canWith(escalatedPayments, 'payments', 'escalated'), true);
  assert.equal(canWith(escalatedPayments, 'refunds', 'escalated'), false);
});

test('the owner can do everything, with no rows at all', () => {
  for (const a of ADMIN_AREAS) {
    assert.equal(canWith(owner, a, 'escalated'), true, a);
  }
});

test('unreadable scopes and unknown areas are always NO, and say they could not read', () => {
  assert.equal(canWith(unreadable, 'help', 'basic'), false);
  assert.match(refusalFor(unreadable, 'help', 'basic'), /Couldn’t read your admin areas/);
  assert.equal(canWith(owner, 'not_an_area', 'basic'), false);
  assert.equal(canWith(owner, 'help', 'admin' as never), false);
});

test('the owner is the owner address AND internal — neither alone', () => {
  assert.equal(isOwnerProfile({ email: OWNER_EMAIL, is_internal: true }), true);
  assert.equal(isOwnerProfile({ email: OWNER_EMAIL.toUpperCase(), is_internal: true }), true);
  assert.equal(isOwnerProfile({ email: OWNER_EMAIL, is_internal: false }), false);
  assert.equal(isOwnerProfile({ email: 'someone@else.com', is_internal: true }), false);
  assert.equal(isOwnerProfile(null), false);
});

test('ANCHOR — the migration was found and read', () => {
  assert.ok(MIGRATION, 'the areas × levels migration is missing');
  assert.ok(SQL.includes('admin_areas()'), 'migration read as something else');
});

test('TypeScript ADMIN_AREAS === SQL public.admin_areas(), in order', () => {
  const body = /FUNCTION public\.admin_areas\(\)[\s\S]*?ARRAY\[([\s\S]*?)\]::TEXT\[\]/.exec(SQL);
  assert.ok(body, 'could not find the admin_areas() array in the migration');
  const sqlAreas = [...(body[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1] ?? '');
  assert.deepEqual(sqlAreas, [...ADMIN_AREAS]);
  assert.equal(sqlAreas.length, 16);
});

test('the owner address in TypeScript === the one in is_platform_owner()', () => {
  const m = /FUNCTION public\.is_platform_owner[\s\S]*?lower\(u\.email\) = '([^']+)'/.exec(SQL);
  assert.ok(m, 'could not find the owner address in the migration');
  assert.equal(m?.[1], OWNER_EMAIL);
});

test('every action type the database allows has an area — nobody-may-decide is never silent', () => {
  const check = /ADD CONSTRAINT admin_approval_requests_action_type_check\s*CHECK \(action_type IN \(([\s\S]*?)\)\);/.exec(SQL);
  assert.ok(check, 'could not find the action-type CHECK in the migration');
  const types = [...(check[1] ?? '').replace(/--.*$/gm, '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1] ?? '');
  assert.ok(types.length >= 12, `read only ${types.length} action types`);
  for (const t of types) {
    assert.ok(areaForApprovalAction(t), `action type ${t} has no area in APPROVAL_ACTION_AREA`);
  }
  assert.deepEqual(new Set(Object.keys(APPROVAL_ACTION_AREA)), new Set(types));
});

test('money and privilege requests land in the area the drawing names', () => {
  assert.equal(areaForApprovalAction('approve_large_refund'), 'refunds');
  assert.equal(areaForApprovalAction('approve_retail_price_change'), 'prices_promos');
  assert.equal(areaForApprovalAction('approve_comp_grant'), 'gifts_comps');
  assert.equal(areaForApprovalAction('approve_payment_account_change'), 'receiving_accounts');
  assert.equal(areaForApprovalAction('approve_fraud_wipe_ban'), 'fraud');
  assert.equal(areaForApprovalAction('grant_team_member'), 'team');
});

test('an audit row: its recorded area wins; old rows read one from the action', () => {
  assert.equal(auditRowArea({ area: 'help', action: 'approval_approved:approve_large_refund' }), 'help');
  assert.equal(auditRowArea({ area: null, action: 'approval_approved:approve_large_refund' }), 'refunds');
  assert.equal(areaForAuditAction('payment_confirmed'), 'payments');
  assert.equal(areaForAuditAction('something_nobody_named'), null);
});
