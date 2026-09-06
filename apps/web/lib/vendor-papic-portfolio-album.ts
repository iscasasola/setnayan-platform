/**
 * A SUPPLIER'S PRIVATE PORTFOLIO ALBUM — imported work, paid for out of their
 * own Papic credits, for THEIR business page. Never the couple's, never the
 * host's — the opposite direction from `lib/vendor-own-captures.ts`, which is
 * the vendor looking back at shots taken of somebody ELSE's wedding.
 *
 * Photo-only by construction (no `media_type` column at all): the owner's
 * video threshold (`VENDOR_PAPIC_VIDEO_CREDITS`, lib/vendor-papic-tier.ts)
 * governs the on-the-day CAMERA, and this module has no camera — it is an
 * import lane for finished photographs the supplier already has. Keeping
 * video out of it means a re-price of that threshold never has to reason
 * about a second surface that could also unlock video.
 *
 * Pure, so the visibility rule is testable without a database — same posture
 * as vendor-own-captures.ts.
 */

export type PortfolioPhoto = {
  photoId: string;
  eventId: string;
  r2Key: string;
  creditsSpent: number;
  importedAt: string | null;
};

type Row = {
  photo_id: string;
  event_id: string;
  r2_object_key: string | null;
  credits_spent: number | null;
  created_at: string | null;
  hidden_at: string | null;
  nsfw_checked: boolean | null;
};

/**
 * Shape raw rows into what the album grid needs, dropping anything not fit to
 * show. Mirrors `visibleVendorCaptures`: an unscreened or taken-down row is
 * excluded, never rendered in a "pending" state.
 */
export function visiblePortfolioPhotos(rows: ReadonlyArray<Row>): PortfolioPhoto[] {
  const out: PortfolioPhoto[] = [];
  for (const r of rows) {
    if (r.hidden_at) continue;
    if (r.nsfw_checked !== true) continue;
    if (!r.r2_object_key) continue;
    out.push({
      photoId: r.photo_id,
      eventId: r.event_id,
      r2Key: r.r2_object_key,
      creditsSpent: Math.max(1, Math.floor(Number(r.credits_spent)) || 1),
      importedAt: r.created_at,
    });
  }
  return out;
}

/** The one-line summary above the album grid. Counts what is SHOWN, never the raw rows. */
export function portfolioAlbumSummary(photos: ReadonlyArray<PortfolioPhoto>): string {
  if (photos.length === 0) return 'Nothing imported yet.';
  return `${photos.length} photo${photos.length === 1 ? '' : 's'}`;
}

/**
 * Credits already spent importing photos for this (vendor, event).
 *
 * A `hidden_at` row (NSFW-blocked, or the supplier's own takedown) does NOT
 * count — mirrors `fetchVendorPapicPointsSpent` in lib/vendor-papic-grants.ts,
 * which filters `.is('hidden_at', null)` before summing capture points. Both
 * spend readers feed the SAME "left" total (G2: "ONE meter"), so a hidden
 * capture and a hidden import must agree on whether it still counts.
 */
export function portfolioCreditsSpent(rows: ReadonlyArray<{ credits_spent: number | null; hidden_at: string | null }>): number {
  let total = 0;
  for (const r of rows) {
    if (r.hidden_at) continue;
    total += Math.max(1, Math.floor(Number(r.credits_spent)) || 1);
  }
  return total;
}
