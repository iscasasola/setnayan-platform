/**
 * Identity-cluster linkage — pure reducer over the `identity_clusters` matview
 * rows (I/O-free so `tsx --test` can import it directly; the admin verify page
 * owns the actual reads).
 *
 * `identity_clusters` (migration 20270516600000) assigns every user a
 * `cluster_id` = MIN(user_id) of the connected component it shares STRONG
 * signals with (device / address / payment). A user with no shared edge is its
 * own singleton (cluster_id === user_id). So a MEANINGFUL linkage for an
 * account = a cluster whose size is > 1: at least one OTHER account reached the
 * same underlying identity.
 *
 * This is the READ side only — it never captures a fingerprint. The matview is
 * populated by `refresh_identity_clusters`, which runs solely when device
 * capture is enabled (`NEXT_PUBLIC_DEVICE_FINGERPRINT_ENABLED`, DPO-gated, OFF).
 * With capture off the matview is empty, every input below is [], and this
 * returns {} — the linkage surfacing is DORMANT until capture is turned on.
 */

/** One row of the identity_clusters matview: a user and its component label. */
export type ClusterRow = { user_id: string; cluster_id: string };

/**
 * Given the flagged accounts' own cluster rows and the full membership of each
 * of their clusters, return `accountUserId -> other-account count` for every
 * flagged account that shares its cluster with ≥ 1 other account. Accounts that
 * are singletons (or have no matview row) are omitted entirely.
 *
 * @param flaggedOwnRows   the cluster rows for the flagged accounts themselves
 *                         (one per account that HAS a matview row).
 * @param clusterMemberRows every row for the cluster_ids those accounts belong
 *                          to (used purely to size each cluster).
 */
export function countOtherClusterAccounts(
  flaggedOwnRows: ReadonlyArray<ClusterRow>,
  clusterMemberRows: ReadonlyArray<ClusterRow>,
): Record<string, number> {
  // cluster_id -> distinct member user_ids (dedup guards against a caller
  // passing overlapping/duplicate rows).
  const membersByCluster = new Map<string, Set<string>>();
  for (const row of clusterMemberRows) {
    if (!row.cluster_id || !row.user_id) continue;
    let set = membersByCluster.get(row.cluster_id);
    if (!set) {
      set = new Set<string>();
      membersByCluster.set(row.cluster_id, set);
    }
    set.add(row.user_id);
  }

  const out: Record<string, number> = {};
  for (const own of flaggedOwnRows) {
    if (!own.user_id || !own.cluster_id) continue;
    const members = membersByCluster.get(own.cluster_id);
    // Cluster size minus this account itself. Fall back to the own-row set (1)
    // when member rows weren't supplied for this cluster.
    const size = members?.size ?? 1;
    const others = size - (members?.has(own.user_id) ? 1 : 0);
    if (others > 0) out[own.user_id] = others;
  }
  return out;
}
