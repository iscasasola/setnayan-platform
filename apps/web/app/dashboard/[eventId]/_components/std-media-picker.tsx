'use client';

/**
 * Step-3 "Video / Gallery Photo" picker (controlled). The film's closing beat is
 * either the couple's existing PHOTO GALLERY (default) or an uploaded VIDEO.
 *
 * An uploaded video is NSFW-screened before it goes live (platform lock); it
 * plays as a locked real-time island in the film once approved (PR-B). Because
 * nsfwjs is image-only and the lambda has no ffmpeg, the screen runs on a POSTER
 * FRAME this picker grabs from the local File in the browser (canvas), uploads
 * to R2, and hands up as `posterKey` — exactly how Papic clips screen.
 */

import { useRef } from 'react';
import { Check, Images, Film } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import type { StdMedia } from '@/lib/std-media';

/** What the picker hands up when a video is uploaded (or null on clear). */
export type StdVideoUpload = {
  /** r2:// ref of the uploaded video. */
  videoKey: string;
  /** r2:// ref of the extracted poster frame (null if extraction failed). */
  posterKey: string | null;
  /** Local object URL of the just-picked file, for an instant preview. */
  previewUrl: string | null;
};

type Props = {
  value: StdMedia;
  onChange: (m: StdMedia) => void;
  eventId: string;
  /** How many photos the couple already has (the gallery option's content). */
  galleryCount?: number;
  /** Presigned URL for the currently-uploaded video, for the thumbnail. */
  videoUrl?: string | null;
  /** Fires with the upload payload (or null on clear) when a video is uploaded. */
  onUploadVideo: (payload: StdVideoUpload | null) => void;
};

/**
 * Grab a representative frame from a local video File via a hidden <video> +
 * canvas. Uses the local object URL (same-origin → no canvas taint). Returns a
 * JPEG blob, or null on any failure (the caller then leaves the video without a
 * poster, so it stays 'pending' and never goes live).
 */
function extractPosterFrame(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    let settled = false;
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const done = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    video.onloadedmetadata = () => {
      const d = video.duration;
      // ~1s in (past any black lead-in), or the midpoint of a very short clip.
      const t = Number.isFinite(d) && d > 0 ? Math.min(1, d / 2) : 0;
      try {
        video.currentTime = t;
      } catch {
        done(null);
      }
    };
    video.onseeked = () => {
      try {
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 360;
        const scale = Math.min(1, 1280 / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return done(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => done(blob), 'image/jpeg', 0.82);
      } catch {
        done(null);
      }
    };
    video.onerror = () => done(null);
    // Safety net: never hang the upload flow on a stuck decode.
    setTimeout(() => done(null), 8000);
  });
}

/** Upload one blob to R2 via the same /api/upload presign route FileUpload uses. */
async function uploadBlob(
  blob: Blob,
  eventId: string,
): Promise<string | null> {
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bucket: 'media',
        pathPrefix: `events/${eventId}/std-video-poster`,
        filename: 'poster.jpg',
        contentType: 'image/jpeg',
        sizeBytes: blob.size,
      }),
    });
    const data = (await res.json()) as
      | { uploadUrl: string; r2Ref: string }
      | { error: string };
    if (!res.ok || 'error' in data) return null;
    const put = await fetch(data.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
    });
    if (!put.ok) return null;
    return data.r2Ref;
  } catch {
    return null;
  }
}

