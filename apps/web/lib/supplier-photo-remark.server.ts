/**
 * THE RE-MARK JOB (owner-approved 2026-11-04, supplier_photo_mark "Also
 * decided"): "The day a shop is verified its photos are re-marked with the
 * verified variant, and back to Setnayan only if it loses verification."
 *
 * Each `supplier_photo_originals` row pairs a PUBLIC marked copy with its
 * PRIVATE clean copy and records what the public copy carries (`mark_kind`).
 * A row is PENDING when that disagrees with the shop's state now. Re-marking a
 * row re-stamps the clean copy (same shared geometry, server painter) and
 * writes it back AT THE SAME PUBLIC KEY, so every column that stores the ref
 * stays valid — then records the new `mark_kind`. Running twice does nothing
 * the second time: IDEMPOTENT by construction.
 *
 * 🛑 THIS SLICE SHIPS THE DRY RUN ONLY. `scripts/remark-supplier-photos.ts`
 * counts what is pending and changes nothing; it refuses any other mode.
 * Applying it against production is an owner decision (it rewrites public
 * bytes), not a session's. `remarkOne` is exported for that later runner and
 * for the guard, which drives it with fakes.
 */
import type { MarkSpec } from './photo-mark-geometry';

export type OriginalRow = {
  id: number;
  vendor_profile_id: string;
  public_ref: string;
  original_ref: string;
  frame: unknown;
  mark_kind: 'setnayan' | 'verified';
};

export type MarkKind = OriginalRow['mark_kind'];

/** What the public copy SHOULD carry, from the shop's spec now. */
export function desiredMarkKind(spec: Extract<MarkSpec, { kind: 'supplier' }>): MarkKind {
  return spec.verified ? 'verified' : 'setnayan';
}

/** The rows whose public copy disagrees with their shop's state — pure. */
export function pendingRemarks(rows: readonly OriginalRow[], desiredByShop: ReadonlyMap<string, MarkKind>): OriginalRow[] {
  return rows.filter((r) => {
    const want = desiredByShop.get(r.vendor_profile_id);
    return want !== undefined && want !== r.mark_kind;
  });
}

export type RemarkDeps = {
  getBytes: (ref: string) => Promise<Uint8Array>;
  putBytes: (ref: string, bytes: Buffer, contentType: string) => Promise<void>;
  setMarkKind: (id: number, kind: MarkKind) => Promise<void>;
  mark: (bytes: Uint8Array, spec: MarkSpec) => Promise<Buffer>;
};

/**
 * Re-mark ONE row. Skips (returns 'unchanged') when it already carries the
 * desired mark. The public bytes are written BEFORE `mark_kind` is recorded, so
 * a crash between the two leaves a row that is re-marked again next run — never
 * a row that claims a mark its bytes do not carry.
 */
export async function remarkOne(
  row: OriginalRow,
  spec: Extract<MarkSpec, { kind: 'supplier' }>,
  deps: RemarkDeps,
): Promise<'remarked' | 'unchanged'> {
  const want = desiredMarkKind(spec);
  if (row.mark_kind === want) return 'unchanged';
  const clean = await deps.getBytes(row.original_ref);
  const marked = await deps.mark(clean, spec);
  await deps.putBytes(row.public_ref, marked, 'image/jpeg');
  await deps.setMarkKind(row.id, want);
  return 'remarked';
}
