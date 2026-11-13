'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Film, Loader2, UploadCloud } from 'lucide-react';
import { albumVideoCostWords, albumVideoCredits } from '@/lib/album-video-cost';
import { extractClipPosterBytes } from '@/lib/clip-poster';

/**
 * Import ONE finished photo into the private portfolio album, spending one
 * Papic credit. Posts straight to /api/vendor/papic-portfolio-import (its own
 * ingest lane, not the generic /api/upload presign route) because the credit
 * check + the DB row insert + the NSFW screen all happen server-side, in one
 * request, the same way every other Papic ingest surface works.
 *
 * Deliberately a plain file input rather than the shared <FileUpload> widget:
 * that widget presigns straight to R2 and hands back a ref with no server hop
 * in between, which is exactly the hop this feature needs (credit debit
 * before the object exists).
 *
 * 🎬 A VIDEO (owner 2026-11-13: the album holds photos AND videos; owner 2026-11-14: it costs "x3 of the video based
 * on their seconds as compared to papic" — `albumVideoCredits`). The video is too large for the import request, so
 * it goes to the shop's OWN album folder through /api/upload, and the import carries its screened still (the NSFW
 * screen reads stills — lib/clip-poster.ts). Its cost is SHOWN before anything uploads and confirmed by the supplier;
 * the server then measures the length itself and charges from the same formula, so the shown and charged cost agree.
 */
export function PortfolioImportForm({
  eventId,
  canImport,
  creditsLeft = null,
  vendorProfileId = null,
}: {
  eventId: string;
  canImport: boolean;
  /** null = unlimited; a number is what's left — a video that costs more is refused before it uploads. */
  creditsLeft?: number | null;
  /** The shop whose album folder a video uploads into. Absent = photos only. */
  vendorProfileId?: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ file: File; credits: number } | null>(null);

  async function post(form: FormData): Promise<void> {
    const res = await fetch('/api/vendor/papic-portfolio-import', {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
      setError(
        body?.error === 'out_of_credits'
          ? 'Out of Papic credits for this event.'
          : // 💾 Past the plan's storage, a video whose length could not be read, or a check that could not be made —
            // the server's own sentence (owner 2026-11-13).
            body?.message && (res.status === 413 || res.status === 503 || res.status === 422)
            ? body.message
            : 'Could not import that. Please try again.',
      );
    } else {
      // one-render: keep (fetch) — it follows a `fetch()` upload; no server action answered with a render.
      router.refresh();
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.set('event_id', eventId);
      form.set('file', file);
      await post(form);
    } catch {
      setError('Could not import that photo — check your connection and retry.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  /** Step 1 of a video: read its length here and SHOW what it costs. Nothing uploads yet. */
  async function onPickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (videoRef.current) videoRef.current.value = '';
    if (!file) return;
    setError(null);
    const ms = await videoLengthMs(file);
    const credits = albumVideoCredits(ms);
    if (credits === null) {
      setError('We couldn’t read how long that video is. Save it as an MP4 or MOV and try again.');
      return;
    }
    if (creditsLeft !== null && creditsLeft < credits) {
      setError(`This video needs ${albumVideoCostWords(credits)} and this event has ${albumVideoCostWords(creditsLeft)} left.`);
      return;
    }
    setPending({ file, credits });
  }

  /** Step 2, after the supplier confirmed the cost: upload the video, then import it with its still. */
  async function importVideo() {
    if (!pending || !vendorProfileId) return;
    const { file } = pending;
    setPending(null);
    setBusy(true);
    try {
      const still = await extractClipPosterBytes(new Uint8Array(await file.arrayBuffer()), file.type);
      if (!still) {
        setError('We couldn’t read a picture from that video. Save it as an MP4 or MOV and try again.');
        return;
      }
      const sign = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket: 'media',
          pathPrefix: `vendors/${vendorProfileId}/album/${eventId}`,
          filename: file.name || 'video.mp4',
          contentType: file.type || 'video/mp4',
          sizeBytes: file.size,
        }),
      });
      const signed = (await sign.json().catch(() => null)) as { uploadUrl?: string; r2Ref?: string; error?: string } | null;
      if (!sign.ok || !signed?.uploadUrl || !signed.r2Ref) {
        setError(signed?.error ?? 'Could not upload that video. Please try again.');
        return;
      }
      const put = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'video/mp4' }, body: file });
      if (!put.ok) {
        setError('Could not upload that video. Please try again.');
        return;
      }
      const form = new FormData();
      form.set('event_id', eventId);
      form.set('file', new File([new Uint8Array(still)], 'still.jpg', { type: 'image/jpeg' }));
      form.set('video_ref', signed.r2Ref);
      await post(form);
    } catch {
      setError('Could not import that video — check your connection and retry.');
    } finally {
      setBusy(false);
    }
  }

  if (!canImport) {
    return (
      <p className="mt-3 text-xs" style={{ color: 'var(--m-slate-3)' }}>
        Out of Papic credits for this event — buy more above to keep importing.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <label
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium"
          style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate-1)' }}
        >
          {busy ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
          ) : (
            <UploadCloud aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          )}
          {busy ? 'Importing…' : 'Import a photo · 1 credit'}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={onPick}
          />
        </label>
        {vendorProfileId ? (
          <label
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate-1)' }}
          >
            <Film aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Import a video
            <input
              ref={videoRef}
              type="file"
              accept="video/mp4,video/quicktime"
              className="sr-only"
              disabled={busy}
              onChange={onPickVideo}
            />
          </label>
        ) : null}
      </div>
      {pending ? (
        <div className="mt-2 rounded-lg px-3 py-2" style={{ background: 'var(--m-fill, rgba(0,0,0,0.03))' }} data-video-cost-confirm="">
          <p className="text-sm" style={{ color: 'var(--m-slate-1)' }}>
            Import this video · <b>{albumVideoCostWords(pending.credits)}</b>
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--m-slate-3)' }}>
            A video costs three times what Papic charges for the same seconds.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={importVideo}
              className="sn-press inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold"
              style={{ background: 'var(--m-slate-1)', color: 'var(--m-bg, #fff)' }}
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="sn-press inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold"
              style={{ color: 'var(--m-slate-1)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** How long a picked video runs, read by the browser from the file itself. Null when it cannot be read. */
function videoLengthMs(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    const done = (ms: number | null) => {
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) && v.duration > 0 ? v.duration * 1000 : null);
    v.onerror = () => done(null);
    v.src = url;
  });
}
