/**
 * VENDOR VERIFICATION DOCUMENTS — the pure half.
 *
 * These are a vendor's government ID, DTI certificate, BIR 2303, mayor's permit
 * and bank proof. They live in their OWN bucket (`setnayan-vendor-verification`)
 * and they are the most sensitive personal data the platform holds.
 *
 * ── WHY THIS IS NOT PART OF /admin/website-media ────────────────────────────
 * That page manages the SITE'S OWN FURNITURE — logos, hero art, nav icons. A
 * person's passport photo is not furniture. Keeping the two apart means the
 * blast radius of a mistake on either page stops at that page, and it means the
 * copy on this one can say what these files actually are.
 *
 * ── WHAT "IN USE" MEANS HERE, EXACTLY ───────────────────────────────────────
 * A document is IN USE when a database row still points at its key. Two places
 * point:
 *   · `vendor_verifications` — five `*_r2_key` text columns, one per document.
 *   · `vendor_verification_applications.doc_uploads` — a jsonb map of
 *     slot → VALUE for an in-progress intake. ⚠ The value is NOT a key and
 *     never has been: `buildSlotValue` writes `{ r2_key, uploaded_at }`, an
 *     ARRAY of those for `portfolio_samples`, an array for
 *     `client_references`, a platform map for `social_media`, and `null` for a
 *     cleared slot. Reading `Object.values()` and keeping the strings — which
 *     is what this page shipped with — collects NOTHING, from any of them.
 * Anything in the bucket that no row names is LEFT OVER: a re-upload that
 * replaced it, or an application abandoned before submission.
 *
 * 🔑 **THE PREFIX COMES FROM THE UPLOAD CALL SITES, NOT FROM A MODULE NAME.**
 * `vendors/<vendorProfileId>/verification/<slot>` is what
 * `vendor-dashboard/verify/page.tsx:543`, `shop/_components/docs-body.tsx` and
 * `lib/r2-client-ref.ts:366` actually write. A previous media page shipped an
 * allowlist derived from names instead, and it matched ZERO objects.
 */

// RULE 0 — neither of these is written here. The erasure sweep's walk already
// reads this exact JSONB (its docstring explains the array slots), and the
// `r2://` decode already exists nine times over.
//
// ⚠ `parseR2Ref` lives in `nsfw-screen.ts` because that is the ONLY pure,
// exported copy: `lib/uploads.ts` (`parseStoredAsset`) and `lib/r2.ts` both
// open with `import 'server-only'`, which is not installed here, so a rule kept
// there is untestable by behaviour; `publicAssetTarget` refuses private buckets
// by design and this bucket is private; `keyFromRef` is gated on the site-media
// prefixes. The coupling is real and worth a note: nsfw-screen's top level is
// `import type` only today, and a runtime import added there would stop this
// module (and its test) from loading. If that happens, lift `parseR2Ref` into
// its own pure module rather than re-typing the arithmetic here.
import { collectStoredAssetRefs } from '@/lib/erasure/coverage';
import { parseR2Ref } from '@/lib/nsfw-screen';

/** One object in the verification bucket, as the admin page sees it. */
export type VerificationDoc = {
  key: string;
  size: number;
  lastModified: string | null;
  /** The vendor this key belongs to, read from the key itself. */
  vendorProfileId: string | null;
  /** The document slot (`government_id`, `dti_certificate`, …), from the key. */
  slot: string | null;
  state: 'in_use' | 'left_over' | 'unrecognised';
};

/** The uploaders' prefix. Everything this page manages sits under it. */
export const VERIFICATION_PREFIX = 'vendors/';

/**
 * Why the page refuses to delete when it can see files but no references.
 *
 * Rendered verbatim, so it has to read as a sentence a person can act on.
 */
export const EMPTY_REFERENCE_SET_REASON =
  'no vendor record points at ANY file in this bucket — which is what a broken check looks like, not what a tidy bucket looks like';

