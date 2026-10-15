/**
 * PUT THIS PHOTO ON MY PAGE — one tap from a photo in the supplier's private album (owner 2026-10-15, DECISION_LOG
 * "SIX OWNER ANSWERS" (3): "supplier photo-to-page yes").
 *
 * 🔑 THE PAGE GALLERY IS PINNED TO THE SHOP'S OWN FOLDER. `vendor_profiles.portfolio_r2_keys` is published by the
 * PUBLIC page through the generic signer, so every stored ref must sit under `vendors/{thisShop}/` in the media bucket
 * (SEC-1, `vendorOwnedMediaPolicy`). An album photo lives in its own private lane
 * (`papic/vendor-{id}/portfolio/{eventId}/{uuid}.jpg`), so the tap COPIES the object into the shop's folder and adds
 * THAT ref — the album keeps its private copy, the page gets its own.
 *
 * 🔑 ONLY THE SHOP'S OWN ALBUM LANE IS A SOURCE. A key outside `papic/vendor-{thisShop}/portfolio/` is refused here, so
 * a posted id can never copy a stranger's file onto this shop's page.
 *
 * Pure: the action and its guard share it.
 */

export const PAGE_PHOTO_FROM_ALBUM_DIR = 'portfolio/from-album';

/** The album lane a shop's own imported photos live under. */
export function albumLaneOf(vendorProfileId: string): string {
  return `papic/vendor-${vendorProfileId}/portfolio/`;
}

/**
 * The page-gallery key for an album photo — inside `vendors/{shop}/`, named from the album key so the SAME photo always
 * maps to the SAME page key (a second tap is "already on your page", never a second copy). `null` = not this shop's
 * album photo.
 */
export function pagePhotoKeyFor(vendorProfileId: string, albumKey: string): string | null {
  const lane = albumLaneOf(vendorProfileId);
  if (!vendorProfileId || !albumKey.startsWith(lane)) return null;
  const rest = albumKey.slice(lane.length);
  if (!rest || rest.includes('..') || /[\u0000-\u001f]/.test(rest)) return null;
  return `vendors/${vendorProfileId}/${PAGE_PHOTO_FROM_ALBUM_DIR}/${rest.replace(/\//g, '-')}`;
}

export type AddToPage =
  | { kind: 'added'; refs: string[] }
  | { kind: 'already' }
  /** The plan's photo cap is reached — nothing is dropped to make room. */
  | { kind: 'full'; max: number };

/** Append one ref to the page gallery, honouring the plan's photo cap (Infinity = no cap). */
export function addToPageGallery(current: readonly string[], ref: string, max: number): AddToPage {
  const refs = current.filter(Boolean);
  if (refs.includes(ref)) return { kind: 'already' };
  if (refs.length >= max) return { kind: 'full', max };
  return { kind: 'added', refs: [...refs, ref] };
}
