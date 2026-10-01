'use client';

import { useState, useTransition } from 'react';
import { requestMakerRefresh } from '@/lib/maker-refresh';
import { FileUpload } from '@/app/_components/file-upload';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { POSTER_PHOTO_MIN_PX, posterPhotoTooSmall, type PosterPhoto } from '@/lib/print-pieces';

/**
 * 🖼 THE A3 OUR STORY POSTER'S BACKGROUND (owner 2026-09-29, DECISION_LOG "OWNER
 * ANSWERS — TEN OPEN QUESTIONS" (1): *"Poster: can add media background"*).
 *
 * ONE PickMenu (owner rule: any set of choices is one dropdown): the theme's
 * picture (the default) or the couple's own photo — uploaded right here, the
 * same upload the scenes use (`FileUpload`, the couple's event folder). Print
 * needs pixels, so the photo is NOT squeezed in the browser, and the server
 * measures it: under A3 at 150 dpi the panel says it may print soft.
 */
const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export function PosterPhotoPicker({ eventId, saved }: { eventId: string; saved: PosterPhoto | null }) {
  const [photo, setPhoto] = useState<PosterPhoto | null>(saved);
  const [mode, setMode] = useState<'theme' | 'photo'>(saved ? 'photo' : 'theme');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const post = (ref: string) =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('ref', ref);
      const res = await fetch('/api/hub-print/poster-photo', { method: 'POST', body: fd, headers: { accept: 'application/json' } }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as { ok?: boolean; photo?: PosterPhoto | null; error?: string } | null;
      if (!res?.ok || !body?.ok) {
        setError(body?.error ?? 'That did not save — please try again.');
        return;
      }
      setPhoto(body.photo ?? null);
      // The poster's picture is drawn from the saved details — ask the Maker to
      // refresh (its one refresh path; no router is mounted in a render test).
      requestMakerRefresh();
    });

  const small = posterPhotoTooSmall(photo);
  return (
    <div className="flex flex-col gap-2 border-b border-ink/5 pb-3" data-poster-photo={photo ? 'photo' : 'theme'} aria-busy={pending || undefined}>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span className="text-sm text-ink">Background</span>
        <PickMenu
          label="The poster’s background"
          value={mode}
          options={[
            { key: 'theme', label: 'The theme’s picture' },
            { key: 'photo', label: 'My photo' },
          ]}
          onPick={(k) => {
            if (k === 'theme') {
              setMode('theme');
              if (photo) post('');
            } else setMode('photo');
          }}
          dataAttr="data-poster-photo-pick"
        />
      </div>
      {mode === 'photo' ? (
        <FileUpload
          bucket="media"
          pathPrefix={`events/${eventId}/poster`}
          multiple={false}
          maxSizeMB={30}
          acceptedTypes={IMAGE_TYPES}
          onChange={(v) => {
            const ref = typeof v === 'string' ? v : null;
            if (ref) post(ref);
          }}
          disabled={pending}
          label={photo ? 'Choose another photo' : 'Upload a photo'}
        />
      ) : null}
      {photo && small ? (
        <p role="alert" className="text-[13px] text-terracotta-700" data-poster-photo-small="">
          This photo is {photo.w} × {photo.h} pixels — small for A3 paper, so it may print soft. For a sharp poster use one at
          least {POSTER_PHOTO_MIN_PX.short} × {POSTER_PHOTO_MIN_PX.long} (3508 × 4961 is ideal).
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
