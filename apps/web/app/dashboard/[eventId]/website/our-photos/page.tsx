import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { redirect } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { FileUpload } from '@/app/_components/file-upload';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { updateOurPhotos } from './actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel } from '@/lib/paid-mark';
import { HUB_DRAFT_FIELD } from '@/lib/hub-draft';
import { readHubDraft } from '@/lib/hub-draft-store';
import { PageMasthead } from '@/app/_components/page-masthead';
import { formatCount } from '@/lib/format-number';

export const metadata = { title: 'Photos you add' };

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
  searchParams: Promise<{ saved?: string; drafted?: string; error?: string }>;
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

  const liveRefs = Array.isArray(event.our_photos)
    ? (event.our_photos.filter(
        (r): r is string => typeof r === 'string' && r.startsWith('r2://'),
      ) as string[])
    : [];

  /* 💎 TRIED FREE, ASKED AT APPLY (owner 2026-09-28/29 — "◆ marks Pro and never
     blocks"). This page used to answer a free couple with nothing but "Unlock
     Event Hub PRO". Now every couple uploads and sees their gallery here; for a
     couple without Pro the form saves to the Event Hub DRAFT (`draft=1` —
     `updateOurPhotos` screens every photo first, then `draftEventsAndReturn`),
     guests see nothing yet, and the Maker's Apply sheet names the gallery and
     asks for Pro ("Unlock Pro and Apply"), screening each new photo again.
     A couple with Pro saves live, as before. The entitlement read failing
     treats the couple as free — the safe side is the draft, never a live write. */
  const proActive = await eventCoupleWebsiteProActive(await eventEntitlementClient(eventId), eventId).catch(() => false);
  let draftedRefs: string[] | null = null;
  if (!proActive) {
    try {
      const drafted = (await readHubDraft(supabase, eventId))?.events.our_photos;
      if (Array.isArray(drafted)) {
        draftedRefs = drafted.filter((r): r is string => typeof r === 'string' && r.startsWith('r2://'));
      }
    } catch {
      /* an unreadable draft shows what is live — never an empty gallery */
    }
  }
  const currentRefs = draftedRefs ?? liveRefs;
  const heldForPro = !proActive && draftedRefs !== null && JSON.stringify(draftedRefs) !== JSON.stringify(liveRefs);

  // Resolve each ref to a 24h presigned display URL so the uploader shows the
  // existing gallery thumbnails on mount.
  const resolved = await Promise.all(
    // 🔒 Held to the public bucket before signing (lib/site-media-ref.ts).
    currentRefs.map(
      async (ref) => [ref, await displayUrlForStoredAsset(siteMediaServeRef(ref))] as const,
    ),
  );
  const initialDisplayUrls: Record<string, string> = {};
  for (const [ref, url] of resolved) {
    if (url) initialDisplayUrls[ref] = url;
  }

  const updateAction = updateOurPhotos.bind(null, eventId);
  const saved = search.saved === '1';
  const drafted = search.drafted === '1';
  const error = search.error;

  return (
    <section className="space-y-6">
      <PageMasthead
        title="Photos you add"
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
        {!proActive ? (
          <p role={drafted ? 'status' : undefined} className="flex items-start gap-2 text-sm text-ink/70">
            <PaidMark state="try" label={paidMarkLabel('try', 'Event Hub Pro')} text="Pro" size="xs" />
            <span>
              {heldForPro || drafted
                ? 'Saved in your Event Hub draft. Guests see this gallery after you Apply with Event Hub Pro in your Event Hub Maker.'
                : 'Add your photos and see them here. Guests see the gallery after you Apply with Event Hub Pro in your Event Hub Maker.'}
            </span>
          </p>
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
        {!proActive ? (
          <>
            {/* To the draft — and back here, where the couple pressed Save. */}
            <input type="hidden" name={HUB_DRAFT_FIELD} value="1" />
            <input type="hidden" name="return_to" value={`/dashboard/${eventId}/website/our-photos?drafted=1`} />
          </>
        ) : null}
        <FileUpload
          bucket="media"
          pathPrefix={`events/${eventId}/our-photos`}
          name="photos"
          unsavedHint="press Save gallery below"
          multiple
          maxFiles={MAX_PHOTOS}
          maxSizeMB={10}
          acceptedTypes={['image/jpeg', 'image/jpg', 'image/png', 'image/webp']}
          currentValue={currentRefs}
          initialDisplayUrls={initialDisplayUrls}
          variant="wide"
          label="Photos you add"
          help={`JPG, PNG, or WebP. Up to 10 MB each · up to ${formatCount(MAX_PHOTOS)} photos. Drag to add more; remove any you don't want before saving.`}
        />
        <SubmitButton pendingLabel="Saving…" className="button-primary">Save gallery</SubmitButton>
      </form>
    </section>
  );
}
