import { redirect } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { FileUpload } from '@/app/_components/file-upload';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { updateOurPhotos } from './actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { WebsiteProLock } from '../_components/website-pro-lock';
import { PageMasthead } from '@/app/_components/page-masthead';

export const metadata = { title: 'Edit our photos' };

const MAX_PHOTOS = 24;

/**
 * /dashboard/[eventId]/website/our-photos — couple-curated photo gallery
 * (Increment A.4 · Wedding_Website_Lifecycle_Spec_2026-06-07 §6.5). The
 * couple uploads their OWN photos (engagement / pre-wedding); OurPhotosWidget
 * in apps/web/app/[slug]/page.tsx renders them on the public invitation and
 * hides the section when the gallery is empty. Distinct from `your_photos`
 * (the guest's tagged photos).
 *
 * Image bytes upload via the shared <FileUpload> → /api/upload presigned path
 * (images already whitelisted). FileUpload emits one hidden `photos` input per
 * uploaded ref, so the plain server-action form reads the ordered set via
 * formData.getAll('photos'). Existing photos are seeded so the host can
 * add/remove before saving.
 */
export default async function OurPhotosEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { eventId } = await params;
  const search = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name, slug, our_photos')
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event) redirect(`/dashboard/${eventId}`);

  const currentRefs = Array.isArray(event.our_photos)
    ? (event.our_photos.filter(
        (r): r is string => typeof r === 'string' && r.startsWith('r2://'),
      ) as string[])
    : [];

  // ── Website PRO gate + grandfather (owner 2026-07-24 · Launch settings §3) ──
  // The photo gallery is now a Website PRO perk. The gate = (NOT PRO) AND (this
  // gallery has NO existing content). A couple that already curated photos, or
  // owns PRO, always keeps the editor — and the live guest site never loses its
  // gallery (only the EDITOR gates going forward). Fail-open: if the entitlement
  // read throws, treat as owned so a real couple is never locked out.
  const proActive = await eventCoupleWebsiteProActive(supabase, eventId).catch(() => true);
  const hasContent = currentRefs.length > 0;
  if (!proActive && !hasContent) {
    return (
      <WebsiteProLock
        eventId={eventId}
        backHref={`/dashboard/${eventId}/website`}
        featureName="Your own photo gallery"
        description="Add your engagement or pre-wedding photos as a gallery on your Event Hub. It's part of Event Hub PRO."
      />
    );
  }

  // Resolve each ref to a 24h presigned display URL so the uploader shows the
  // existing gallery thumbnails on mount.
  const resolved = await Promise.all(
    currentRefs.map(async (ref) => [ref, await displayUrlForStoredAsset(ref)] as const),
  );
  const initialDisplayUrls: Record<string, string> = {};
  for (const [ref, url] of resolved) {
    if (url) initialDisplayUrls[ref] = url;
  }

  const updateAction = updateOurPhotos.bind(null, eventId);
  const saved = search.saved === '1';
  const error = search.error;

  return (
    <section className="space-y-6">
      <PageMasthead
        title="Your own gallery"
        back={`/dashboard/${eventId}/website`}
        backLabel="Back to Event Hub"
        lede={
          <>
            Add a few of your favourite photos — your engagement shoot, a
            pre-wedding session, or candid moments. They appear as a gallery on
            your Event Hub. Leave it empty to hide the section. JPG, PNG,
            or WebP up to 10 MB each · up to {MAX_PHOTOS} photos.
          </>
        }
      />
      <div className="mt-3 space-y-3">
        {saved ? (
          <div
            role="status"
            className="inline-flex items-center gap-2 rounded-md border border-success-300/60 bg-success-50 px-3 py-2 text-sm text-success-800"
          >
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Saved — your guests will see this gallery on your Event Hub.
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </div>
        ) : null}
      </div>

      <form action={updateAction} className="space-y-4">
        <FileUpload
          bucket="media"
          pathPrefix={`events/${eventId}/our-photos`}
          name="photos"
          multiple
          maxFiles={MAX_PHOTOS}
          maxSizeMB={10}
          acceptedTypes={['image/jpeg', 'image/jpg', 'image/png', 'image/webp']}
          currentValue={currentRefs}
          initialDisplayUrls={initialDisplayUrls}
          variant="wide"
          label="Gallery photos"
          help={`JPG, PNG, or WebP. Up to 10 MB each · up to ${MAX_PHOTOS} photos. Drag to add more; remove any you don't want before saving.`}
        />
        <SubmitButton pendingLabel="Saving…" className="button-primary">Save gallery</SubmitButton>
      </form>
    </section>
  );
}
