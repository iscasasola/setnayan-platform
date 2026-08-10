import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  LOCKED_IDENTITY_FIELD_KEYS,
  LOCKED_FIELD_LABEL,
  isLockedIdentityFieldKey,
} from './vendor-corrections';

/**
 * The city was the one public claim on a shop that nobody could change.
 *
 * Measured in prod 2026-08-10: a vendor typed their street into the City box at
 * signup and their shop read `location_city = '76 sampaguita ave'`. Every couple
 * filtering by city missed it from that moment on — and there was no way back:
 * no city field anywhere on My Shop, and the only admin writer refuses claimed
 * shops.
 *
 * These check the three places a correctable field has to be known about. Miss
 * one and the feature is reachable but unusable, which is this repo's most
 * repeated failure shape.
 */

test('the city is a field a vendor can ask to have corrected', () => {
  assert.ok(isLockedIdentityFieldKey('location_city'));
  assert.ok((LOCKED_IDENTITY_FIELD_KEYS as readonly string[]).includes('location_city'));
});

test('it has a label, or the request UI renders a blank row', () => {
  assert.equal(LOCKED_FIELD_LABEL.location_city, 'City');
});

test('every locked key has a label — none can be added without one', () => {
  for (const key of LOCKED_IDENTITY_FIELD_KEYS) {
    assert.ok(
      LOCKED_FIELD_LABEL[key]?.trim(),
      `${key} is correctable but has no label to show the vendor`,
    );
  }
});

test('the admin approval knows how to apply every locked key', () => {
  // 🔑 THE HALF THAT WOULD BE MISSED. Adding a key to the list makes the
  // REQUEST possible; without a case in `parseRequestedValue` the admin's
  // Approve button falls through and applies something the field never meant.
  // A vendor would wait for an approval that could not work.
  const actions = readFileSync(
    join(process.cwd(), 'app/admin/corrections/actions.ts'),
    'utf8',
  );
  const applies = actions.slice(
    actions.indexOf('function parseRequestedValue'),
    actions.indexOf('function parseRequestedValue') + 3000,
  );
  for (const key of LOCKED_IDENTITY_FIELD_KEYS) {
    assert.ok(
      applies.includes(`case '${key}'`),
      `${key} can be requested but the admin approval has no case for it`,
    );
  }
});

test('the vendor has somewhere to type it', () => {
  // A correctable field with no input is a correction nobody can start. The
  // city rides inside the address row rather than as its own checklist item —
  // a new row would flip every existing vendor's Business Profile from complete
  // to incomplete for a field they were never asked for.
  const row = readFileSync(
    join(process.cwd(), 'app/vendor-dashboard/shop/_components/editable-row.tsx'),
    'utf8',
  );
  assert.match(row, /name="location_city"/, 'My Shop has no city input');
  const page = readFileSync(
    join(process.cwd(), 'app/vendor-dashboard/shop/page.tsx'),
    'utf8',
  );
  assert.match(
    page,
    /location_city: profile\.location_city/,
    'the city input is rendered but never given its current value',
  );
});

test('the save path writes it', () => {
  const actions = readFileSync(
    join(process.cwd(), 'app/vendor-dashboard/actions.ts'),
    'utf8',
  );
  assert.match(
    actions,
    /patch = \{ \.\.\.patch, location_city: nullIfBlank\(formData\.get\('location_city'\)\) \}/,
    'the city is typed into a box that nothing saves',
  );
});

test('the admin editor no longer refuses in silence', () => {
  // `.is('user_id', null)` matching zero rows is not an error — PostgREST
  // returns success with nothing changed, so an admin pressed Save on a claimed
  // shop and was told nothing at all.
  const actions = readFileSync(
    join(process.cwd(), 'app/admin/vendors/actions.ts'),
    'utf8',
  );
  assert.match(actions, /updated\.length === 0/, 'a zero-row update still passes silently');
  assert.match(
    actions,
    /admin\/corrections/,
    'the refusal must say where the change CAN be made, or it is a dead end',
  );
});
