'use client';

// ============================================================================
// Editorial media studio (iteration 0046, Inc 2) — the recommended vendor adds
// up to 3 photos + 3 five-second clips for the couple's editorial. Photos
// upload directly; clips are trimmed to ≤5s and baked into a forward+reverse
// boomerang IN THE BROWSER (same encoder as the couple's Living Hero), so the
// editorial rule "every clip is a boomerang" holds at ingest. No server video
// pipeline.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Film, Trash2, Loader2, Send } from 'lucide-react';
import {
  bakeBoomerang,
  boomerangSupported,
  EncoderUnsupportedError,
  MAX_CLIP_SECONDS,
} from '@/lib/boomerang-encoder';
import { submitVendorEditorialMedia, deleteVendorEditorialMedia } from '../actions';
import { MAX_PER_TYPE, type SubmitMediaItem } from '@/lib/editorial-vendor-media';
import { ActionButton } from '@/components/action-button';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { TEMPLATE_SUBLINE, TemplateSection } from '@/app/_components/template-rows';
import { formatCount } from '@/lib/format-number';

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
// SEC-1 lane #3: the upload prefix carries the TENANT. It was a flat
// `editorial-vendor`, which meant the server-side policy could only contain the
// ref to the right bucket, never prove it was this vendor's media for this
// event. The pathPrefix is the only place that can fix it — a guard cannot
// invent tenancy the key layout does not carry.
async function presignAndPut(
  body: Blob,
  filename: string,
  pathPrefix: string,
): Promise<string> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucket: 'media',
      pathPrefix,
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
    v.onerror = () => {
      URL.revokeObjectURL(v.src);
      resolve(MAX_CLIP_SECONDS);
    };
    v.src = URL.createObjectURL(file);
  });
}

function StatusBadge({ m }: { m: ExistingMedia }) {
  const [label, tone]: readonly [string, BadgeTone] = m.hiddenByCouple
    ? ['Hidden by couple', 'quiet']
    : m.moderationState === 'clean'
      ? ['Live on editorial', 'ok']
      : m.moderationState === 'unscreened'
        ? ['Checking…', 'wait']
        : ['Removed', 'no'];
  return <Badge tone={tone}>{label}</Badge>;
}

