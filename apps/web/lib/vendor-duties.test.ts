/**
 * 🧑‍🤝‍🧑 THE SIX SUPPLIER ROLES (owner 19 Nov 2026 — iscasasola/setnayan-platform#8013). Held:
 *   · the app's rank mirror (`VENDOR_DUTY_RANK`, `dutyOfRank`) says EXACTLY what the migration's trigger functions say —
 *     two copies of one rule that disagreed would show a role one thing and let the database do another;
 *   · every role has its fixed name, line and detail; every capability has words and at least one role that opens it;
 *   · the matrix is the owner's: Shop Manager opens all; Marketing no clients / no money; Event Crew no clients;
 *     Helper changes nothing; Branch Manager never the plan or money settings; an unknown role opens nothing;
 *   · each role's nav is the matrix's (a role that cannot open clients never sees Clients);
 *   · the shop's own names: a blank keeps the fixed name, renamed shows "COO · Shop Manager".
 * SABOTAGE: give marketing 'clients' → RED · change a rank in the migration → RED · drop a nav key's capability → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BRANCH_MANAGER_MAY_GIVE,
  VENDOR_CAPABILITY_WORDS,
  VENDOR_DUTIES,
  VENDOR_DUTY_DETAIL,
  VENDOR_DUTY_LINE,
  VENDOR_DUTY_MAY,
  VENDOR_DUTY_NAME,
  VENDOR_DUTY_RANK,
  cleanRoleName,
  dutyMay,
  dutyOfRank,
  dutyWorksAtABranch,
  memberWhereLine,
  roleNameOf,
  roleOptionLabel,
  type VendorCapability,
} from './vendor-duties';
import { VENDOR_DUTY_NAV_KEYS, navKeyVisibleTo } from './vendor-role';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '../../../supabase/migrations');
const SQL = (() => {
  const f = readdirSync(MIGRATIONS).filter((n) => n.endsWith('_supplier_six_roles.sql'));
  assert.equal(f.length, 1, 'exactly one supplier_six_roles migration');
  return readFileSync(join(MIGRATIONS, f[0]!), 'utf8');
})();

const CAPS = Object.keys(VENDOR_CAPABILITY_WORDS) as VendorCapability[];

test('the rank mirror is the migration’s own rule', () => {
  const rankFn = SQL.slice(SQL.indexOf('FUNCTION public.vendor_duty_rank('), SQL.indexOf('FUNCTION public.vendor_duty_of_rank('));
  for (const d of VENDOR_DUTIES) {
    const explicit = new RegExp(`WHEN '${d}'\\s+THEN '(\\w+)'::public\\.vendor_team_role`).exec(rankFn);
    const sqlRank = explicit ? explicit[1] : /ELSE '(\w+)'::public\.vendor_team_role/.exec(rankFn)![1];
    assert.equal(VENDOR_DUTY_RANK[d], sqlRank, `${d}: app says ${VENDOR_DUTY_RANK[d]}, database says ${sqlRank}`);
  }
  const ofRank = SQL.slice(SQL.indexOf('FUNCTION public.vendor_duty_of_rank('), SQL.indexOf('COMMENT ON FUNCTION public.vendor_duty_rank'));
  for (const r of ['owner', 'admin', 'agent'] as const) {
    const m = new RegExp(`WHEN '${r}' THEN '(\\w+)'`).exec(ofRank);
    assert.ok(m, `the database names a role for ${r}`);
    assert.equal(dutyOfRank(r), m[1]);
  }
  assert.equal(dutyOfRank('viewer'), /ELSE '(\w+)'/.exec(ofRank)![1]);
  // The CHECK lists the same six, in no other spelling.
  for (const d of VENDOR_DUTIES) assert.match(SQL, new RegExp(`'${d}'`));
});

test('the whole-shop roles carry no branch — in the app and in the database', () => {
  assert.equal(dutyWorksAtABranch('shop_manager'), false);
  assert.equal(dutyWorksAtABranch('marketing'), false);
  for (const d of ['branch_manager', 'account_manager', 'event_crew', 'helper'] as const) assert.equal(dutyWorksAtABranch(d), true);
  assert.match(SQL, /CHECK \(branch_id IS NULL OR duty NOT IN \('shop_manager', 'marketing'\)\)/);
});

test('every role and capability is named, and every capability opens for someone', () => {
  for (const d of VENDOR_DUTIES) {
    assert.ok(VENDOR_DUTY_NAME[d].length > 0 && VENDOR_DUTY_LINE[d].length > 8 && VENDOR_DUTY_DETAIL[d].length > 8, d);
  }
  for (const c of CAPS) assert.ok(VENDOR_DUTIES.some((d) => dutyMay(d, c)), `${c} opens for nobody`);
});

test('the matrix is the owner’s rulings', () => {
  for (const c of CAPS) assert.equal(dutyMay('shop_manager', c), true, `Shop Manager: ${c}`);
  for (const c of ['clients', 'all_clients', 'plan', 'money_settings', 'team'] as const) {
    assert.equal(dutyMay('marketing', c), false, `Marketing must not open ${c} ("no bookings, no money")`);
    assert.equal(dutyMay('event_crew', c), false, `Event Crew must not open ${c}`);
  }
  assert.equal(dutyMay('marketing', 'shop_page'), true);
  assert.equal(dutyMay('event_crew', 'event_day'), true);
  for (const c of CAPS) if (c !== 'clients' && c !== 'schedule') assert.equal(dutyMay('helper', c), false, `Helper: ${c}`);
  for (const c of ['plan', 'money_settings', 'role_names', 'all_clients', 'shop_page'] as const) {
    assert.equal(dutyMay('branch_manager', c), false, `Branch Manager: ${c}`);
    assert.equal(dutyMay('account_manager', c), false, `Account Manager: ${c}`);
  }
  for (const c of ['team', 'clients', 'event_day'] as const) assert.equal(dutyMay('branch_manager', c), true);
  for (const c of ['clients', 'event_day'] as const) assert.equal(dutyMay('account_manager', c), true);
  // Fail closed.
  for (const c of CAPS) {
    assert.equal(dutyMay(null, c), false);
    assert.equal(dutyMay('owner' as never, c), false);
  }
  // A Branch Manager gives only what is below them.
  assert.deepEqual([...BRANCH_MANAGER_MAY_GIVE].sort(), ['account_manager', 'event_crew', 'helper']);
  assert.match(SQL, /duty IN \('account_manager', 'event_crew', 'helper'\)/);
});

test('each role’s bar and rail follow the matrix', () => {
  const NEEDS: Record<string, VendorCapability> = { customers: 'clients', shop: 'shop_page', portfolio: 'shop_page', overview: 'schedule' };
  for (const d of VENDOR_DUTIES) {
    for (const [key, cap] of Object.entries(NEEDS)) {
      assert.equal(navKeyVisibleTo(key, null, d), dutyMay(d, cap), `${d} · ${key}`);
    }
    // The phone bar spells Today `profile`.
    assert.equal(navKeyVisibleTo('profile', null, d), true);
  }
  assert.equal(VENDOR_DUTY_NAV_KEYS.shop_manager, 'all');
  // Without a role read, the shipped rank rule: a non-manager sees Today + Clients only.
  assert.equal(navKeyVisibleTo('shop', 'agent'), false);
  assert.equal(navKeyVisibleTo('customers', 'viewer'), true);
  assert.equal(navKeyVisibleTo('shop', 'admin'), true);
});

test('the shop’s own names: blank keeps the fixed name; a renamed role shows both', () => {
  assert.equal(roleNameOf({}, 'account_manager'), 'Account Manager');
  assert.equal(roleNameOf({ account_manager: '  Lead Stylist ' }, 'account_manager'), 'Lead Stylist');
  assert.equal(roleOptionLabel({ shop_manager: 'COO' }, 'shop_manager'), 'COO · Shop Manager');
  assert.equal(roleOptionLabel({}, 'helper'), 'Helper');
  assert.equal(cleanRoleName('   '), null);
  assert.equal(cleanRoleName('x'.repeat(60))?.length, 40);
  assert.match(SQL, /CHECK \(length\(btrim\(display_name\)\) BETWEEN 1 AND 40\)/);
  assert.equal(
    memberWhereLine({ duty: 'account_manager', branchLabel: 'Makati branch', cardCount: 2, teamLabel: 'Front desk' }),
    'Makati branch · 2 cards · Front desk',
  );
  assert.equal(memberWhereLine({ duty: 'marketing', branchLabel: 'Makati branch', isSelf: true }), 'Whole shop · You');
});

test('event day has four ways in — and a Marketing seat or a Helper without a grant is still refused', async () => {
  const { shopsThisAccountMayActFor, dutyHandlesItsClients } = await import('./who-may-act-for-a-shop');
  assert.equal(dutyHandlesItsClients('account_manager'), true);
  assert.equal(dutyHandlesItsClients('branch_manager'), true);
  for (const d of ['marketing', 'event_crew', 'helper', 'shop_manager', null]) assert.equal(dutyHandlesItsClients(d), false);
  const none = { ownedProfileIds: [], grantedProfileIds: [] };
  // The client's Account Manager, no grant: in.
  assert.deepEqual(
    shopsThisAccountMayActFor({ ...none, teamRows: [{ vendorProfileId: 'A', role: 'agent' }], handlingProfileIds: ['A'] }),
    ['A'],
  );
  // On the roster, no grant, not their client: out.
  assert.deepEqual(shopsThisAccountMayActFor({ ...none, teamRows: [{ vendorProfileId: 'A', role: 'viewer' }] }), []);
  // Event Crew with a grant: in. Shop Manager: in.
  assert.deepEqual(shopsThisAccountMayActFor({ ownedProfileIds: [], teamRows: [{ vendorProfileId: 'A', role: 'viewer' }], grantedProfileIds: ['A'] }), ['A']);
  assert.deepEqual(shopsThisAccountMayActFor({ ...none, teamRows: [{ vendorProfileId: 'A', role: 'admin' }] }), ['A']);
  // The database admits the same two roles to the day through their cards.
  const dayof = SQL.slice(SQL.indexOf('FUNCTION public.current_vendor_dayof_grant_event_ids()'));
  assert.match(dayof, /tm\.duty IN \('account_manager', 'branch_manager'\)/);
  assert.match(dayof, /FROM public\.vendor_event_access_grants/, 'the grant way in is kept');
});
