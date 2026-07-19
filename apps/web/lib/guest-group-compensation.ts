/**
 * Orphan-group compensation helper (T18 — orphan-groups on-failed-add).
 *
 * The capture-bar single-add (app/dashboard/[eventId]/guests/inline-actions.ts
 * › addSingleGuest) mints every parsed `#Group` UP FRONT, then inserts the
 * guest. When that insert fails (invalid side, the post-finalize gate, the
 * bride/groom singleton 23505, or any DB/RLS error) the freshly-minted groups
 * would be left behind as empty orphans.
 *
 * `quickCreateGroup` is find-or-create idempotent, so the only safe cleanup is
 * to delete the groups THIS call actually created — never a group the couple
 * already had. That "created" provenance is the load-bearing decision, so it is
 * isolated here and unit-pinned (guest-group-compensation.test.ts): a group
 * whose result carries `created:false` (the reuse path) is NEVER returned.
 *
 * Kept dependency-free (a local structural input type, no app/ imports) so the
 * never-delete-a-pre-existing-group invariant is testable in isolation. The
 * app-layer QuickGroupResult[] is structurally assignable to this type.
 */

/** Minimal structural mirror of a find-or-create group result. */
export type CreatableGroupResult =
  | { ok: true; created: boolean; group: { group_id: string } }
  | { ok: false };

/**
 * The group ids that were FRESHLY created by this batch of find-or-create
 * calls — i.e. the only ids eligible for on-failed-add deletion. Reuse results
 * (`created:false`) and failures are excluded; ids are de-duplicated so a group
 * minted once but referenced twice (e.g. `#Friends` then `#friends`) is only
 * returned — and therefore only deleted — once.
 */
export function collectCreatedGroupIds(results: CreatableGroupResult[]): string[] {
  const ids: string[] = [];
  for (const r of results) {
    if (r.ok && r.created === true && !ids.includes(r.group.group_id)) {
      ids.push(r.group.group_id);
    }
  }
  return ids;
}
