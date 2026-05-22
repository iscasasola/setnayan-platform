import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ImagePlus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { FileUpload } from '@/app/_components/file-upload';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { uploadHeroPhoto, removeHeroPhoto } from './actions';

/**
 * Editor for the wedding landing page hero photo.
 *
 * The page is reachable from `/dashboard/[eventId]/website` Quick Actions
 * grid (the "Edit hero photo" tile). It shows the current photo (if any) +
 * the `<FileUpload>` widget for picking a new one.
 *
 * Auth + RLS: the page itself runs under the host's Supabase session, so the
 * events SELECT is RLS-scoped to events the host can read. The server actions
 * additionally check event_moderators / event_members membership before
 * writing — the page-level RLS prevents non-hosts from reaching this surface
 * at all (they get a notFound() because the events row isn't readable).
 *
 * Brand voice — Cormorant Garamond italic display + Manrope body. Cream +
 * burgundy + terracotta. Per [[feedback_setnayan_no_dev_text_post_launch]].
 *
 * Cross-ref: CLAUDE.md 2026-05-22 row · Hero Photo PR sibling of #381
 * Privacy + #382 Dress Code + #383 Photo Moments.
 */

export default async function HeroPhotoEditorPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event, error } = await supabase
    .from('events')
    .select(
      'event_id, display_name, slug, landing_page_hero_image_url, landing_page_hero_image_uploaded_at',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  if (error || !event) {
    // RLS will filter out events the host can't read. We treat that the same
    // as a real 404 for the editor — non-hosts can't reach this page.
    notFound();
  }

  // Resolve the current photo (if any) to a presigned GET URL for display.
  const currentPhotoUrl = await displayUrlForStoredAsset(
    event.landing_page_hero_image_url,
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href={`/dashboard/${eventId}/website`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink/65 transition-colors hover:text-burgundy focus-visible:text-burgundy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        <span>Back to website</span>
      </Link>

      {/* Header */}
      <header className="mb-8 space-y-2">
        <h1 className="font-display text-3xl italic text-ink sm:text-4xl">
          Hero photo
        </h1>
        <p className="max-w-prose text-sm text-ink/65 sm:text-base">
          Choose a hi-res photo of the two of you. It lands as the full-bleed
          banner on your wedding’s public page. JPG, PNG, or WebP up to 10 MB.
          Aspect ratio works best at 16:9 or 4:3.
        </p>
      </header>

      {/* Current photo preview */}
      {currentPhotoUrl ? (
        <section
          aria-labelledby="current-photo-heading"
          className="mb-8 space-y-4 rounded-2xl border border-ink/10 bg-cream/60 p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id="current-photo-heading"
              className="font-display text-lg italic text-ink"
            >
              Current photo
            </h2>
            <form action={removeHeroPhoto}>
              <input type="hidden" name="event_id" value={eventId} />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs font-semibold text-ink/75 transition-colors hover:border-burgundy/40 hover:bg-burgundy/5 hover:text-burgundy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                aria-label="Remove the current hero photo"
              >
                <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Remove</span>
              </button>
            </form>
          </div>
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-ink/5">
            {/* unoptimized because the URL is presigned and short-lived (24h);
                next/image's optimizer would re-fetch on expiry. */}
            <Image
              src={currentPhotoUrl}
              alt={`Hero photo for ${event.display_name ?? 'your wedding'}`}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              unoptimized
            />
          </div>
          {event.landing_page_hero_image_uploaded_at ? (
            <p className="text-xs text-ink/50">
              Uploaded{' '}
              {new Date(
                event.landing_page_hero_image_uploaded_at,
              ).toLocaleDateString('en-PH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
              .
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Upload form */}
      <section
        aria-labelledby="upload-heading"
        className="space-y-4 rounded-2xl border border-ink/10 bg-cream/40 p-5"
      >
        <h2 id="upload-heading" className="font-display text-lg italic text-ink">
          {currentPhotoUrl ? 'Replace photo' : 'Add a photo'}
        </h2>

        <form action={uploadHeroPhoto} className="space-y-4">
          <input type="hidden" name="event_id" value={eventId} />

          <FileUpload
            bucket="media"
            pathPrefix={`events/${eventId}/landing-page-hero`}
            name="hero_image_url"
            multiple={false}
            maxSizeMB={10}
            acceptedTypes={[
              'image/jpeg',
              'image/jpg',
              'image/png',
              'image/webp',
            ]}
            label="Hero photo"
            help="JPG, PNG, or WebP. Up to 10 MB."
          />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href={`/dashboard/${eventId}/website`}
              className="inline-flex items-center justify-center rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink/75 transition-colors hover:border-ink/25 hover:bg-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-burgundy/20 bg-burgundy px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-burgundy/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              <ImagePlus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              <span>Save photo</span>
            </button>
          </div>
        </form>
      </section>

      {/* Guidance */}
      <section className="mt-8 space-y-2 text-sm text-ink/60">
        <p>
          <span className="font-semibold text-ink/75">Tip.</span> Engagement
          shoot photos read well at this size — the landing page composites
          the banner full-bleed with a soft overlay so your monogram and
          countdown stay readable on top.
        </p>
      </section>
    </main>
  );
}
