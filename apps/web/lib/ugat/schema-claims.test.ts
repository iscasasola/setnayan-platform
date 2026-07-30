import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  verifyUgatClaims,
  formatClaimFailures,
  claimedTables,
  uniqueKey,
  type UgatIntrospection,
  type UgatSchemaClaim,
} from './schema-claims';

/**
 * These tests run against a SYNTHETIC schema, not the migration replay. That is
 * the point: the replay proves the real claims hold today, but it can never
 * prove the checker would NOTICE if they stopped. Every case below is a
 * neutralisation — a schema where a claim must FAIL. A guard nobody has watched
 * fail is a guard you are trusting on faith.
 */

function intro(over: Partial<UgatIntrospection> = {}): UgatIntrospection {
  return {
    columns: new Set([
      'event_members.event_id',
      'event_members.user_id',
      'event_members.guest_id',
      'guests.guest_id',
      'guests.event_id',
      'vendor_services.category',
    ]),
    fks: new Set(['guests.event_id->events']),
    uniques: new Set([uniqueKey('event_members', ['event_id', 'user_id'])]),
    checks: new Map([
      [
        'events.events_community_class_consistency',
        "CHECK (((community_id IS NULL) OR (event_type = ANY (ARRAY['simple_event'::text]))))",
      ],
    ]),
    ...over,
  };
}

const owner = (claims: UgatSchemaClaim[]) => [{ ownerId: 'J-TEST', claims }];

/* ── the happy path ── */

test('a fully satisfied claim set produces no failures', () => {
  const failures = verifyUgatClaims(
    owner([
      { kind: 'table', table: 'event_members' },
      { kind: 'column', table: 'event_members', column: 'guest_id' },
      { kind: 'no_column', table: 'guests', column: 'user_id' },
      { kind: 'fk', table: 'guests', column: 'event_id', references: 'events' },
      { kind: 'no_fk', table: 'vendor_services', column: 'category' },
      { kind: 'unique', table: 'event_members', columns: ['event_id', 'user_id'] },
    ]),
    intro(),
  );
  assert.deepEqual(failures, []);
  assert.match(formatClaimFailures(failures), /All Ugat schema claims hold/);
});

/* ── neutralisation: each kind must FAIL when the schema moves ── */

test('table: a dropped table is caught', () => {
  const f = verifyUgatClaims(owner([{ kind: 'table', table: 'payment_inbox_messages' }]), intro());
  assert.equal(f.length, 1);
  assert.match(f[0]!.detail, /does not exist/);
});

test('column: a dropped column is caught — the events.qr_revoked_at class', () => {
  const f = verifyUgatClaims(
    owner([{ kind: 'column', table: 'guests', column: 'qr_revoked_at' }]),
    intro(),
  );
  assert.equal(f.length, 1);
  assert.match(f[0]!.detail, /column "guests\.qr_revoked_at" does not exist/);
});

test('column: a missing TABLE is reported as such, not as a missing column', () => {
  const f = verifyUgatClaims(
    owner([{ kind: 'column', table: 'order_ledger_entries', column: 'amount' }]),
    intro(),
  );
  assert.match(f[0]!.detail, /table "order_ledger_entries" does not exist/);
});

test('no_column: an ADDED column is caught — the documented absence went stale', () => {
  const f = verifyUgatClaims(
    owner([{ kind: 'no_column', table: 'guests', column: 'user_id' }]),
    intro({
      columns: new Set([...intro().columns, 'guests.user_id']),
    }),
  );
  assert.equal(f.length, 1);
  assert.match(f[0]!.detail, /NOW EXISTS/);
});

test('no_column: a vanished table makes the claim VACUOUS, not passing', () => {
  // Without this, dropping a table would silently turn every no_column claim on
  // it green — a guard that gets stronger as the schema disappears.
  const f = verifyUgatClaims(
    owner([{ kind: 'no_column', table: 'gone_table', column: 'whatever' }]),
    intro(),
  );
  assert.equal(f.length, 1);
  assert.match(f[0]!.detail, /vacuous/);
});

test('fk: a removed FK is caught', () => {
  const f = verifyUgatClaims(
    owner([{ kind: 'fk', table: 'guests', column: 'event_id', references: 'events' }]),
    intro({ fks: new Set() }),
  );
  assert.equal(f.length, 1);
  assert.match(f[0]!.detail, /no FK/);
});