/**
 * Every string a stored reference value could be naming, at any depth.
 *
 * ── WHY THIS IS NOT `Object.values(doc_uploads)` ────────────────────────────
 * That is the bug this function exists to kill. `buildSlotValue` NEVER stores a
 * bare string: a normal document slot is `{ r2_key, uploaded_at }`,
 * `portfolio_samples` is an ARRAY of those, `client_references` is an array of
 * objects and `social_media` is a platform → link map. A `typeof value ===
 * 'string'` filter over the top level matches none of them, so the referenced
 * set came back EMPTY BY CONSTRUCTION and the first real government ID a
 * supplier uploaded was labelled "left over" with a permanent Delete beside it.
 *
 * ── WHY IT COLLECTS PLAIN STRINGS, WHICH LOOK LIKE NOISE ────────────────────
 * Both SEC-1 gates (`verify/actions.ts`, `shop/inline-docs-actions.ts`) admit a
 * value that does NOT start with `r2://` unconditionally — `!ref.startsWith(...)
 * ||` short-circuits ownership to true — so a BARE key is a legal stored shape,
 * and the erasure walk, which requires the scheme, provably drops one. Rather
 * than guess which plain strings are keys (a guess that is wrong DELETES
 * something), keep them all: a timestamp, a social URL or a referee's name can
 * never equal an object key from `ListObjectsV2`, so keeping it costs nothing.
 *
 * `r2://` refs are deliberately NOT collected here — `collectStoredAssetRefs`
 * owns those, and splitting the two makes each half separately provable.
 *
 * 🔑 **THE ONLY DIRECTION THAT CAN HURT SOMEBODY IS UNDER-COLLECTION.** An
 * extra string in the set can at worst refuse a delete. A missing one erases an
 * identity document with no undo. Every judgement call here goes the first way.
 */
export function collectPlainStrings(raw: unknown, maxDepth = 8): string[] {
  const found = new Set<string>();
  const walk = (value: unknown, depth: number): void => {
    if (depth > maxDepth || value === null || value === undefined) return;
    if (typeof value === 'string') {
      const t = value.trim();
      // `r2://` refs are the OTHER half's job. Leaving them out is what makes
      // both halves load-bearing: gut either one and a shape stops being found.
      if (t.length > 0 && !t.startsWith('r2://')) found.add(t);
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) walk(v, depth + 1);
      return;
    }
    if (typeof value === 'object') {
      for (const v of Object.values(value as Record<string, unknown>)) walk(v, depth + 1);
    }
  };
  walk(raw, 0);
  return [...found];
}

/**
 * Turn one stored value — a whole `doc_uploads` blob, or a single `*_r2_key`
 * column — into every key it could be naming.
 *
 * ── BOTH SIDES OF THE COMPARISON, NORMALISED ────────────────────────────────
 * The listing hands back a BARE S3 key (`r2List` pushes `o.Key` verbatim). The
 * database stores a FULL `r2://<bucket>/<key>` ref (`encodeR2Ref`). Those two
 * are never equal, so widening the walk ALONE still marks every live document
 * deletable — measured, not assumed. Each collected string therefore goes in
 * TWICE: raw, and again as the bare key `parseR2Ref` resolves out of it.
 *
 * A shape NEITHER form recognises still lands in the set raw, so it errs toward
 * "in use". That is the deliberate choice: more objects counted as referenced,
 * fewer deletable, never the other way.
 *
 * ⚖ NO BUCKET FILTER. A ref naming `setnayan-media` (a portfolio sample — the
 * writer accepts `vendorOwnedMediaPolicy` too) is kept. Dropping it could only
 * ever ENABLE a delete, and this is a government ID.
 *
 * 🔑 RULE 0 — the `r2://` walk is the erasure sweep's own
 * `collectStoredAssetRefs`, written for this exact JSONB and already
 * mutation-guarded. It is not re-implemented here; it is unioned with the plain
 * walk that covers the shapes it cannot see. Union, never intersection: a ref
 * either half finds is a ref that counts, and gutting either goes RED.
 */
