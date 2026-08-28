import { PAPIC_UPLOADS_CAMERA_INDEX } from '@/lib/papic-cameras';

/**
 * "MAY PHOTOS BE ADDED BY HAND?" — the DECISION, with no database attached.
 *
 * Split out of `papic-uploads-open.ts` (which is `server-only`, so it cannot be
 * imported by a test in this repo) for the same reason
 * `event-accepts-captures-rule.ts` was split out of its own IO wrapper: the part
 * worth testing is the direction each answer fails in, and that part is pure.
 *
 * ── THE THREE DECISIONS ─────────────────────────────────────────────────────
 *
 * 🔑 ONLY THE UPLOADS CAMERA IS GATED. The couple's file picker is not a
 * separate capture path — it presigns and records exactly like every camera in
 * the product. What distinguishes it is the SEAT it shoots on. That is a fact
 * about a row in the database rather than a claim the client makes, so the gate
 * already covers a surface nobody has written yet.
 *
 * ⛔ AND EVERY OTHER SEAT PASSES THROUGH UNTOUCHED. Turning this off must never
 * stop a paparazzo photographing a wedding — the OFF copy promises exactly
 * that: "Only what your cameras capture."
 *
 * ⚠ AN UNREADABLE SWITCH MEANS OPEN, matching the page's `?? true` and the
 * column's `DEFAULT TRUE`. The column lands in a migration; on a database that
 * predates it PostgREST refuses the query, and failing closed there would take
 * uploading away from every couple on the platform with no explanation and no
 * error. An upload costs a credit exactly like a shot, so an open door is not a
 * free one — the cost of failing open is bounded and the cost of failing closed
 * is not.
 */
export function manualUploadsClosedFrom(
  seatIndex: number | null | undefined,
  row: { papic_uploads_open?: boolean | null } | null | undefined,
  readFailed: boolean,
): boolean {
  if (seatIndex !== PAPIC_UPLOADS_CAMERA_INDEX) return false;
  if (readFailed || !row) return false;
  return (row.papic_uploads_open ?? true) === false;
}
