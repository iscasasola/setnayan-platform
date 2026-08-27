'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, Loader2, Check, AlertCircle } from 'lucide-react';
import { recordSeatCapture } from '@/app/papic/actions';

/**
 * ADD TO YOUR LIBRARY — the shutter that is a file picker.
 *
 * Owner 2026-08-26: *"papic is the source where they collect media files for
 * that event"*, *"they can upload their work via papic credits as well per
 * event"*, and an uploaded photo takes *"the same spot as 1 papic photo"*.
 *
 * 🔑 THIS IS NOT A NEW CAPTURE PATH. It presigns through the SAME `/api/upload`
 * seat route and records through the SAME `recordSeatCapture` that every camera
 * in the product uses — so it inherits the credit metering, the per-camera burst
 * limiter, the server-side clip cap, the always-on safety screen, the
 * derivatives and the Drive copy without a line of any of them being rewritten.
 * The server derives the storage location from the seat token; the client never
 * chooses where anything lands.
 *
 * ⚠ THE CLIP LENGTH IS MEASURED HERE AND REFUSED HERE, NOT TRUNCATED.
 * `papicClipCost` bills an absent or nonsense duration at the TOP band — the
 * only direction a tampered client cannot profit from — so passing an
 * unmeasured clip through would silently overcharge a couple for their own
 * upload. A file over the cap is rejected in the picker, by name, before
 * anything is presigned and before a single credit is reserved.
 *
 * ⚠ A CLIP WITHOUT A POSTER IS NEVER SCREENED. The safety screen reads a clip
 * through its poster frame; a posterless clip stays `unscreened` forever, which
 * excludes it from every guest surface silently. So the poster is extracted
 * here, from the first frame, and a clip whose poster cannot be produced is
 * refused rather than uploaded into permanent limbo.
 */

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 48 * 1024 * 1024;
/** The owner-locked 10s cap, with the same tolerance the server allows. */
const MAX_CLIP_MS = 10_500;

type Row = {
  id: string;
  name: string;
  state: 'waiting' | 'working' | 'done' | 'refused';
  detail?: string;
};

function ext(type: string): string {
  if (type.includes('png')) return 'png';
  if (type.includes('webm')) return 'webm';
  if (type.includes('quicktime') || type.includes('mov')) return 'mov';
  if (type.includes('mp4')) return 'mp4';
  return 'jpg';
}

