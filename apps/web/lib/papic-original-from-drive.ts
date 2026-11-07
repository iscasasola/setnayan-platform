import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getEventDriveAccessToken } from '@/lib/drive-copy';
import type { DriveProvider } from '@/lib/drive-copy-core';
import { isDriveCopyConfirmed, type DriveArtifactRow } from '@/lib/papic-fullres-drop-core';

/**
 * 📸 THE PHOTO RULE — "Original quality, from your Google Drive" (owner 2026-11-03, DECISION_LOG "THE PHOTO RULE").
 *
 * After the 3 months, our R2 original is gone and Setnayan keeps the 720p copy. A HOST whose Drive still holds the
 * confirmed full-res copy (`drive_copy_artifacts`, the same confirmation the drop waits for) and is still connected
 * gets the ORIGINAL back from their own Drive when they press Download; anything else falls back to 720p.
 * Guests never reach this — the caller is host-only.
 *
 * Read-only on Drive: `files.get?alt=media` with the event's own grant (scope `drive.file`, so only files Setnayan
 * wrote). The copy table does not record WHICH of the two Drives holds a file, so the main Drive is asked first and
 * the overflow Drive second. Every failure answers null — never an error page instead of the 720p photo.
 */
const DRIVE_PROVIDERS: readonly DriveProvider[] = ['drive', 'drive_overflow'];

export type OriginalFromDrive = { bytes: Uint8Array; contentType: string };

export async function fetchOriginalFromHostDrive(
  eventId: string,
  r2ObjectKey: string,
): Promise<OriginalFromDrive | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('drive_copy_artifacts')
      .select('r2_object_key, drive_file_id, copied_high_res, mime_type')
      .eq('event_id', eventId)
      .eq('r2_object_key', r2ObjectKey)
      .not('drive_file_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('[supabase-error] lib/papic-original-from-drive.ts · drive_copy_artifacts', error);
      return null;
    }
    if (!data) return null;
    if (!isDriveCopyConfirmed(data as DriveArtifactRow)) return null;
    const fileId = String((data as { drive_file_id: string }).drive_file_id);

    for (const provider of DRIVE_PROVIDERS) {
      const token = await getEventDriveAccessToken(eventId, provider);
      if (!token) continue;
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
      );
      if (!res.ok) continue; // not on this Drive, deleted by the host, or the grant lost access
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength === 0) continue;
      const contentType =
        res.headers.get('content-type') || (data as { mime_type?: string | null }).mime_type || 'image/jpeg';
      return { bytes, contentType };
    }
    return null;
  } catch {
    return null;
  }
}
