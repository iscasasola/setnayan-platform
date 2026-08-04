/**
 * Unit tests for the erasure surface's pure parts.
 *
 * The one that matters is FAIL-CLOSED: an allow-list is only worth choosing over
 * a deny-list if an unknown key — a key nobody has invented yet — is stripped
 * without anyone editing this file. Every other test here is scaffolding around
 * that claim.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ERASURE_COLUMN_WRITES,
  ERASURE_ROW_DELETES,
  EVENTS_OWNER_PII_NULLS,
  OWN_ROW_DELETES,
  OWN_ROW_DELETES_BY_EMAIL,
  USERS_ANONYMIZE_NULLS,
  VENDOR_PROFILE_PII_SCRUB,
  WIZARD_STATE_ALLOWED_KEYS,
  scrubWizardState,
} from './coverage';

test('scrub · keeps the progress spine, drops the payload', () => {
  const { next, changed } = scrubWizardState({
    set_wedding_date: { completed_at: '2026-01-02T00:00:00Z', date: '2027-05-05', reasons_count: 3 },
    draft_guest_list: { in_flight_since: '2026-01-11T00:00:00Z', last_added_count: 42 },
  });
  assert.equal(changed, true);
  assert.deepEqual(next, {
    set_wedding_date: { completed_at: '2026-01-02T00:00:00Z' },
    draft_guest_list: { in_flight_since: '2026-01-11T00:00:00Z' },
  });
});

test('scrub · FAILS CLOSED on a key that does not exist yet (the whole reason for an allow-list)', () => {
  const { next } = scrubWizardState({
    // Nothing in this repo writes these today. A deny-list would pass them
    // straight through; that is precisely how the original gap was born.
    some_future_card: {
      completed_at: '2026-09-01T00:00:00Z',
      meta_passport_number: 'P1234567A',
      applicant_tin: '123-456-789',
      nested: { deep: { secret: 'still personal data' } },
    },
  });
  assert.deepEqual(next, { some_future_card: { completed_at: '2026-09-01T00:00:00Z' } });
  assert.ok(!JSON.stringify(next).includes('P1234567A'));
  assert.ok(!JSON.stringify(next).includes('still personal data'));
});

test('scrub · removes the civil-registry meta object outright', () => {
  const { next, strippedPaths } = scrubWizardState({
    cenomar_bride: {
      in_flight_since: '2026-01-12T00:00:00Z',
      meta: { reference_no: 'PSA-CENOMAR-2026-0099887' },
    },
  });
  assert.deepEqual(next, { cenomar_bride: { in_flight_since: '2026-01-12T00:00:00Z' } });
  assert.deepEqual(strippedPaths, ['cenomar_bride.meta']);
});

test('scrub · reports key PATHS, never values (the audit row must not re-copy the data)', () => {
  const { strippedPaths } = scrubWizardState({
    monogram: { completed_at: 'x', initials: 'A & B', style: 'serif' },
  });
  assert.deepEqual(strippedPaths, ['monogram.initials', 'monogram.style']);
  assert.ok(!strippedPaths.join(' ').includes('A & B'), 'a VALUE leaked into the audit path list');
});

test('scrub · already-clean state reports changed:false so the write is skipped', () => {
  const { next, changed, strippedPaths } = scrubWizardState({
    a: { completed_at: 'x' },
    b: { in_flight_since: 'y' },
  });
  assert.equal(changed, false);
  assert.deepEqual(strippedPaths, []);
  assert.deepEqual(next, { a: { completed_at: 'x' }, b: { in_flight_since: 'y' } });
});

test('scrub · survives every malformed shape (a purge that crashes is a purge that never runs)', () => {
  for (const bad of [null, undefined, 42, 'a string', [1, 2, 3], true]) {
    const r = scrubWizardState(bad);
    assert.deepEqual(r, { next: {}, strippedPaths: [], changed: false }, `failed on ${JSON.stringify(bad)}`);
  }
  // A null / scalar / array ENTRY is preserved verbatim: parseWizardState
  // tolerates it and the resolver reads it as pending. It carries no payload.
  const { next } = scrubWizardState({ a: null, b: 'weird', c: [1], d: { completed_at: 'x', pax: 5 } });
  assert.deepEqual(next, { a: null, b: 'weird', c: [1], d: { completed_at: 'x' } });
});

test('scrub · an empty task entry stays an empty object, not a dropped task', () => {
  // Dropping the KEY would reset the card to "never started" for the co-partner.
  const { next } = scrubWizardState({ pending_card: { pax: 100 } });
  assert.deepEqual(next, { pending_card: {} });
  assert.ok('pending_card' in next);
});

test('allow-list · is exactly the two progress stamps', () => {
  assert.deepEqual([...WIZARD_STATE_ALLOWED_KEYS].sort(), ['completed_at', 'in_flight_since']);
});

test('coverage map · is DERIVED from the payloads, so it cannot drift from them', () => {
  // If someone edits a payload constant without touching the map, this catches
  // it — the map is the guardrail's input, and a stale map guards nothing.
  for (const col of Object.keys(EVENTS_OWNER_PII_NULLS)) {
    assert.ok(ERASURE_COLUMN_WRITES.events?.includes(col), `events.${col} missing from the coverage map`);
  }
  for (const col of Object.keys(USERS_ANONYMIZE_NULLS)) {
    assert.ok(ERASURE_COLUMN_WRITES.users?.includes(col), `users.${col} missing from the coverage map`);
  }
  for (const col of Object.keys(VENDOR_PROFILE_PII_SCRUB)) {
    assert.ok(
      ERASURE_COLUMN_WRITES.vendor_profiles?.includes(col),
      `vendor_profiles.${col} missing from the coverage map`,
    );
  }
  for (const { table, column } of OWN_ROW_DELETES) {
    assert.deepEqual(ERASURE_ROW_DELETES[table], [column], `${table} delete filter missing from the map`);
  }
  for (const { table } of OWN_ROW_DELETES_BY_EMAIL) {
    assert.deepEqual(ERASURE_ROW_DELETES[table], ['email'], `${table} email filter missing from the map`);
  }
});

test('coverage map · the phantom columns are GONE and stay gone', () => {
  // Five names that were never columns. Each one rejected its whole statement.
  for (const gone of ['owner_email', 'owner_display_name']) {
    assert.ok(!(gone in EVENTS_OWNER_PII_NULLS), `events.${gone} is back — it is not a column, it is a VIEW alias`);
  }
  for (const gone of ['venue_address', 'venue_name', 'social_post_url']) {
    assert.ok(
      !(gone in USERS_ANONYMIZE_NULLS),
      `users.${gone} is back — venue_* live on events, social_post_url on vendor_profiles`,
    );
  }
  // …and social_post_url IS covered, on the table that actually has it.
  assert.ok('social_post_url' in VENDOR_PROFILE_PII_SCRUB);
});

test('own-row deletes · every entry carries a stated reason', () => {
  for (const { table, column, why } of OWN_ROW_DELETES) {
    assert.ok(column.length > 0, `${table} has no filter column`);
    assert.ok(why.length > 30, `${table} needs a real reason, not "${why}"`);
  }
  for (const { table, why } of OWN_ROW_DELETES_BY_EMAIL) {
    assert.ok(why.length > 30, `${table} needs a real reason, not "${why}"`);
  }
  const tables = OWN_ROW_DELETES.map((d) => d.table);
  assert.equal(new Set(tables).size, tables.length, 'duplicate table in OWN_ROW_DELETES');
});
