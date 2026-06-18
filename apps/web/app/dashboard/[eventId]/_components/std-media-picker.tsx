'use client';

/**
 * Step-3 "Video / Gallery Photo" picker (controlled). The film's closing beat is
 * either the couple's existing PHOTO GALLERY (default) or an uploaded VIDEO.
 * An uploaded video is NSFW-screened before it goes live (platform lock); it
 * plays as a locked real-time island in the film once approved (PR-B).
 */

import { Check, Images, Film } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import type { StdMedia } from '@/lib/std-media';

type Props = {
  value: StdMedia;
  onChange: (m: StdMedia) => void;
  eventId: string;
  /** How many photos the couple already has (the gallery option's content). */
  galleryCount?: number;
  /** Presigned URL for the currently-uploaded video, for the thumbnail. */
  videoUrl?: string | null;
  /** Fires with the new r2:// ref (or null on clear) when a video is uploaded. */
  onUploadVideo: (ref: string | null) => void;
};

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

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          <Film aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Video / Gallery
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
          onClick={() => onChange({ type: 'video', videoKey: value.videoKey ?? null, nsfw: value.nsfw })}
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
            maxSizeMB={64}
            variant="wide"
            currentValue={value.videoKey ?? null}
            initialDisplayUrls={value.videoKey && videoUrl ? { [value.videoKey]: videoUrl } : {}}
            onChange={(v) => onUploadVideo(typeof v === 'string' ? v : null)}
            help="MP4/MOV/WebM, up to 64 MB."
          />
          <p className="text-[11px] text-ink/45">
            Every uploaded video is screened automatically before it appears on your page (it can&rsquo;t be turned off).
            It then plays in full, with sound, as the heart of your film.
          </p>
        </div>
      ) : null}
    </section>
  );
}