export function referencedKeysFrom(raw: unknown): string[] {
  const out = new Set<string>();
  const candidates = new Set<string>([
    // Half one: every `r2://` ref, at any depth. The erasure sweep's own walk.
    ...collectStoredAssetRefs(raw),
    // Half two: everything that walk cannot see — a bare key, or any shape
    // nobody has written yet.
    ...collectPlainStrings(raw),
  ]);
  for (const candidate of candidates) {
    const value = candidate.trim();
    if (value.length === 0) continue;
    out.add(value);
    const { bucket, key } = parseR2Ref(value);
    if (bucket !== null && key.trim().length > 0) out.add(key.trim());
  }
  return [...out];
}

/**
 * Pull the vendor id and document slot out of a key.
 *
 * Returns nulls rather than throwing on a shape we do not recognise — an
 * unrecognised object still has to be LISTED, because the whole point of this
 * page is to show what is really there. Silently dropping it would hide exactly
 * the file someone needs to find.
 */
export function parseVerificationKey(key: string): {
  vendorProfileId: string | null;
  slot: string | null;
} {
  const m = /^vendors\/([^/]+)\/verification\/([^/]+)/.exec(key);
  if (!m) return { vendorProfileId: null, slot: null };
  const [, vendorProfileId, rest] = m;
  // The slot is the leading segment of the filename, before any timestamp or
  // extension the uploader appended.
  const slot = (rest ?? '').split('.')[0] ?? null;
  return { vendorProfileId: vendorProfileId ?? null, slot };
}

/**
 * Classify every object against the set of keys the database still references.
 *
 * `referenced` must be the COMPLETE set. A partial set would mark a live
 * document as left over, and this page can delete what it marks — so a caller
 * that fails to read one of the two sources must not call this at all.
 */
export function classifyVerificationDocs(
  objects: ReadonlyArray<{ key: string; size: number; lastModified: Date | null }>,
  referenced: ReadonlySet<string>,
): VerificationDoc[] {
  return objects.map((o) => {
    const { vendorProfileId, slot } = parseVerificationKey(o.key);
    const state: VerificationDoc['state'] = referenced.has(o.key)
      ? 'in_use'
      : vendorProfileId === null
        ? 'unrecognised'
        : 'left_over';
    return {
      key: o.key,
      size: o.size,
      lastModified: o.lastModified ? o.lastModified.toISOString() : null,
      vendorProfileId,
      slot,
      state,
    };
  });
}

/**
 * Is this key safe to delete?
 *
 * ONLY when the database references nothing that points at it. This is the
 * single gate on an irreversible action against identity documents, and it is
 * deliberately a re-derivation at delete time rather than a flag carried from
 * the page — the listing a person is looking at may be minutes old, and a
 * document can become referenced in between.
 *
 * 🪤 An `unrecognised` key is NOT deletable. We could not read a vendor out of
 * it, which means we cannot be confident we know what it is.
 *
 * 🪤 AND AN EMPTY REFERENCE SET IS NOT DELETABLE EITHER. See the body.
 */
export function isDeletableVerificationDoc(
  key: string,
  referenced: ReadonlySet<string>,
): boolean {
  // 🚨 AN EMPTY SET IS NOT EVIDENCE OF ANYTHING. We are standing in front of an
  // object that exists, so at least one reference SHOULD have been readable. A
  // set with nothing in it is what a broken reference reader returns, and that
  // is exactly how this page shipped — two sources, neither able to produce a
  // single key, no error raised by either. Refuse. The cost is an admin who
  // cannot tidy up; the alternative cost is a stranger's passport photo.
  if (referenced.size === 0) return false;
  if (referenced.has(key)) return false;
  const { vendorProfileId } = parseVerificationKey(key);
  return vendorProfileId !== null;
}

/** Human bytes, matching the website-media page's phrasing. */
export function formatDocSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