/** Measure a video and grab its first frame. Null if the browser cannot decode it. */
async function probeVideo(
  file: File,
): Promise<{ durationMs: number; poster: Blob } | null> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    await new Promise<void>((resolve, reject) => {
      v.onloadeddata = () => resolve();
      v.onerror = () => reject(new Error('decode'));
      setTimeout(() => reject(new Error('timeout')), 15_000);
    });
    const durationMs = Number.isFinite(v.duration) ? Math.round(v.duration * 1000) : NaN;
    if (!Number.isFinite(durationMs)) return null;
    // Seek a hair in: frame 0 is often black on a phone recording.
    v.currentTime = Math.min(0.1, Math.max(0, v.duration / 10));
    await new Promise<void>((resolve) => {
      v.onseeked = () => resolve();
      setTimeout(resolve, 2000);
    });
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    if (!canvas.width || !canvas.height) return null;
    canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height);
    const poster = await new Promise<Blob | null>((r) =>
      canvas.toBlob((b) => r(b), 'image/jpeg', 0.85),
    );
    if (!poster) return null;
    return { durationMs, poster };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AddToLibrary({ token }: { token: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = useCallback((id: string, next: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));
  }, []);

  /** Presign + PUT one blob; returns the stored r2:// ref. */
  const put = useCallback(
    async (blob: Blob, contentType: string, e: string): Promise<string> => {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          papicSeatToken: token,
          filename: `upload-${Date.now()}.${e}`,
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
    },
    [token],
  );

  const onPick = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const stamp = Date.now();
      const picked = Array.from(files).map((file, i) => ({ file, id: `${stamp}-${i}` }));
      setRows(picked.map(({ file, id }) => ({ id, name: file.name, state: 'waiting' as const })));
      setBusy(true);

      // ⚠ ONE AT A TIME, DELIBERATELY. The per-camera burst limiter exists to
      // stop a stuck loop emptying the pot, and twenty simultaneous presigns are
      // indistinguishable from one. Serial also means a refusal is visible
      // before the next file spends anything.
      for (const { file, id } of picked) {
        // ⚠ KEYED ON THE ROW ID, NEVER THE FILENAME. Somebody uploading a
        // folder of `IMG_0001.jpg` from two cameras would otherwise watch one
        // row's outcome overwrite the other's.
        const set = (next: Partial<Row>) => patch(id, next);

        set({ state: 'working' });
        const isVideo = file.type.startsWith('video/');
        const cap = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

        if (!isVideo && !file.type.startsWith('image/')) {
          set({ state: 'refused', detail: 'Only photos and video clips can go in your library.' });
          continue;
        }
        if (file.size > cap) {
          set({
            state: 'refused',
            detail: `Too large — ${isVideo ? 'clips' : 'photos'} can be up to ${Math.round(cap / 1024 / 1024)} MB.`,
          });
          continue;
        }

        try {
          if (isVideo) {
            const probe = await probeVideo(file);
            if (!probe) {
              set({
                state: 'refused',
                detail: 'This clip could not be read in your browser — try converting it first.',
              });
              continue;
            }
            if (probe.durationMs > MAX_CLIP_MS) {
              set({
                state: 'refused',
                detail: `This clip is ${Math.round(probe.durationMs / 1000)} seconds — Papic clips are 10 seconds or less.`,
              });
              continue;
            }
            // The poster goes up FIRST: a clip whose poster failed would be
            // recorded unscreenable, and unscreened media is excluded from
            // every guest surface silently and forever.
            const posterRef = await put(probe.poster, 'image/jpeg', 'jpg');
            const clipRef = await put(file, file.type, ext(file.type));
            const res = await recordSeatCapture(token, clipRef, 'clip', posterRef, probe.durationMs);
            if (!res.ok) {
              set({ state: 'refused', detail: readable(res.error) });
              continue;
            }
          } else {
            const ref = await put(file, file.type, ext(file.type));
            const res = await recordSeatCapture(token, ref, 'photo');
            if (!res.ok) {
              set({ state: 'refused', detail: readable(res.error) });
              continue;
            }
          }
          set({ state: 'done' });
        } catch (e) {
          set({ state: 'refused', detail: readable(e instanceof Error ? e.message : undefined) });
        }
      }

      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    },
    [put, token, patch],
  );

  return (
    <div className="space-y-3">
      <p className="max-w-prose text-sm text-ink/65">
        From your phone or laptop. Older memories are welcome — the engagement
        shoot, childhood photos, the proposal clip. Each photo uses one credit,
        a clip two to eight depending on its length: the same as a camera shot.
      </p>

      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-ink/20 bg-cream/50 px-4 py-8 text-center hover:border-ink/35">
        <Upload aria-hidden className="h-5 w-5 text-ink/45" strokeWidth={1.75} />
        <span className="text-sm font-medium text-ink">
          {busy ? 'Adding…' : 'Choose photos or clips'}
        </span>
        <span className="text-xs text-ink/55">Clips up to 10 seconds</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="sr-only"
          disabled={busy}
          onChange={(e) => void onPick(e.target.files)}
        />
      </label>

      {rows.length > 0 ? (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-xs">
              {r.state === 'done' ? (
                <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-700" strokeWidth={2} />
              ) : r.state === 'refused' ? (
                <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger-700" strokeWidth={2} />
              ) : (
                <Loader2 aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-ink/40" strokeWidth={2} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ink/80">{r.name}</span>
                {r.detail ? <span className="block text-ink/55">{r.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * A refusal in words a person can act on.
 *
 * ⚠ EVERY BRANCH NAMES SOMETHING THE READER CAN DO. "out_of_points" as-is sends
 * somebody to support; "you're out of credits" sends them to the ladder two
 * cards down. A refusal that misdescribes itself sends people to fix the wrong
 * thing — the same failure the supplier camera's "Photos only on Papic Lite"
 * hint made when video moved onto the allowance.
 */
function readable(code: string | undefined): string {
  switch (code) {
    case 'out_of_points':
    case 'pool_exhausted':
      return 'You’re out of credits — add more below and this will go straight in.';
    case 'capture_not_started':
      return 'Your camera dates haven’t started yet.';
    case 'capture_window_closed':
      return 'Your camera dates have finished.';
    case 'clip_too_long':
      return 'That clip is longer than 10 seconds.';
    // The switch is now read on the SERVER too, so this refusal is reachable —
    // a stale page, a second tab, or a call that never went near the button. It
    // names the control, which is on this same screen.
    case 'uploads_closed':
      return 'Adding photos by hand is switched off — turn it back on above.';
    case 'too_fast':
      return 'Slow down a moment and try that one again.';
    case 'unauthenticated':
      return 'You’ve been signed out — sign in and try again.';
    case 'upload_failed':
    case 'upload_refused':
      return 'That file didn’t upload — check your connection and try again.';
    default:
      return 'That one didn’t go in. Try again in a moment.';
  }
}
