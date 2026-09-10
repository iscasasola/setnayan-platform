import 'server-only';
import { r2Delete } from '@/lib/r2';
import {
  isPlannedDelete,
  planCleanupDelete,
  type CleanupScope,
  type PlannedDelete,
} from '@/lib/cleanup-delete-scope';

/**
 * cleanup-delete.ts — THE ONLY PLACE A CLEANUP JOB MAY DELETE AN R2 OBJECT.
 *
 * Every retention sweep, the "remove for good" sweep, story expiry, the
 * Save-the-Date seal retirement and erasure reach storage through here, and
 * through here only after `planCleanupDelete` (lib/cleanup-delete-scope.ts)
 * has proven the object is the row's own. The rule and its reasoning live in
 * that file; this one is deliberately too small to hold a decision.
 *
 * `lib/every-cleanup-delete-is-pinned.test.ts` derives every file that calls a
 * raw delete primitive (`r2Delete`, `deletePublicAsset`, `DeleteObjectCommand`,
 * a storage `.remove([…])`) and fails when one appears outside this module and
 * its reasoned, exact exemption list — so a new sweep cannot quietly go around
 * the check.
 *
 * Best-effort by the house contract for `r2Delete`: a failed delete THROWS and
 * the caller catches and counts it; a failed delete leaves an orphan, never lost
 * data.
 */

/**
 * Delete one object that `planCleanupDelete` already proved. Refuses anything
 * else — a `{ bucket, key }` built by hand is not a proof, and the brand it
 * would need is private to the planner's module.
 */
export async function executeCleanupDelete(target: PlannedDelete): Promise<void> {
  if (!isPlannedDelete(target)) {
    throw new Error('executeCleanupDelete: refused an unplanned delete target');
  }
  await r2Delete({ bucket: target.bucket, key: target.key });
}

/**
 * Plan + execute in one call. Returns `'refused'` — as DATA, never thrown — when
 * the ref is not the row's own; the caller must count that and must not clear
 * the pointer it refused. Throws only when an in-scope delete fails.
 */
export async function cleanupDelete(
  ref: unknown,
  scope: CleanupScope,
): Promise<'deleted' | 'refused'> {
  const decision = planCleanupDelete(ref, scope);
  if (!decision.ok) return 'refused';
  await executeCleanupDelete(decision.target);
  return 'deleted';
}
