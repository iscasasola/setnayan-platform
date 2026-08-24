'use client';

import { useRef, useState } from 'react';
import { Camera, Check, Loader2, Pencil, X } from 'lucide-react';
import { updateCommunityIdentity } from '../../actions';

// The samahan's face, edited WHERE IT IS (owner 2026-08-24, looking at the
// live header: "click on this image to upload photo? … taps the text to
// rename as well? or an edit button for the text").
//
// Both questions answered on purpose, not split:
//   · the PHOTO is the button — tapping the chip opens the picker, and a
//     camera badge sits on its corner so it reads as one;
//   · the NAME is a button too, WITH a pencil beside it. Tap-anywhere alone
//     is undiscoverable (nothing says the title is live), and a lone pencil
//     is a small target on a phone — so the whole title is the target and
//     the pencil is what tells you.
//
// Every member may do both (the DB trigger is what keeps `archived` and the
// identity columns organizer-side), so there is no role gate here.

const MAX_PHOTO_MB = 5;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export function SamahanIdentityHeader({
  communityId,
  name,
  publicId,
  photoUrl,
  photoDisplayUrl,
  initial,
  metaLine,
}: {
  communityId: string;
  name: string;
  publicId: string;
  photoUrl: string | null;
  photoDisplayUrl: string | null;
  initial: string;
  metaLine: React.ReactNode;
}) {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoFormRef = useRef<HTMLFormElement>(null);
  const photoRefField = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Optimistic preview: the new photo shows the moment it is chosen, before
  // the round trip. A failed upload clears it rather than leaving a picture
  // the database never received.
  const [preview, setPreview] = useState<string | null>(null);

  async function onPickPhoto(file: File) {
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError('That needs to be a JPG, PNG or WEBP.');
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setError(`Keep it under ${MAX_PHOTO_MB} MB.`);
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);
    try {
      // Same two-step /api/upload contract <FileUpload> uses: presign, then
      // PUT the body. The samahan/<id> prefix is tenanted to members.
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket: 'media',
          pathPrefix: `samahan/${communityId}/photo`,
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { uploadUrl: string; r2Ref: string }
        | { error: string }
        | null;
      if (!res.ok || !data || 'error' in data) {
        throw new Error('presign');
      }
      const put = await fetch(data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!put.ok) throw new Error('put');
      // Hand the ref to the server action — the same one the name uses.
      if (photoRefField.current) photoRefField.current.value = data.r2Ref;
      photoFormRef.current?.requestSubmit();
    } catch {
      URL.revokeObjectURL(localUrl);
      setPreview(null);
      setUploading(false);
      setError('That photo didn’t upload. Try again.');
    } finally {
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  const shownPhoto = preview ?? photoDisplayUrl;

  return (
    <div className="mb-6 rounded-2xl border border-ink/15 bg-white/60 p-5 shadow-[0_18px_40px_-26px_rgba(30,26,18,0.35)]">
      <div className="flex items-center gap-4">
        {/* The photo IS the button. */}
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          disabled={uploading}
          aria-label={photoUrl ? 'Change the group photo' : 'Add a group photo'}
          className="group relative h-14 w-14 shrink-0 rounded-2xl ring-1 ring-terracotta-500"
        >
          {shownPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived presigned URL (and a local blob while uploading); the optimizer would re-transform per render
            <img
              src={shownPhoto}
              alt=""
              className="h-14 w-14 rounded-2xl object-cover"
            />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mulberry/10 text-xl font-semibold text-mulberry">
              {initial}
            </span>
          )}
          <span
            aria-hidden
            className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-mulberry text-white shadow"
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Camera className="h-3 w-3" />
            )}
          </span>
        </button>
        <input
          ref={photoInputRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPickPhoto(f);
          }}
        />
        <form ref={photoFormRef} action={updateCommunityIdentity} className="hidden">
          <input type="hidden" name="community_id" value={communityId} />
          <input ref={photoRefField} type="hidden" name="photo_url" defaultValue="" />
        </form>

        <div className="min-w-0 flex-1">
          {editingName ? (
            <form
              action={updateCommunityIdentity}
              className="flex items-center gap-2"
              onSubmit={() => setEditingName(false)}
            >
              <input type="hidden" name="community_id" value={communityId} />
              <input
                type="text"
                name="name"
                defaultValue={name}
                autoFocus
                minLength={2}
                maxLength={80}
                aria-label="What this samahan is called"
                className="min-w-0 flex-1 rounded-xl border border-ink/20 bg-white px-2 py-1 font-sans text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
              />
              <button
                type="submit"
                aria-label="Save the name"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mulberry text-white"
              >
                <Check className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                aria-label="Cancel"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink/60"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="flex max-w-full items-center gap-2 text-left"
              aria-label={`Rename ${name}`}
            >
              <h1 className="truncate font-sans text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {name}
              </h1>
              <Pencil
                aria-hidden
                className="h-4 w-4 shrink-0 text-ink/40"
                strokeWidth={1.75}
              />
            </button>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em]">
            <span className="text-ink/45">{publicId}</span>
          </p>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-mulberry-700">{error}</p> : null}
      {metaLine}
    </div>
  );
}
