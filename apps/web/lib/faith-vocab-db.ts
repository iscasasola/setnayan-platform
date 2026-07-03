/**
 * faith-vocab-db.ts — RE-EXPORT shim (Taxonomy Studio PR 6).
 *
 * The DB-first faith read-through was consolidated into the ONE shared faith
 * module `lib/faith-vocab.ts` (which also carries the labeled list + derived
 * types). This file stays as a thin re-export so existing importers keep
 * working; new code should import from `@/lib/faith-vocab` directly.
 *
 * ⚠ FAITH LANDMINE unchanged: keys are TITLE-CASE and compared with strict
 * `===`. Never lowercase a faith key.
 */
export { getActiveFaithKeys } from '@/lib/faith-vocab';
