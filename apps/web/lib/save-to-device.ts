// "Save to phone" — get a Papic photo/video onto the guest's or couple's device.
//
// On mobile the clean path is the Web Share API with a file: navigator.share
// opens the native share sheet, where the user taps "Save to Photos" (iOS) /
// "Save image" (Android) → it lands in the camera roll. Browsers can't write to
// the gallery silently (a security boundary), so the share sheet is as close to
// "1-tap save" as the web allows. Where file-sharing isn't supported (older
// browsers, most desktop), we fall back to a plain download (lands in Files /
// Downloads). Feature-detected per-file via navigator.canShare({ files }).

/** True when the browser can share an actual file (→ native "Save to Photos"). */
export function canShareFiles(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  );
}

export type SaveResult = 'shared' | 'downloaded' | 'failed';

/**
 * Fetch a (presigned) image/clip URL and hand it to the OS to save. Prefers the
 * native share sheet ("Save to Photos"); falls back to a download. Best-effort —
 * returns 'failed' rather than throwing. A user cancelling the share sheet counts
 * as success (they saw the option), not a failure.
 */
export async function saveImageToDevice(url: string, filename: string): Promise<SaveResult> {
  try {
    const res = await fetch(url);
    if (!res.ok) return 'failed';
    const blob = await res.blob();
    const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });

    if (canShareFiles() && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return 'shared';
      } catch (e) {
        // User dismissed the share sheet — not a failure; don't double-prompt.
        if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
        // Anything else → fall through to the download fallback.
      }
    }

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

/** File extension for a fetched media blob, so a saved file is labelled right
 *  (a Papic clip is webm on Chrome/Firefox, mp4 on Safari — the container the
 *  recorder picked, not a fixed guess). */
function extForType(type: string): string {
  if (type.includes('webm')) return 'webm';
  if (type.includes('quicktime')) return 'mov';
  if (type.includes('mp4')) return 'mp4';
  if (type.includes('png')) return 'png';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  return 'mp4'; // clips default — the only caller saves video
}

/**
 * Save a media URL (e.g. a presigned R2 video) to the device. Like
 * saveImageToDevice, but derives the file extension from the fetched blob's
 * content type — and crucially fetches→blob→object-URL so the download works for
 * a CROSS-ORIGIN presigned URL (a bare `<a download href={r2Url}>` is ignored by
 * browsers cross-origin and just opens the file). `baseName` excludes the
 * extension. Best-effort; never throws.
 */
export async function saveMediaToDevice(url: string, baseName: string): Promise<SaveResult> {
  try {
    const res = await fetch(url);
    if (!res.ok) return 'failed';
    const blob = await res.blob();
    const filename = `${baseName}.${extForType(blob.type)}`;
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });

    if (canShareFiles() && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return 'shared';
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
        // else fall through to download
      }
    }

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
