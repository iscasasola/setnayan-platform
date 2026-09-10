import 'server-only';
import { r2Delete } from '@/lib/r2';
import { bindCleanupExecutor } from '@/lib/cleanup-delete-scope';

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
 * Bound ONCE, here, to the real R2 delete. The refusal of anything the planner
 * did not mint lives in `bindCleanupExecutor` (lib/cleanup-delete-scope.ts), so
 * it is proved by `cleanup-delete-scope.test.ts` with a fake deleter.
 */
const executor = bindCleanupExecutor(r2Delete);

/** Delete one object that `planCleanupDelete` already proved; refuses anything else. */
export const executeCleanupDelete = executor.executeCleanupDelete;

/** Plan + execute; `'refused'` as data when the ref is not the row's own. */
export const cleanupDelete = executor.cleanupDelete;
