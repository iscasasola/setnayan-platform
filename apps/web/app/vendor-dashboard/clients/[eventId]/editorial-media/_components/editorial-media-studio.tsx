'use client';

// ============================================================================
// Editorial media studio (iteration 0046, Inc 2) — the recommended vendor adds
// up to 3 photos + 3 five-second clips for the couple's editorial. Photos
// upload directly; clips are trimmed to ≤5s and baked into a forward+reverse
// boomerang IN THE BROWSER (same encoder as the couple's Living Hero), so the
// editorial rule "every clip is a boomerang" holds at ingest. No server video
// pipeline.
// ============================================================================

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Film, Trash2, Loader2 } from 'lucide-react';
import {
  bakeBoomerang,
  boomerangSupported,
  EncoderUnsupportedError,
  MAX_CLIP_SECONDS,
} from '@/lib/boomerang-encoder';
import { submitVendorEditorialMedia, deleteVendorEditorialMedia } from '../actions';
import { MAX_PER_TYPE, type SubmitMediaItem } from '@/lib/editorial-vendor-media';

export type ExistingMedia = {
  mediaId: string;
  type: 'photo' | 'clip';
  stillUrl: string;
  boomerangUrl: string | null;
  caption: string | null;
  moderationState: string;
  hiddenByCouple: boolean;
};

type Staged = {
  key: string;
  type: 'photo' | 'clip';
  stillRef: string;
  boomerangRef: string | null;
  previewUrl: string;
  caption: string;
};

// POST to /api/upload → presigned PUT → returns the r2://bucket/key ref.
async function presignAndPut(body: Blob, filename: string): Promise<string> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucket: 'media',
      pathPrefix: 'editorial-vendor',
      filename,
      contentType: body.type,
      sizeBytes: body.size,
    }),
  });
  if (!res.ok) throw new Error((await res.json())?.error || `Upload failed (${res.status})`);
  const { uploadUrl, r2Ref } = (await res.json()) as { uploadUrl: string; r2Ref: string };
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': body.type }, body });
  if (!put.ok) throw new Error(`Storage upload failed (${put.status})`);
  return r2Ref;
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      resolve(Number.isFinite(v.duration) ? v.duration : MAX_CLIP_SECONDS);
      URL.revokeObjectURL(v.src);
    };
    v.onerror = () => resolve(MAX_CLIP_SECONDS);
    v.src = URL.createObjectURL(file);
  });
}

