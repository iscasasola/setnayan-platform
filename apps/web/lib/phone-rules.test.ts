import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  parseVendorPhone,
  isSupportedVendorCountry,
  SUPPORTED_VENDOR_COUNTRIES,
} from './phone-rules';

/**
 * The seam a second country slots into. Owner 2026-08-10: *"just place that
 * variable… but for now it is just philippines."*
 */

test('one country today, deliberately', () => {
  assert.deepEqual([...SUPPORTED_VENDOR_COUNTRIES], ['PH']);
});

test('a Philippine number passes when the pin says PH', () => {
  assert.ok(parseVendorPhone('09178807163', 'PH').ok);
  assert.ok(parseVendorPhone('09178807163', 'ph').ok, 'case must not decide it');
});

test('an unknown or missing country falls back to PH — and fails CLOSED', () => {
  // 🔑 THE IMPORTANT DIRECTION. If the map is ever opened without this map
  // being updated, a foreign number must be REFUSED, not waved through: a
  // refusal gets reported by the person in front of it, a silent acceptance
  // never does.
  assert.ok(parseVendorPhone('09178807163', null).ok, 'a PH number still works with no country');
  assert.equal(parseVendorPhone('+65 6123 4567', 'SG').ok, false, 'SG is not supported yet — refuse it');
  assert.equal(parseVendorPhone('+1 415 555 2671', undefined).ok, false);
});

test('the supported-country check is honest about what it covers', () => {
  assert.ok(isSupportedVendorCountry('PH'));
  assert.ok(isSupportedVendorCountry('ph'));
  assert.equal(isSupportedVendorCountry('SG'), false);
  assert.equal(isSupportedVendorCountry(''), false);
  assert.equal(isSupportedVendorCountry(null), false);
});

test('the country is captured from the pin, not assumed', () => {
  const geo = readFileSync(join(process.cwd(), 'lib/geo.ts'), 'utf8');
  const hits = geo.match(/country: typeof a\.country_code === 'string'/g) ?? [];
  assert.equal(
    hits.length,
    2,
    'both the address search and the pin lookup must record the country — ' +
      'one of them missing means half the vendors have an assumed country',
  );
});

test('it is only stored alongside real coordinates', () => {
  // A country with no pin is a claim about a place nobody marked.
  const actions = readFileSync(join(process.cwd(), 'app/open-shop/actions.ts'), 'utf8');
  const block = actions.slice(actions.indexOf('if (pin) {'));
  assert.match(block.slice(0, 800), /patch\.hq_country = country/);
});

test('the signup number is checked against the country, not hard-coded to PH', () => {
  const actions = readFileSync(join(process.cwd(), 'app/open-shop/actions.ts'), 'utf8');
  assert.match(
    actions,
    /parseVendorPhone\(/,
    'signup calls the Philippine parser directly again — adding a country would ' +
      'then need a change here as well as in the rules map, which is the coupling ' +
      'this seam exists to remove',
  );
});