export function EditorialMediaStudio({
  eventId,
  vendorProfileId,
  existing,
}: {
  eventId: string;
  /** SEC-1 lane #3 — the tenant segment of the upload prefix. */
  vendorProfileId: string;
  existing: ExistingMedia[];
}) {
  // Must match `editorialVendorMediaPolicy(vendorProfileId, eventId)` exactly —
  // the server refuses anything outside it, so a drift here is a broken upload,
  // not a silent one.
  const uploadPrefix = `editorial-vendor/${vendorProfileId}/${eventId}`;
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
        const stillRef = await presignAndPut(f, 'photo.jpg', uploadPrefix);
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
      const boomerangRef = await presignAndPut(baked.boomerang, 'clip.mp4', uploadPrefix);
      const stillRef = await presignAndPut(baked.still, 'clip.jpg', uploadPrefix);
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
    setStaged((s) => {
      const item = s.find((x) => x.key === key);
      if (item) URL.revokeObjectURL(item.previewUrl); // free the blob URL we created
      return s.filter((x) => x.key !== key);
    });
  const setCaption = (key: string, v: string) =>
    setStaged((s) => s.map((x) => (x.key === key ? { ...x, caption: v } : x)));

  // Revoke any STILL-staged preview blob URLs on unmount (the visitor navigated
  // away without submitting — onSubmit and removeStaged already revoke on their
  // own paths). A ref keeps the cleanup current without re-subscribing each render.
  const stagedRef = useRef(staged);
  stagedRef.current = staged;
  useEffect(
    () => () => {
      stagedRef.current.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    },
    [],
  );

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
    setSaving(false);
  };

  const onDeleteExisting = async (mediaId: string) => {
    setBusy('Removing…');
    await deleteVendorEditorialMedia(eventId, mediaId);
    setBusy(null);
  };

  return (
    <div className="space-y-2">
      {/* Existing submissions — rule 2: a section on the page, not a card. */}
      {existing.length > 0 ? (
        <TemplateSection label="Already on their editorial" first>
          <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {existing.map((m) => (
              <figure key={m.mediaId} className="relative overflow-hidden rounded-lg border border-[color:var(--m-line)]">
                <div className="relative aspect-[4/5] bg-[color:var(--m-paper-2)]">
                  {m.type === 'clip' && m.boomerangUrl ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={m.boomerangUrl} poster={m.stillUrl} autoPlay muted loop playsInline className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.stillUrl} alt={m.caption || 'Wedding editorial photo'} className="h-full w-full object-cover" />
                  )}
                </div>
                <figcaption className="space-y-1 p-2">
                  <StatusBadge m={m} />
                  {m.caption ? <p className={`truncate ${TEMPLATE_SUBLINE}`}>{m.caption}</p> : null}
                  <ActionButton
                    tone="danger"
                    icon={Trash2}
                    label="Remove"
                    onClick={() => onDeleteExisting(m.mediaId)}
                    disabled={!!busy}
                  />
                </figcaption>
              </figure>
            ))}
          </div>
        </TemplateSection>
      ) : null}

      {/* Add new */}
      <TemplateSection
        label="Add to the editorial"
        first={existing.length === 0}
        tip="Everything is checked automatically before it appears. The couple can hide anything they’d rather not show."
        right={`${formatCount(photoRoom)} photo${photoRoom === 1 ? '' : 's'} and ${formatCount(clipRoom)} clip${clipRoom === 1 ? '' : 's'} left`}
      >
        <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={onPickPhotos} />
        <input ref={clipInput} type="file" accept="video/*" hidden onChange={onPickClip} />

        <div className="mt-1 flex flex-wrap gap-3">
          <ActionButton
            tone="brand"
            icon={ImagePlus}
            label="Add photos"
            disabled={photoRoom <= 0 || !!busy}
            onClick={() => photoInput.current?.click()}
          />
          <ActionButton
            tone="brand"
            icon={Film}
            label={`Add a clip (≤${MAX_CLIP_SECONDS}s)`}
            disabled={clipRoom <= 0 || !!busy}
            onClick={() => clipInput.current?.click()}
          />
        </div>

        {busy ? (
          <p className={`mt-3 inline-flex items-center gap-2 ${TEMPLATE_SUBLINE}`}>
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> {busy}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-[14px] font-semibold" style={{ color: 'rgb(var(--color-danger))' }}>
            {error}
          </p>
        ) : null}

        {/* Staged (not yet submitted) */}
        {staged.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {staged.map((s) => (
              <div key={s.key} className="overflow-hidden rounded-lg border border-[color:var(--m-line)]">
                <div className="relative aspect-[4/5] bg-[color:var(--m-paper-2)]">
                  {s.type === 'clip' ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={s.previewUrl} autoPlay muted loop playsInline className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.previewUrl} alt="Preview of photo staged for the editorial" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute right-1.5 top-1.5">
                    <ActionButton tone="danger" icon={Trash2} label="Remove" iconOnly onClick={() => removeStaged(s.key)} />
                  </span>
                </div>
                <input
                  value={s.caption}
                  onChange={(e) => setCaption(s.key, e.target.value)}
                  maxLength={140}
                  placeholder="Caption (optional)"
                  aria-label="Caption (optional)"
                  className="min-h-11 w-full border-t border-[color:var(--m-line)] bg-transparent px-2 py-1.5 text-[14px] text-ink outline-none"
                />
              </div>
            ))}
          </div>
        ) : null}

        {staged.length > 0 ? (
          <div className="mt-4 flex items-center justify-end">
            <ActionButton
              tone="brand"
              main
              icon={Send}
              label={saving ? 'Submitting…' : `Submit ${staged.length} to their editorial`}
              disabled={saving || !!busy}
              onClick={onSubmit}
            />
          </div>
        ) : null}
      </TemplateSection>
    </div>
  );
}