test('fk: pointing at the WRONG table is caught', () => {
  const f = verifyUgatClaims(
    owner([{ kind: 'fk', table: 'guests', column: 'event_id', references: 'communities' }]),
    intro(),
  );
  assert.equal(f.length, 1);
});

test('no_fk: an ADDED FK is caught — the trap was RESOLVED and must be deleted', () => {
  // The direction people forget. F9 warns vendor_services.category has no FK;
  // the day someone adds one, this registry would keep warning about a trap
  // that no longer exists.
  const f = verifyUgatClaims(
    owner([{ kind: 'no_fk', table: 'vendor_services', column: 'category' }]),
    intro({ fks: new Set(['vendor_services.category->canonical_service_taxonomy']) }),
  );
  assert.equal(f.length, 1);
  assert.match(f[0]!.detail, /RESOLVED/);
});

test('no_fk: a vanished COLUMN makes the claim vacuous, not passing', () => {
  const f = verifyUgatClaims(
    owner([{ kind: 'no_fk', table: 'vendor_services', column: 'gone_col' }]),
    intro(),
  );
  assert.match(f[0]!.detail, /vacuous/);
});

test('unique: a dropped UNIQUE is caught', () => {
  const f = verifyUgatClaims(
    owner([{ kind: 'unique', table: 'event_members', columns: ['event_id', 'user_id'] }]),
    intro({ uniques: new Set() }),
  );
  assert.equal(f.length, 1);
  assert.match(f[0]!.detail, /no UNIQUE/);
});

test('unique: column ORDER does not matter', () => {
  const f = verifyUgatClaims(
    owner([{ kind: 'unique', table: 'event_members', columns: ['user_id', 'event_id'] }]),
    intro(),
  );
  assert.deepEqual(f, []);
});

/* ── check constraints (added 2026-07-30, after one slipped through) ── */

test('check: a satisfied named constraint passes', () => {
  const f = verifyUgatClaims(
    owner([
      { kind: 'check', table: 'events', name: 'events_community_class_consistency' },
    ]),
    intro(),
  );
  assert.deepEqual(f, []);
});

test('check: a missing constraint is caught', () => {
  const f = verifyUgatClaims(
    owner([{ kind: 'check', table: 'events', name: 'no_such_rule' }]),
    intro(),
  );
  assert.equal(f.length, 1);
  assert.match(f[0]!.detail, /no CHECK constraint named/);
});

test('check: `mentions` catches a constraint REWRITTEN under the same name', () => {
  // The case that motivated this kind. J15's prose claimed the rule pairs
  // community_id with "the event class" — no such column exists; it tests
  // event_type. Existence alone would have passed and kept the lie alive.
  const f = verifyUgatClaims(
    owner([
      {
        kind: 'check',
        table: 'events',
        name: 'events_community_class_consistency',
        mentions: 'event_class',
      },
    ]),
    intro(),
  );
  assert.equal(f.length, 1);
  assert.match(f[0]!.detail, /does NOT mention "event_class"/);
});

test('check: `mentions` passes when the constraint really does test that column', () => {
  const f = verifyUgatClaims(
    owner([
      {
        kind: 'check',
        table: 'events',
        name: 'events_community_class_consistency',
        mentions: 'event_type',
      },
    ]),
    intro(),
  );
  assert.deepEqual(f, []);
});

/* ── reporting ── */

test('all failures are reported, not just the first', () => {
  const f = verifyUgatClaims(
    [
      { ownerId: 'J1', claims: [{ kind: 'table', table: 'nope_a' }] },
      { ownerId: 'J2', claims: [{ kind: 'table', table: 'nope_b' }] },
    ],
    intro(),
  );
  assert.equal(f.length, 2);
  const msg = formatClaimFailures(f);
  assert.match(msg, /J1/);
  assert.match(msg, /J2/);
  // the report must name BOTH remedies, so nobody "fixes" it by deleting claims
  assert.match(msg, /fix graph\.ts/);
  assert.match(msg, /Do NOT delete the claim/);
});

test('claimedTables collects every table a claim touches', () => {
  const tables = claimedTables([
    { ownerId: 'J1', claims: [{ kind: 'table', table: 'a' }] },
    {
      ownerId: 'J2',
      claims: [
        { kind: 'column', table: 'b', column: 'x' },
        { kind: 'fk', table: 'c', column: 'y', references: 'd' },
      ],
    },
  ]);
  assert.deepEqual([...tables].sort(), ['a', 'b', 'c']);
});
