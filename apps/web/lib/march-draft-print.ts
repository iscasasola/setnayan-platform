/**
 * march-draft-print.ts — THE MAKER'S PAGE SHOWS THE DRAFTED WEDDING MARCH.
 *
 * ⚖ Owner 2026-10-07, DECISION_LOG "SIX BUILD QUESTIONS SETTLED" (3): *the
 * Maker's page preview shows the couple's unapplied Wedding March moves* — the
 * entourage scene reads the draft like the march editor does. Guests still read
 * the live order until Apply (`hostDraft` is null for every guest, so this
 * never runs for them).
 *
 * 🔑 +0 MECHANISMS. The march editor draws the live march with the drafted
 * steps laid on (`replayMarch`, `details-your-event-load.tsx`). This takes that
 * SAME replayed march and writes it back onto the printed rows the way the
 * shipped actions would: each walk a `march_walks` spot (walk number in march
 * order, place = its column), the "Not walking" tray marked, and the printed
 * section order. `buildEntourage` then prints them exactly as it prints the
 * live rows — one printer, so the canvas cannot draw a march the invitation
 * would not print.
 *
 * Pure: no I/O — `the-maker-page-shows-the-drafted-march.test.ts` drives it.
 */
import { marchSpotOf, type EntourageGuestRow, type MarchSpot } from './entourage';
import type { MarchShown } from './march-drag';

/** The printed rows as the replayed march leaves them, and the section order it prints in. */
export function printedRowsAsDrafted<R extends EntourageGuestRow>(
  rows: readonly R[],
  shown: Pick<MarchShown, 'sections' | 'printed' | 'out'>,
): { rows: R[]; sectionOrder: string[] } {
  /* A walk's two places as stored: the march DRAWS a walk across the aisle
     (`walkSideOf`), so its column is not always the stored place. Two people
     who still walk together keep the places they had; anyone else takes the
     column the march gives them. */
  const had = new Map<string, number>();
  for (const r of rows) {
    const s = r.guest_id ? marchSpotOf(r) : null;
    if (r.guest_id && s && typeof s.place_in_walk === 'number') had.set(r.guest_id, s.place_in_walk);
  }
  const spots = new Map<string, MarchSpot>();
  let walk = 0;
  for (const sec of shown.sections) {
    for (const row of sec.rows) {
      if (!row[0] && !row[1]) continue;
      walk += 1;
      const [a, b] = [row[0]?.id ?? '', row[1]?.id ?? ''];
      const keep = a && b && had.has(a) && had.has(b) && had.get(a) !== had.get(b);
      row.forEach((p, place) => {
        if (p?.id && !spots.has(p.id)) spots.set(p.id, { walk_no: walk, place_in_walk: keep ? had.get(p.id)! : place });
      });
    }
  }
  const out = new Set(shown.out.map((o) => o.id));
  return {
    rows: rows.map((r) => {
      const id = r.guest_id ?? '';
      if (!id) return r;
      const { not_walking: _was, ...rest } = r;
      return {
        ...rest,
        march: spots.get(id) ?? null,
        ...(out.has(id) ? { not_walking: true } : {}),
      } as R;
    }),
    sectionOrder: [...shown.printed],
  };
}
