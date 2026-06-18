'use client';

/**
 * AlaalaClipUploader — couple uploads short (≤ 5 s) video clips that play
 * inside the Alaala orb on their editorial page.
 *
 * Validates duration client-side before sending so we fail fast without a round
 * trip. The server also validates. Only mp4/webm/quicktime accepted.
 */

import { useRef, useState } from 'react';

type UploadedClip = {
  id: number;
  name: string;
  durationMs: number;
  previewUrl: string;
};

type Props = {
  eventId: string;
  initialClips?: UploadedClip[];
};

const MAX_DURATION_S = 5;
const MAX_BYTES = 50_000_000;
const ACCEPTED = 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov';

export function AlaalaClipUploader({ eventId, initialClips = [] }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [clips, setClips] = useState<UploadedClip[]>(initialClips);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function measureDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
        const ms = Math.round(v.duration * 1000);
        URL.revokeObjectURL(url);
        resolve(ms);
      };
      v.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read video metadata'));
      };
      v.src = url;
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);

    const next: UploadedClip[] = [];
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          setError(`"${file.name}" is too large (max 50 MB).`);
          setUploading(false);
          return;
        }

        let durationMs: number;
        try {
          durationMs = await measureDuration(file);
        } catch {
          setError(`Could not read "${file.name}". Make sure it's a valid video file.`);
          setUploading(false);
          return;
        }

        if (durationMs > MAX_DURATION_S * 1000 + 500) {
          setError(
            `"${file.name}" is ${(durationMs / 1000).toFixed(1)} s — clips must be ${MAX_DURATION_S} s or shorter. Trim it first.`,
          );
          setUploading(false);
          return;
        }

        const form = new FormData();
        form.append('file', file);
        form.append('event_id', eventId);
        form.append('duration_ms', String(durationMs));

        const res = await fetch('/api/alaala/upload-clip', { method: 'POST', body: form });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error === 'too_large'
            ? 'File too large (max 50 MB).'
            : body.error === 'invalid_duration'
            ? `Clip exceeds ${MAX_DURATION_S} s limit.`
            : body.error === 'uploads_unavailable'
            ? 'Uploads are temporarily unavailable. Try again shortly.'
            : 'Upload failed. Please try again.');
          setUploading(false);
          return;
        }

        const json = (await res.json()) as { clip_id: number };
        next.push({
          id: json.clip_id,
          name: file.name,
          durationMs,
          previewUrl: URL.createObjectURL(file),
        });
      }
    } catch {
      setError('Upload failed unexpectedly. Please try again.');
      setUploading(false);
      return;
    }

    setClips((prev) => [...prev, ...next]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeClip(id: number) {
    setClips((prev) => prev.filter((c) => c.id !== id));
    // TODO: call DELETE /api/alaala/upload-clip?id=... to remove from DB + R2
  }

  return (
    <div className="space-y-5">
      {/* ── Upload zone ──────────────────────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a clip for the Alaala orb"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? inputRef.current?.click() : undefined}
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-10 text-center transition-colors"
        style={{
          borderColor: 'color-mix(in srgb, var(--m-line) 70%, transparent)',
          background: 'color-mix(in srgb, var(--m-paper) 60%, transparent)',
        }}
      >
        <span aria-hidden style={{ fontSize: 28 }}>🎞</span>
        <div className="space-y-0.5">
          <p className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
            {uploading ? 'Uploading…' : 'Add a clip to your Alaala'}
          </p>
          <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
            MP4 · WebM · MOV · max 5 seconds · up to 50 MB
          </p>
        </div>
        {!uploading && (
          <span
            className="rounded-full px-4 py-1.5 text-xs font-medium"
            style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
          >
            Choose file
          </span>
        )}
        {uploading && (
          <span className="text-xs animate-pulse" style={{ color: 'var(--m-slate)' }}>
            Processing…
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <p
          role="alert"
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: 'color-mix(in srgb, #ef4444 8%, transparent)', color: '#ef4444' }}
        >
          {error}
        </p>
      )}

      {/* ── Clip list ─────────────────────────────────────────────────────── */}
      {clips.length > 0 && (
        <ul className="space-y-2">
          {clips.map((clip) => (
            <li
              key={clip.id}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: 'color-mix(in srgb, var(--m-paper) 80%, transparent)', border: '1px solid color-mix(in srgb, var(--m-line) 50%, transparent)' }}
            >
              {/* mini preview */}
              <video
                src={clip.previewUrl}
                muted
                playsInline
                loop
                onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                onMouseLeave={(e) => (e.currentTarget as HTMLVideoElement).pause()}
                className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
                style={{ background: 'var(--m-ink)' }}
              />
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-medium"
                  style={{ color: 'var(--m-ink)' }}
                >
                  {clip.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
                  {(clip.durationMs / 1000).toFixed(1)} s
                </p>
              </div>
              <button
                type="button"
                aria-label={`Remove ${clip.name}`}
                onClick={() => removeClip(clip.id)}
                className="flex-shrink-0 rounded-lg p-1.5 transition-colors hover:opacity-60"
                style={{ color: 'var(--m-slate)' }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {clips.length === 0 && !uploading && (
        <p className="text-xs text-center" style={{ color: 'var(--m-slate-2)' }}>
          Clips you upload here play inside the Alaala orb on your wedding page. Every clip is
          private until you publish your editorial.
        </p>
      )}
    </div>
  );
}
