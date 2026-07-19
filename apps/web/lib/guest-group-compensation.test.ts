/**
 * Unit suite for the orphan-group compensation invariant (T18).
 *
 * The load-bearing rule pinned here: `collectCreatedGroupIds` returns ONLY the
 * ids of groups that were freshly created (`created:true`) — never a group that
 * the find-or-create path reused (`created:false`). This is what guarantees the
 * on-failed-add cleanup can never delete a pre-existing group the couple had.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  collectCreatedGroupIds,
  type CreatableGroupResult,
} from './guest-group-compensation';

test('a fresh created:true id IS collected', () => {
  const results: CreatableGroupResult[] = [
    { ok: true, created: true, group: { group_id: 'g-new' } },
  ];
  assert.deepEqual(collectCreatedGroupIds(results), ['g-new']);
});

test('a reuse created:false id is NOT collected (never delete a pre-existing group)', () => {
  const results: CreatableGroupResult[] = [
    { ok: true, created: false, group: { group_id: 'g-existing' } },
  ];
  assert.deepEqual(collectCreatedGroupIds(results), []);
});

test('mixed provenance → only the freshly created id', () => {
  const results: CreatableGroupResult[] = [
    { ok: true, created: false, group: { group_id: 'g-existing' } },
    { ok: true, created: true, group: { group_id: 'g-new' } },
  ];
  assert.deepEqual(collectCreatedGroupIds(results), ['g-new']);
});

test('duplicate created ids dedup to one (deleted once)', () => {
  const results: CreatableGroupResult[] = [
    { ok: true, created: true, group: { group_id: 'g-dup' } },
    { ok: true, created: true, group: { group_id: 'g-dup' } },
  ];
  assert.deepEqual(collectCreatedGroupIds(results), ['g-dup']);
});

test('all-reuse / all-fail / empty → []', () => {
  assert.deepEqual(collectCreatedGroupIds([]), []);
  assert.deepEqual(
    collectCreatedGroupIds([
      { ok: true, created: false, group: { group_id: 'a' } },
      { ok: true, created: false, group: { group_id: 'b' } },
    ]),
    [],
  );
  assert.deepEqual(collectCreatedGroupIds([{ ok: false }, { ok: false }]), []);
});
