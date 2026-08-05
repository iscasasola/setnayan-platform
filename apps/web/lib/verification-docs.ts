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
 *     slot → key for an in-progress intake.
 * Anything in the bucket that no row names is LEFT OVER: a re-upload that
 * replaced it, or an application abandoned before submission.
 *
 * 🔑 **THE PREFIX COMES FROM THE UPLOAD CALL SITES, NOT FROM A MODULE NAME.**
 * `vendors/<vendorProfileId>/verification/<slot>` is what
 * `vendor-dashboard/verify/page.tsx:543`, `shop/_components/docs-body.tsx` and
 * `lib/r2-client-ref.ts:366` actually write. A previous media page shipped an
 * allowlist derived from names instead, and it matched ZERO objects.
 */

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
 */
export function isDeletableVerificationDoc(
  key: string,
  referenced: ReadonlySet<string>,
): boolean {
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
