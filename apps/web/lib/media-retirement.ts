/**
 * MEDIA RETIREMENT — deciding which replaced object may be swept up.
 *
 * Several admin upload paths replace a file by repointing a database row at a
 * NEW key and leaving the old object in the bucket forever:
 *
 *   • background videos — `homepage-bg/slot-N/<uuid>-<name>` per upload
 *   • the sign-in hero  — `hero-videos/<uuid>-<name>`, plus an entire new
 *     `hero-frames/<sessionId>/` FOLDER of stills on every re-upload
 *
 * `/admin/website-media` makes the resulting pile visible. This module is the
 * other half: stop the pile growing.
 *
 * PURE ON PURPOSE — no `server-only` import — so the decision of what may be
 * deleted is unit-testable without a database or an R2 client. The sweep itself
 * lives in `website-media-server.ts`, next to the readers that prove a key is
 * unreferenced.
 *
 * THE RULE: a replaced key is a CANDIDATE, never a decision. Candidacy here is
 * necessary but not sufficient — `retireReplacedMedia` additionally re-reads the
 * live references and deletes only what nothing points at. Two independent
 * reasons, because this runs unattended on a publish path where nobody is
 * watching, unlike the admin page where a human clicks each row.
 */

import { isSiteMediaKey, keyFromRef } from '@/lib/website-media';

/**
 * Narrows previously-stored refs to the ones that MAY be swept after a replace.
 *
 * Applies, in order:
 *   1. normalise — a column may hold a bare key, an `r2://bucket/key` ref, or a
 *      public URL; `keyFromRef` recovers the key from any of them and returns
 *      null when it recognises none, which drops the value rather than guessing.
 *   2. keep only site media — the same allowlist the admin page is bound by, so
 *      a mis-stored customer key can never be swept by an upload path.
 *   3. drop anything still referenced by the NEW value. Re-uploading the same
 *      object, or a slot whose key did not change, must not delete it.
 *
 * Returns a de-duplicated list. Order follows first appearance in `previous`.
 */
export function retirableKeys(args: {
  previous: readonly (string | null | undefined)[];
  next: readonly (string | null | undefined)[];
}): string[] {
  const normalise = (values: readonly (string | null | undefined)[]): string[] => {
    const out: string[] = [];
    for (const v of values) {
      if (typeof v !== 'string' || !v) continue;
      const key = keyFromRef(v);
      if (key && isSiteMediaKey(key)) out.push(key);
    }
    return out;
  };

  const keep = new Set(normalise(args.next));
  const seen = new Set<string>();
  const retirable: string[] = [];

  for (const key of normalise(args.previous)) {
    if (keep.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    retirable.push(key);
  }

  return retirable;
}
