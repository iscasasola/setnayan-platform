/**
 * Presign + PUT one blob through a Papic CAMERA's own upload door (browser only).
 *
 * Lifted out of `add-to-library.tsx` (2026-10-03) so the couple's scrapbook page
 * saves through the SAME door rather than a copy of it: `/api/upload` presigns
 * from the seat token (the server derives where the object lands — the client
 * never chooses), and the caller then records it with `recordSeatCapture`,
 * which owns the credit metering, the safety screen and the derivatives.
 *
 * Returns the stored `r2://` ref. Throws an Error whose message is the server's
 * refusal code (`uploads_closed`, `too_fast`, …) or `upload_refused` /
 * `upload_failed`, which the caller turns into words.
 */
export async function putSeatUpload(token: string, blob: Blob, contentType: string, ext: string): Promise<string> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      papicSeatToken: token,
      filename: `upload-${Date.now()}.${ext}`,
      contentType,
      sizeBytes: blob.size,
    }),
  });
  if (!res.ok) {
    let code: string | undefined;
    try {
      ({ code } = (await res.json()) as { code?: string });
    } catch {
      /* non-JSON body */
    }
    throw new Error(code || 'upload_refused');
  }
  const { uploadUrl, r2Ref } = (await res.json()) as { uploadUrl?: string; r2Ref?: string };
  if (!uploadUrl || !r2Ref) throw new Error('upload_refused');
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!putRes.ok) throw new Error('upload_failed');
  return r2Ref;
}
