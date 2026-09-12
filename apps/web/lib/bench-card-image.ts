/**
 * bench-card-image — the picture on a search card: the matching service card's
 * COVER, then the shop's logo, then (null → the caller draws initials). The
 * same ladder the saved card on the bench already uses
 * (`service_primary_photo_url → marketplace_logo_url → initials`, see
 * lib/shortlist-taxonomy.ts), so a supplier looks the same before and after the
 * couple saves them. Owner's test round 1, 2026-09-11: the "More in Live Band"
 * card drew the "SL" monogram for a shop with no logo whose Live Band card has
 * a cover — the recommendations read resolved that cover and the bench search
 * dropped it.
 */
export function benchCardImage(v: { photoUrl?: string | null; logoUrl?: string | null }): string | null {
  const photo = v.photoUrl?.trim();
  if (photo) return photo;
  const logo = v.logoUrl?.trim();
  return logo ? logo : null;
}
