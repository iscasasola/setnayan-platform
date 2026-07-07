/**
 * Unit suite for vendor-category progress. Invariants: state derives from vendor
 * status via the merged state machine, empty/untouched categories are dropped,
 * and ordering is attention-first.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveVendorCategoryProgress } from './vendor-category-progress';

test('groups by category and resolves each to its lifecycle state', () => {
  const out = resolveVendorCategoryProgress([
    { category: 'catering', status: 'shortlisted' },
    { category: 'catering', status: 'shortlisted' }, // 2 shortlisted → searching
    { category: 'photo_video', status: 'deposit_paid' }, // → in_progress
    { category: 'florist', status: 'complete' }, // → done
  ]);
  const byCat = new Map(out.map((o) => [o.category, o]));
  assert.equal(byCat.get('catering')!.state, 'searching');
  assert.equal(byCat.get('photo_video')!.state, 'in_progress');
  assert.equal(byCat.get('florist')!.state, 'done');
  assert.equal(byCat.get('photo_video')!.label, 'Photo Video');
});

test('drops untouched (not_started) and blank categories', () => {
  const out = resolveVendorCategoryProgress([
    { category: null, status: 'shortlisted' }, // no category → dropped
    { category: '', status: 'shortlisted' }, // blank → dropped
    { category: 'coordinator', status: 'considering' }, // → needs_more_options (kept)
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.category, 'coordinator');
  assert.equal(out[0]!.state, 'needs_more_options');
});

test('one shortlisted vendor → one_option; count is reported', () => {
  const out = resolveVendorCategoryProgress([{ category: 'cake', status: 'shortlisted' }]);
  assert.equal(out[0]!.state, 'one_option');
  assert.equal(out[0]!.vendorCount, 1);
});

test('ordering is attention-first: searching/in-progress before done', () => {
  const out = resolveVendorCategoryProgress([
    { category: 'venue', status: 'complete' }, // done
    { category: 'band', status: 'considering' }, // needs_more_options
    { category: 'hmua', status: 'contracted' }, // in_progress
  ]);
  assert.deepEqual(out.map((o) => o.category), ['band', 'hmua', 'venue']);
});

test('empty input → no rows', () => {
  assert.deepEqual(resolveVendorCategoryProgress([]), []);
});
