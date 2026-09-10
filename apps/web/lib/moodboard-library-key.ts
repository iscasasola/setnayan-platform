/**
 * moodboard-library-key.ts — WHICH STORAGE OBJECT A STYLIST'S "DELETE" MAY REMOVE.
 *
 * Pure, so it is a real unit test. Same class as lib/cleanup-delete-scope.ts,
 * different store: the mood-board library lives in the Supabase storage bucket
 * `moodboard-library`, not R2.
 *
 * `deleteStylistAsset` removes the row and then the object named by the row's
 * `storage_path`, with the ADMIN client. `authenticated` holds column UPDATE on
 * `moodboard_library_assets.storage_path` and the owner's update policy says
 * only "this row is yours" — so a stylist could re-point their own row at
 * another stylist's image and delete it by deleting their own asset. The upload
 * action files every stylist upload at `moodboard-library/<uploader user id>/…`,
 * so the object must sit in the uploader's own folder or it is not removed.
 */
const BUCKET = 'moodboard-library';

/** C0 controls, DEL and backslash — no legitimate producer emits any of them. */
const HOSTILE = /[\u0000-\u001f\u007f\\]/;

/**
 * The object key to remove for a stylist-owned row, or null when the stored
 * path is not inside that uploader's own folder (kept — never guessed at).
 */
export function stylistAssetObjectKey(storagePath: unknown, uploadedBy: unknown): string | null {
  if (typeof storagePath !== 'string' || typeof uploadedBy !== 'string') return null;
  const uploader = uploadedBy.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(uploader)) return null;
  const prefix = `${BUCKET}/${uploader}/`;
  if (!storagePath.startsWith(prefix) || storagePath.length <= prefix.length) return null;
  const key = storagePath.slice(`${BUCKET}/`.length);
  if (HOSTILE.test(key)) return null;
  for (const segment of key.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') return null;
  }
  return key;
}

/**
 * The object key an ADMIN's delete of a library asset may remove (2026-09-10).
 *
 * The admin screen can delete any asset, including a stylist's — and it used to
 * read `storage_path` back verbatim, so a stylist who re-pointed their own row
 * at another stylist's image (or at one of our own placeholders) could get it
 * removed the moment an admin cleared their asset. Two shapes are legitimate:
 *
 *   • a stylist upload — `moodboard-library/<uploader user id>/…`, held to that
 *     uploader's own folder exactly as `stylistAssetObjectKey` holds it;
 *   • an admin upload — `moodboard-library/<random uuid>.<ext>` at the bucket
 *     root, minted by the admin action. Admitted ONLY when the row's uploader is
 *     not a vendor account: a vendor cannot change `uploaded_by` (their update
 *     policy's WITH CHECK pins it to themselves), so a stylist's row can never
 *     reach a root object.
 *
 * `uploaderIsVendor` must come from the uploader's own account row; pass `true`
 * when it could not be read — fail closed, towards keeping the file.
 */
const ROOT_ADMIN_OBJECT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp|avif)$/i;

export function libraryAssetObjectKeyForAdminDelete(
  storagePath: unknown,
  uploadedBy: unknown,
  uploaderIsVendor: boolean,
): string | null {
  const own = stylistAssetObjectKey(storagePath, uploadedBy);
  if (own) return own;
  if (uploaderIsVendor || typeof storagePath !== 'string') return null;
  const prefix = `${BUCKET}/`;
  if (!storagePath.startsWith(prefix)) return null;
  const key = storagePath.slice(prefix.length);
  return ROOT_ADMIN_OBJECT.test(key) ? key : null;
}
