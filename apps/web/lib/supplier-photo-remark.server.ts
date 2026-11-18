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
 * 🛑 A SESSION RUNS THE DRY RUN ONLY. `scripts/remark-supplier-photos.ts
 * --dry-run` counts what is pending and changes nothing. Its `--apply` mode
 * (Build 6 Lane L) is refused unless `--confirm=` names the project the URL
 * points at — applying it against production is an owner decision (it rewrites
 * public bytes), not a session's. `remarkOne` is exported for that runner and
 * for the guard, which drives it with fakes.
 */
import type { MarkSpec } from './photo-mark-geometry';

/**
 * What a public copy carries:
 *   'setnayan' · 'verified'          the Seal and plate (2026-11-04) — a shop not verified / verified
 *   'row' · 'row-verified'           🔏 THE NEW SUPPLIER PHOTO MARK (owner-approved 2026-11-15: the bottom row, the QR on
 *                                    every shop) — not verified / verified (the shop's logo circle)
 * Only the two 'row' kinds are ever DESIRED now, so every photo still carrying the Seal and plate is pending and is
 * re-marked from its clean copy into the new mark — the 5892 re-mark path, no second mechanism.
 */
export type MarkKind = 'setnayan' | 'verified' | 'row' | 'row-verified';

export type OriginalRow = {
  id: number;
  vendor_profile_id: string;
  public_ref: string;
  original_ref: string;
  frame: unknown;
  mark_kind: MarkKind;
};

/** What the public copy SHOULD carry, from the shop's spec now — always the 2026-11-15 row. */
export function desiredMarkKind(spec: Extract<MarkSpec, { kind: 'supplier' }>): MarkKind {
  return spec.verified ? 'row-verified' : 'row';
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
