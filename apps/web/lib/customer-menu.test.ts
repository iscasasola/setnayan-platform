import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildCustomerMenuTree } from './customer-menu';

const EVENT_ID = 'evt-test';

// --- default (no gating): byte-identical 5-tab planning tree ---------------
test('planning tree has the 5 canonical menus when hideKeys is empty/absent', () => {
  const keys = buildCustomerMenuTree(EVENT_ID).map((m) => m.key);
  assert.deepEqual(keys, ['home', 'guests', 'explore', 'studio', 'budget']);
  // Empty array is also a no-op.
  const keys2 = buildCustomerMenuTree(EVENT_ID, { hideKeys: [] }).map((m) => m.key);
  assert.deepEqual(keys2, ['home', 'guests', 'explore', 'studio', 'budget']);
});

// --- Simple Event gating: drop Explore (vendors) + Budget ------------------
test('hideKeys drops the named top menus (Simple Event = no explore/budget)', () => {
  const keys = buildCustomerMenuTree(EVENT_ID, {
    hideKeys: ['explore', 'budget'],
  }).map((m) => m.key);
  assert.deepEqual(keys, ['home', 'guests', 'studio']);
});

test('hideKeys with just explore keeps budget', () => {
  const keys = buildCustomerMenuTree(EVENT_ID, { hideKeys: ['explore'] }).map((m) => m.key);
  assert.deepEqual(keys, ['home', 'guests', 'studio', 'budget']);
});

// --- phase takeovers are unaffected (they carry no explore/budget) ---------
test('Day-of / After phase rosters ignore hideKeys', () => {
  const dayof = buildCustomerMenuTree(EVENT_ID, {
    phase: 'dayof',
    hideKeys: ['explore', 'budget'],
  }).map((m) => m.key);
  assert.deepEqual(dayof, ['now', 'checkin', 'seats', 'services', 'schedule']);
  const after = buildCustomerMenuTree(EVENT_ID, {
    phase: 'after',
    hideKeys: ['explore', 'budget'],
  }).map((m) => m.key);
  assert.deepEqual(after, ['home', 'review', 'editorial', 'galleries']);
});
