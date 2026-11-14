import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { notFound, redirect } from 'next/navigation';
import { InfoTip } from '@/app/_components/info-tip';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ImagePlus, Trash2, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { FileUpload } from '@/app/_components/file-upload';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import { uploadHeroPhoto, removeHeroPhoto } from './actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { eventNoun } from '@/lib/event-noun';
import { PageMasthead } from '@/app/_components/page-masthead';
import { eventHubPartActive } from '@/lib/couple-website-pro';
import { WebsiteProLock } from '../_components/website-pro-lock';
import { SafeForm } from '@/app/dashboard/[eventId]/_components/safe-form';

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
      'event_id, display_name, slug, event_type, landing_page_hero_image_url, landing_page_hero_image_uploaded_at',
    )
    .eq('event_id', eventId)
    .maybeSingle();

  if (error || !event) {
    // RLS will filter out events the host can't read. We treat that the same
    // as a real 404 for the editor — non-hosts can't reach this page.
    notFound();
  }

  // 📷 Their OWN hero photo is Event Hub Pro (owner 2026-09-24, "A"). A free
  // couple keeps a photo they already have and may remove it (above, never
  // gated); putting up a new one is locked here and refused by the action.
  // Fail-open on a throwing read, like the sibling editors — the action is the
  // real gate either way.
  const ownsPro = await eventHubPartActive(await eventEntitlementClient(eventId), eventId, 'background').catch(() => true);

  // Resolve the current photo (if any) to a presigned GET URL for display.
  const currentPhotoUrl = await displayUrlForStoredAsset(
    siteMediaServeRef(event.landing_page_hero_image_url),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href={`/dashboard/${eventId}/launch`}
        className="mb-6 inline-flex min-h-11 items-center gap-1.5 text-sm text-ink/75 transition-colors hover:text-ink focus-visible:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        <span>Back to Event Hub</span>
      </Link>

      {/* Header */}
      <PageMasthead
        title="Hero photo"
      />

      {/* 📐 DESIGN TEMPLATE (14 Nov 2026, rules 1 · 2 · 3 · 13 · 14): the living-hero door is a plain hairline row with a
          terracotta ›; the sections are grey capitals over plain content (no tiles, no serif-italic headings); the
          presses are the shared pills (red Remove · grey Cancel · the one terracotta Save); burgundy colour codes are gone. */}
      <Link
        href={`/dashboard/${eventId}/website/living-hero`}
        className="mb-8 flex min-h-14 items-center justify-between gap-4 border-y border-ink/10 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        <div>
          <p className="text-[15px] font-semibold text-ink">Make it move</p>
          <p className="mt-0.5 text-[13px] text-ink/75">
            Turn a few seconds of video into a gentle, looping hero — it plays
            forward then reverses. We keep a still for print + slow connections.
          </p>
        </div>
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
      </Link>

      {/* Current photo preview */}
      {currentPhotoUrl ? (
        <section
          aria-labelledby="current-photo-heading"
          className="mb-8 space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id="current-photo-heading"
              className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70"
            >
              Current photo
            </h2>
            <SafeForm action={removeHeroPhoto}>
              <input type="hidden" name="event_id" value={eventId} />
              <SubmitButton pendingLabel="Removing…" className="ab ab-danger">
                <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>Remove</span>
              </SubmitButton>
            </SafeForm>
          </div>
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-ink/5">
            {/* unoptimized because the URL is presigned and short-lived (24h);
                next/image's optimizer would re-fetch on expiry. */}
            <Image
              src={currentPhotoUrl}
              alt={`Hero photo for ${event.display_name ?? `your ${eventNoun(event.event_type)}`}`}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              unoptimized
            />
          </div>
          {event.landing_page_hero_image_uploaded_at ? (
            <p className="text-[13px] text-ink/75">
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

      {/* Upload form — or, for a free couple, the one Pro lock */}
      {!ownsPro ? (
        <WebsiteProLock
          eventId={eventId}
          variant="inline"
          featureName="Your own hero photo"
          description="Put a photo of the two of you at the top of your Event Hub, in place of ours. It's part of Event Hub PRO."
        />
      ) : (
      <section
        aria-labelledby="upload-heading"
        className="space-y-3 border-t border-ink/10 pt-5"
      >
        <h2 id="upload-heading" className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
          {currentPhotoUrl ? 'Replace photo' : 'Add a photo'}
        </h2>

        <SafeForm action={uploadHeroPhoto} className="space-y-4">
          <input type="hidden" name="event_id" value={eventId} />

          <FileUpload
            bucket="media"
            pathPrefix={`events/${eventId}/landing-page-hero`}
            name="hero_image_url"
            unsavedHint="press Save photo below"
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
              href={`/dashboard/${eventId}/launch`}
              className="ab ab-neutral"
            >
              Cancel
            </Link>
            <SubmitButton pendingLabel="Saving…" className="ab ab-brand ab-main">
              <ImagePlus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              <span>Save photo</span>
            </SubmitButton>
          </div>
        </SafeForm>
      </section>
      )}

      {/* Guidance */}
      <section className="mt-8">
        <InfoTip label="Tip" labelAs="p" labelClassName="text-sm font-semibold text-ink" align="start">
          Engagement shoot photos read well at this size — the landing page composites the banner full-bleed with a
          soft overlay so your monogram and countdown stay readable on top.
        </InfoTip>
      </section>
    </div>
  );
}
