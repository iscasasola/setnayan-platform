import { creditLine } from '@/lib/capture-credit-pure';

/**
 * THE CREDIT ON A TILE — "Ninang Cora · 4:12 PM".
 *
 * Gallery archetype § 2, designer's note: *"Credit is a feature. Every tile
 * names its camera, because in a samahan album, who shot it is part of the
 * memory."*
 *
 * 🔑 RENDERS NOTHING WHEN WE DO NOT KNOW. Not "Unknown", not "A guest" — the
 * photograph simply keeps the whole tile. That is the state of every photograph
 * in production today (measured 2026-08-27: 14 of 14 carry a capturer id and 0
 * of them resolve to a name), so this branch is the one that actually ships.
 *
 * ⚠ `pointer-events-none` is load-bearing, not styling: this sits over the
 * bottom third of a tile whose whole surface opens the lightbox. Without it the
 * credit swallows the tap on exactly the frames that have one.
 */
export function GalleryCredit({
  name,
  capturedAt,
  timeZone,
  clearsCorners = false,
  raised = false,
}: {
  name?: string | null;
  capturedAt?: string | null;
  /** The VENUE's zone. Absent ⇒ the time half is dropped, never guessed. */
  timeZone?: string | null;
  /**
   * The couple's grid keeps two small state dots in the tile's bottom corners
   * (which tagged it, how many stories it carries). Set this there so the credit
   * starts clear of them instead of running underneath.
   */
  clearsCorners?: boolean;
  /**
   * Lift the credit clear of a full-width control pinned to the tile's bottom
   * edge — the shipped one-tap "Save" bar.
   *
   * 🪤 WITHOUT THIS THE CREDIT IS INVISIBLE ON EXACTLY THE TILES THAT HAVE ONE.
   * Both the day-of wall and the couple's photographs pin a 44px save bar to
   * `inset-x-0 bottom-0`, which is the same strip the archetype puts the credit
   * in. The archetype's own tile has no save bar — it saves from the lightbox —
   * so the collision is ours, not the drawing's, and the fix is to move OUR
   * addition rather than to delete a control people use.
   */
  raised?: boolean;
}) {
  const line = creditLine(name, capturedAt, timeZone);
  if (!line) return null;
  return (
    <div className={`sn-gal-credit ${raised ? 'sn-gal-credit-raised' : ''}`}>
      <span
        className={`block truncate font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] ${
          clearsCorners ? 'px-3' : ''
        }`}
      >
        {line}
      </span>
    </div>
  );
}
