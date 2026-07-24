/**
 * identity-cluster-linkage — other-account counting over identity_clusters rows.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countOtherClusterAccounts, type ClusterRow } from './identity-cluster-linkage';

test('empty inputs (capture off / matview empty) → {} (dormant)', () => {
  assert.deepEqual(countOtherClusterAccounts([], []), {});
});

test('singleton account (cluster_id === own user_id, size 1) is omitted', () => {
  const own: ClusterRow[] = [{ user_id: 'u1', cluster_id: 'u1' }];
  const members: ClusterRow[] = [{ user_id: 'u1', cluster_id: 'u1' }];
  assert.deepEqual(countOtherClusterAccounts(own, members), {});
});

test('linked account surfaces the count of OTHER accounts in its cluster', () => {
  // Cluster c1 = {u1, u2, u3}; u1 is the flagged account → 2 others.
  const own: ClusterRow[] = [{ user_id: 'u1', cluster_id: 'c1' }];
  const members: ClusterRow[] = [
    { user_id: 'u1', cluster_id: 'c1' },
    { user_id: 'u2', cluster_id: 'c1' },
    { user_id: 'u3', cluster_id: 'c1' },
  ];
  assert.deepEqual(countOtherClusterAccounts(own, members), { u1: 2 });
});

test('two flagged accounts, only the linked one is reported', () => {
  const own: ClusterRow[] = [
    { user_id: 'u1', cluster_id: 'c1' }, // linked (shares c1 with u2)
    { user_id: 'u9', cluster_id: 'u9' }, // singleton
  ];
  const members: ClusterRow[] = [
    { user_id: 'u1', cluster_id: 'c1' },
    { user_id: 'u2', cluster_id: 'c1' },
    { user_id: 'u9', cluster_id: 'u9' },
  ];
  assert.deepEqual(countOtherClusterAccounts(own, members), { u1: 1 });
});

test('duplicate member rows do not inflate the count', () => {
  const own: ClusterRow[] = [{ user_id: 'u1', cluster_id: 'c1' }];
  const members: ClusterRow[] = [
    { user_id: 'u1', cluster_id: 'c1' },
    { user_id: 'u2', cluster_id: 'c1' },
    { user_id: 'u2', cluster_id: 'c1' }, // dup
  ];
  assert.deepEqual(countOtherClusterAccounts(own, members), { u1: 1 });
});

test('flagged account with no matview row is omitted', () => {
  const own: ClusterRow[] = []; // no cluster row for the account at all
  const members: ClusterRow[] = [{ user_id: 'u2', cluster_id: 'c1' }];
  assert.deepEqual(countOtherClusterAccounts(own, members), {});
});