export function StdMediaPicker({
  value,
  onChange,
  eventId,
  galleryCount = 0,
  videoUrl,
  onUploadVideo,
}: Props) {
  const isGallery = value.type === 'gallery';
  const isVideo = value.type === 'video';

  // Cross-callback state: onFilePicked (raw File) fires BEFORE FileUpload's
  // onChange (the r2 ref), and the poster upload finishes whenever it finishes.
  // We stash each piece as it arrives and (re-)emit the combined payload.
  const videoKeyRef = useRef<string | null>(null);
  const posterKeyRef = useRef<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const emit = () => {
    if (!videoKeyRef.current) return;
    onUploadVideo({
      videoKey: videoKeyRef.current,
      posterKey: posterKeyRef.current,
      previewUrl: previewUrlRef.current,
    });
  };

  const handleFilePicked = (file: File) => {
    // Fresh local preview (revoke the previous to avoid leaks).
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = URL.createObjectURL(file);
    posterKeyRef.current = null;
    // Extract + upload the poster frame in the background; re-emit when ready.
    void (async () => {
      const blob = await extractPosterFrame(file);
      const ref = blob ? await uploadBlob(blob, eventId) : null;
      posterKeyRef.current = ref;
      emit();
    })();
  };

  const handleVideoChange = (ref: string | null) => {
    if (!ref) {
      // Cleared — drop the local preview and revert to gallery.
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      videoKeyRef.current = null;
      posterKeyRef.current = null;
      previewUrlRef.current = null;
      onUploadVideo(null);
      return;
    }
    videoKeyRef.current = ref;
    emit();
  };

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          <Film aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Step 3 · Video / Gallery
        </p>
        <h2 className="font-serif text-xl italic">How your film ends</h2>
        <p className="text-sm text-ink/65">
          Close on a gallery of your photos, or upload a short video that plays right in your film.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          aria-pressed={isGallery}
          onClick={() => onChange({ type: 'gallery' })}
          className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-4 text-center transition-colors ${
            isGallery ? 'border-terracotta bg-terracotta/5 ring-2 ring-terracotta/15' : 'border-ink/15 bg-cream hover:border-ink/30'
          }`}
        >
          {isGallery ? (
            <Check aria-hidden className="absolute right-2 top-2 h-4 w-4 text-terracotta" strokeWidth={2.5} />
          ) : null}
          <Images aria-hidden className="h-6 w-6 text-ink/60" strokeWidth={1.5} />
          <span className="text-sm font-medium text-ink">Photo gallery</span>
          <span className="text-[11px] text-ink/50">
            {galleryCount > 0 ? `${galleryCount} photo${galleryCount === 1 ? '' : 's'}` : 'Your engagement / pre-wedding photos'}
          </span>
        </button>

        <button
          type="button"
          aria-pressed={isVideo}
          onClick={() =>
            onChange({
              type: 'video',
              videoKey: value.videoKey ?? null,
              posterKey: value.posterKey ?? null,
              nsfw: value.nsfw,
            })
          }
          className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-4 text-center transition-colors ${
            isVideo ? 'border-terracotta bg-terracotta/5 ring-2 ring-terracotta/15' : 'border-ink/15 bg-cream hover:border-ink/30'
          }`}
        >
          {isVideo ? (
            <Check aria-hidden className="absolute right-2 top-2 h-4 w-4 text-terracotta" strokeWidth={2.5} />
          ) : null}
          <Film aria-hidden className="h-6 w-6 text-ink/60" strokeWidth={1.5} />
          <span className="text-sm font-medium text-ink">Upload a video</span>
          <span className="text-[11px] text-ink/50">Plays right in your film</span>
        </button>
      </div>

      {isVideo ? (
        <div className="space-y-2">
          <FileUpload
            bucket="media"
            pathPrefix={`events/${eventId}/std-video`}
            acceptedTypes={['video/mp4', 'video/quicktime', 'video/webm']}
            maxSizeMB={200}
            variant="wide"
            currentValue={value.videoKey ?? null}
            initialDisplayUrls={value.videoKey && videoUrl ? { [value.videoKey]: videoUrl } : {}}
            onFilePicked={handleFilePicked}
            onChange={(v) => handleVideoChange(typeof v === 'string' ? v : null)}
            help="MP4/MOV/WebM, up to 200 MB."
          />
          {value.videoKey ? (
            <p className="text-[11px] font-medium">
              {value.nsfw === 'approved' ? (
                <span className="text-success-700">Reviewed — your video is live in the film.</span>
              ) : value.nsfw === 'rejected' ? (
                <span className="text-danger-700">
                  This video didn&rsquo;t pass review, so your film closes on your photo gallery instead. Try a different clip.
                </span>
              ) : (
                <span className="text-ink/60">Your video is being reviewed — it appears on your page once it&rsquo;s cleared.</span>
              )}
            </p>
          ) : null}
          <p className="text-[11px] text-ink/45">
            Every uploaded video is screened automatically before it appears on your page (it can&rsquo;t be turned off).
            It then plays in full, with sound, as the heart of your film.
          </p>
        </div>
      ) : null}
    </section>
  );
}
