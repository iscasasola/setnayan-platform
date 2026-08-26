import test from 'node:test';
import assert from 'node:assert/strict';

import { fieldKind, humanizeFieldLabel, askParamKey, ADMIN_ASK_PARAM } from './humanize-field';

test('boolean-shaped names read as a checkbox', () => {
  assert.equal(fieldKind('is_rental'), 'boolean');
  assert.equal(fieldKind('is_ph'), 'boolean');
  assert.equal(fieldKind('has_receipt'), 'boolean');
  assert.equal(fieldKind('show_banner'), 'boolean');
  assert.equal(fieldKind('recurs_monthly'), 'boolean');
  assert.equal(fieldKind('geo_enabled'), 'boolean');
  assert.equal(fieldKind('display_name_en'), 'text');
  assert.equal(fieldKind('tile_id'), 'text');
});

test('labels drop the id/locale suffixes a person never types', () => {
  assert.equal(humanizeFieldLabel('display_name_en'), 'Display name');
  assert.equal(humanizeFieldLabel('tile_id'), 'Tile');
  assert.equal(humanizeFieldLabel('vendor_profile_id'), 'Vendor profile');
  assert.equal(humanizeFieldLabel('amount_php'), 'Amount (₱)');
});

test('a boolean field reads as a question', () => {
  assert.equal(humanizeFieldLabel('is_rental'), 'Rental?');
  assert.equal(humanizeFieldLabel('is_ph'), 'Ph?');
});

test('the param key can never collide with a page\'s own query params', () => {
  assert.equal(askParamKey('tile_id'), 'aa_tile_id');
  assert.notEqual(askParamKey('tab'), 'tab');
  assert.notEqual(askParamKey('q'), 'q');
  assert.equal(ADMIN_ASK_PARAM, 'admin_ask');
});