function StatusBadge({ m }: { m: ExistingMedia }) {
  const [label, cls] = m.hiddenByCouple
    ? ['Hidden by couple', 'bg-ink/5 text-ink/55']
    : m.moderationState === 'clean'
      ? ['Live on editorial', 'bg-emerald-100 text-emerald-900']
      : m.moderationState === 'unscreened'
        ? ['Checking…', 'bg-amber-100 text-amber-900']
        : ['Removed', 'bg-red-100 text-red-900'];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

export function EditorialMediaStudio({
  eventId,
  existing,
}: {
  eventId: string;
  existing: ExistingMedia[];
}) {
  const router = useRouter();
  const [staged, setStaged] = useState<Staged[]>([]);
  const [busy, setBusy] = useState<null | string>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const photoInput = useRef<HTMLInputElement | null>(null);
  const clipInput = useRef<HTMLInputElement | null>(null);

  const existingPhotos = existing.filter((m) => m.type === 'photo').length;
  const existingClips = existing.filter((m) => m.type === 'clip').length;
  const stagedPhotos = staged.filter((s) => s.type === 'photo').length;
  const stagedClips = staged.filter((s) => s.type === 'clip').length;
  const photoRoom = MAX_PER_TYPE - existingPhotos - stagedPhotos;
  const clipRoom = MAX_PER_TYPE - existingClips - stagedClips;

  const supported = typeof window !== 'undefined' ? boomerangSupported() : true;

  const onPickPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, photoRoom);
    e.target.value = '';
    if (!files.length) return;
    setError(null);
    for (const f of files) {
      setBusy(`Uploading ${f.name}…`);
      try {
        const stillRef = await presignAndPut(f, 'photo.jpg');
        setStaged((s) => [
          ...s,
          { key: `${Date.now()}-${Math.random()}`, type: 'photo', stillRef, boomerangRef: null, previewUrl: URL.createObjectURL(f), caption: '' },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.');
      }
    }
    setBusy(null);
  };

  const onPickClip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError(null);
    if (!supported) {
      setError('This browser can’t make a boomerang — try Chrome or Safari on a recent device.');
      return;
    }
    setBusy('Making your boomerang…');
    try {
      const dur = await getVideoDuration(f);
      const windowLen = Math.min(MAX_CLIP_SECONDS, dur || MAX_CLIP_SECONDS);
      const baked = await bakeBoomerang({
        file: f,
        startSec: 0,
        durationSec: windowLen,
        freezeSec: windowLen / 2,
        onProgress: () => {},
      });
      const boomerangRef = await presignAndPut(baked.boomerang, 'clip.mp4');
      const stillRef = await presignAndPut(baked.still, 'clip.jpg');
      setStaged((s) => [
        ...s,
        { key: `${Date.now()}-${Math.random()}`, type: 'clip', stillRef, boomerangRef, previewUrl: URL.createObjectURL(baked.boomerang), caption: '' },
      ]);
    } catch (err) {
      setError(
        err instanceof EncoderUnsupportedError
          ? 'This device can’t encode a boomerang — add it as a photo instead.'
          : err instanceof Error
            ? err.message
            : 'Could not process that clip.',
      );
    }
    setBusy(null);
  };

  const removeStaged = (key: string) =>
    setStaged((s) => s.filter((x) => x.key !== key));
  const setCaption = (key: string, v: string) =>
    setStaged((s) => s.map((x) => (x.key === key ? { ...x, caption: v } : x)));

  const onSubmit = async () => {
    if (!staged.length) return;
    setSaving(true);
    setError(null);
    try {
      const items: SubmitMediaItem[] = staged.map((s) => ({
        type: s.type,
        stillRef: s.stillRef,
        boomerangRef: s.boomerangRef,
        caption: s.caption.trim() || null,
      }));
      const r = await submitVendorEditorialMedia(eventId, items);
      if (!r.ok) throw new Error(r.error);
      staged.forEach((s) => URL.revokeObjectURL(s.previewUrl));
      setStaged([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
    setSaving(false);
  };

  const onDeleteExisting = async (mediaId: string) => {
    setBusy('Removing…');
    await deleteVendorEditorialMedia(eventId, mediaId);
    setBusy(null);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Existing submissions */}
      {existing.length > 0 ? (
        <section className="rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Already on their editorial</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {existing.map((m) => (
              <figure key={m.mediaId} className="relative overflow-hidden rounded-lg border border-ink/10 bg-white">
                <div className="relative aspect-[4/5] bg-ink/10">
                  {m.type === 'clip' && m.boomerangUrl ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={m.boomerangUrl} poster={m.stillUrl} autoPlay muted loop playsInline className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.stillUrl} alt={m.caption ?? ''} className="h-full w-full object-cover" />
                  )}
                </div>
                <figcaption className="space-y-1 p-2">
                  <StatusBadge m={m} />
                  {m.caption ? <p className="truncate text-xs text-ink/60">{m.caption}</p> : null}
                  <button
                    type="button"
                    onClick={() => onDeleteExisting(m.mediaId)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline"
                  >
                    <Trash2 aria-hidden className="h-3.5 w-3.5" /> Remove
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {/* Add new */}
      <section className="rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Add to the editorial</h2>
        <p className="mt-0.5 text-sm text-ink/60">
          {photoRoom} photo{photoRoom === 1 ? '' : 's'} and {clipRoom} clip{clipRoom === 1 ? '' : 's'} left.
        </p>

        <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={onPickPhotos} />
        <input ref={clipInput} type="file" accept="video/*" hidden onChange={onPickClip} />

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={photoRoom <= 0 || !!busy}
            onClick={() => photoInput.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-ink/15 bg-white px-4 py-2.5 text-sm font-medium text-ink disabled:opacity-40"
          >
            <ImagePlus aria-hidden className="h-4 w-4" /> Add photos
          </button>
          <button
            type="button"
            disabled={clipRoom <= 0 || !!busy}
            onClick={() => clipInput.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-ink/15 bg-white px-4 py-2.5 text-sm font-medium text-ink disabled:opacity-40"
          >
            <Film aria-hidden className="h-4 w-4" /> Add a clip (≤{MAX_CLIP_SECONDS}s)
          </button>
        </div>

        {busy ? (
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-ink/65">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> {busy}
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}

        {/* Staged (not yet submitted) */}
        {staged.length > 0 ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {staged.map((s) => (
              <div key={s.key} className="overflow-hidden rounded-lg border border-ink/10 bg-white">
                <div className="relative aspect-[4/5] bg-ink/10">
                  {s.type === 'clip' ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={s.previewUrl} autoPlay muted loop playsInline className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.previewUrl} alt="" className="h-full w-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeStaged(s.key)}
                    aria-label="Remove"
                    className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-cream"
                  >
                    <Trash2 aria-hidden className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  value={s.caption}
                  onChange={(e) => setCaption(s.key, e.target.value)}
                  maxLength={140}
                  placeholder="Caption (optional)"
                  className="w-full border-t border-ink/10 bg-white px-2 py-1.5 text-xs outline-none"
                />
              </div>
            ))}
          </div>
        ) : null}

        {staged.length > 0 ? (
          <div className="mt-5 flex items-center justify-end">
            <button
              type="button"
              disabled={saving || !!busy}
              onClick={onSubmit}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-mulberry px-6 text-sm font-semibold text-cream transition hover:bg-mulberry/90 disabled:opacity-50"
            >
              {saving ? 'Submitting…' : `Submit ${staged.length} to their editorial`}
            </button>
          </div>
        ) : null}

        <p className="mt-4 text-xs text-ink/45">
          Everything is checked automatically before it appears. The couple can hide anything they’d
          rather not show.
        </p>
      </section>
    </div>
  );
}
