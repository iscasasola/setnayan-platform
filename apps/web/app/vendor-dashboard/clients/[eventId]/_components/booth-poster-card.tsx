'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { ImageIcon, Loader2 } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { setBoothPoster } from '../cocktail/actions';
import {
  POSTER_ACCEPTED_TYPES,
  POSTER_DIMENSION_LABEL,
  POSTER_MAX_MB,
  validatePosterFile,
} from '@/lib/booth-poster';

/**
 * "Your booth poster" — a booked vendor's own design for THIS couple's event,
 * shown on their 3D booth beside the account-level logo.
 *
 * WHY IT LIVES ON THE EVENT BRIEF, not the cocktail editor: the cocktail page
 * redirects on category_not_cocktail / vendor_edit_off, so a vendor whose booth
 * sits in the reception could never reach it. vendor_set_booth_poster's gate is
 * deliberately wider — any BOOKED vendor — so the UI has to sit on the surface
 * with the same reach. The brief is that surface.
 *
 * The upload writes to R2 first (FileUpload emits an r2:// ref), then the ref is
 * persisted through the server action → SECURITY DEFINER RPC. An upload whose
 * save fails leaves an orphan object in R2 rather than a wrong row, which is the
 * right way round.
 */
export function BoothPosterCard({
  eventId,
  vendorProfileId,
  initialRef,
  initialDisplayUrl,
}: {
  eventId: string;
  vendorProfileId: string;
  initialRef: string | null;
  initialDisplayUrl: string | null;
}) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(initialDisplayUrl);
  const [savedRef, setSavedRef] = useState<string | null>(initialRef);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function persist(ref: string | null, nextDisplayUrl: string | null) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await setBoothPoster(eventId, ref);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSavedRef(ref);
      setDisplayUrl(nextDisplayUrl);
      setSaved(true);
    });
  }

  return (
    <div className="rounded-2xl border border-terracotta/25 bg-terracotta/[0.04] p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70">
        <ImageIcon aria-hidden className="h-4 w-4 text-terracotta" /> Your booth poster
      </h2>
      <p className="mt-2 text-sm text-ink/65">
        Design something for <em>this</em> wedding — it goes on your booth in the couple&rsquo;s 3D
        plan, where their guests will walk past it. Your company logo shows alongside it
        automatically, so the poster is free for the artwork.
      </p>
      <p className="mt-1 text-xs text-ink/50">
        Portrait {POSTER_DIMENSION_LABEL} (2:3), up to {POSTER_MAX_MB * 1000} KB. JPG, PNG or WebP.
      </p>

      {displayUrl ? (
        <div className="mt-3 flex items-start gap-3">
          <Image
            src={displayUrl}
            alt="Your current booth poster"
            width={80}
            height={120}
            unoptimized
            className="h-[120px] w-20 rounded-md border border-ink/10 object-cover"
          />
          <button
            type="button"
            onClick={() => persist(null, null)}
            disabled={pending}
            className="text-sm font-medium text-ink/60 underline hover:text-ink disabled:opacity-50"
          >
            Remove poster
          </button>
        </div>
      ) : null}

      <div className="mt-3">
        <FileUpload
          bucket="media"
          pathPrefix={`vendors/${vendorProfileId}/events/${eventId}/poster`}
          maxSizeMB={POSTER_MAX_MB}
          acceptedTypes={[...POSTER_ACCEPTED_TYPES]}
          validateFile={validatePosterFile}
          qrGuard
          variant="wide"
          label={savedRef ? 'Replace poster' : 'Upload poster'}
          disabled={pending}
          onChange={(value) => {
            const ref = Array.isArray(value) ? value[0] ?? null : value;
            if (!ref) return;
            // The widget's own preview covers the interim; the display URL is
            // re-resolved server-side on the next load.
            persist(ref, null);
          }}
        />
      </div>

      {pending ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink/50">
          <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> Saving&hellip;
        </p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-danger-700">{error}</p> : null}
      {saved && !error ? (
        <p className="mt-2 text-xs text-ink/50">Saved. It appears on your booth in their 3D plan.</p>
      ) : null}
    </div>
  );
}
