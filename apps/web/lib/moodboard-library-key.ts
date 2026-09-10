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
