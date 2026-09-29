/**
 * apps/web/lib/upload-still.ts — a clip's still, uploaded beside the clip.
 *
 * Browser-only (it `fetch`es `/api/upload`, the SAME presign route `<FileUpload>`
 * uses, then PUTs the bytes). Shared by the Main background
 * (`main-background-panel.tsx`) and a scene's own clip
 * (`scene-background-row.tsx`) — one helper, so the two cannot drift.
 */

/**
 * Upload a clip's still through the same presign route `<FileUpload>` uses —
 * into this event's Main-background folder, or (a scene's own clip,
 * `scene-background-row.tsx`) the folder named.
 */
export async function uploadStill(blob: Blob, eventId: string, folder = 'main-background'): Promise<string | null> {
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bucket: 'media',
        pathPrefix: `events/${eventId}/${folder}`,
        filename: 'still.jpg',
        contentType: 'image/jpeg',
        sizeBytes: blob.size,
      }),
    });
    const data = (await res.json()) as { uploadUrl: string; r2Ref: string } | { error: string };
    if (!res.ok || 'error' in data) return null;
    const put = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
    return put.ok ? data.r2Ref : null;
  } catch {
    return null;
  }
}

