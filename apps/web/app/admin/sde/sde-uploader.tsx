'use client';

/**
 * Admin SDE film uploader (one per event on /admin/sde).
 *
 * Flow:
 *   1. Admin picks the finished MP4 (and optionally a poster image).
 *   2. We upload the file(s) direct-to-R2 via a presigned PUT (/api/upload).
 *   3. We persist the object keys via saveSdeFilm — which AUTO-PUBLISHES the
 *      film (stamps sde_published_at), so it shows on the couple's day-of page
 *      + recap immediately. No separate publish toggle (owner rule: a paid
 *      feature auto-shows the moment it exists).
 *
 * Mirrors the hero-video uploader's presign→PUT helper, minus the frame
 * extraction — the SDE film is served as a real <video>, not a scroll-scrub.
 */

import { useState, type ChangeEvent } from 'react';
import { saveSdeFilm } from './actions';

type Phase = 'idle' | 'uploading-video' | 'uploading-poster' | 'saving' | 'done' | 'error';

async function presignAndPut(
  body: Blob,
  pathPrefix: string,
  filename: string,
  contentType: string,
): Promise<string> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket: 'media', pathPrefix, filename, contentType, sizeBytes: body.size }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || `Upload failed (${res.status})`);
  }
  const { uploadUrl, r2Key } = (await res.json()) as { uploadUrl: string; r2Key: string };
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body });
  if (!put.ok) throw new Error(`Storage PUT failed (${put.status})`);
  return r2Key;
}

export function SdeUploader({
  eventId,
  initialFilmUrl,
}: {
  eventId: string;
  initialFilmUrl: string | null;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [filmUrl, setFilmUrl] = useState<string | null>(initialFilmUrl);
  const [poster, setPoster] = useState<File | null>(null);

  const working =
    phase === 'uploading-video' || phase === 'uploading-poster' || phase === 'saving';

  async function onPickVideo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      const prefix = `sde/${eventId}`;

      setPhase('uploading-video');
      const videoKey = await presignAndPut(
        file,
        prefix,
        file.name || 'sde.mp4',
        file.type || 'video/mp4',
      );

      let posterKey: string | null = null;
      if (poster) {
        setPhase('uploading-poster');
        posterKey = await presignAndPut(
          poster,
          prefix,
          poster.name || 'sde-poster.jpg',
          poster.type || 'image/jpeg',
        );
      }

      setPhase('saving');
      const result = await saveSdeFilm({ eventId, videoKey, posterKey });
      if (!result.ok) throw new Error(result.error);

      // Show the freshly uploaded clip via its object URL (the persisted ref is
      // presigned server-side on the next page load).
      setFilmUrl(URL.createObjectURL(file));
      setPhase('done');
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <div className="space-y-3">
      {filmUrl ? (
        <div className="overflow-hidden rounded-xl border border-ink/10 bg-ink/5">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- crew-delivered keepsake film, no caption track */}
          <video src={filmUrl} controls playsInline preload="metadata" className="max-h-72 w-full" />
        </div>
      ) : null}

      <label className="flex flex-col gap-1.5 text-xs text-ink/55">
        Poster frame (optional)
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={working}
          onChange={(e) => setPoster(e.target.files?.[0] ?? null)}
          className="text-xs text-ink/70 file:mr-3 file:rounded-md file:border-0 file:bg-ink/5 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink/70"
        />
      </label>

      <label
        className="block cursor-pointer rounded-xl border-2 border-dashed border-ink/15 px-5 py-6 text-center transition-colors hover:border-mulberry"
        style={{ opacity: working ? 0.6 : 1, pointerEvents: working ? 'none' : 'auto' }}
      >
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={onPickVideo}
          disabled={working}
        />
        <div className="text-sm font-medium text-ink">
          {working
            ? phase === 'uploading-video'
              ? 'Uploading film…'
              : phase === 'uploading-poster'
                ? 'Uploading poster…'
                : 'Saving…'
            : filmUrl
              ? 'Replace the film'
              : 'Upload the Same-Day Edit film'}
        </div>
        <div className="mt-1 text-xs text-ink/55">MP4 / WebM / MOV · up to 200 MB</div>
      </label>

      {phase === 'done' ? (
        <p className="text-xs text-[#2f7d4f]">Delivered — it&rsquo;s live on their day-of page and recap now.</p>
      ) : null}
      {error ? <p className="text-xs text-[#b4252f]">{error}</p> : null}
    </div>
  );
}
