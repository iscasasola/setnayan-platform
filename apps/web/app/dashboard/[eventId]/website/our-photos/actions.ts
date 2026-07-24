'use server';

/**
 * Server action for the Our Photos editor (Increment A.4 ·
 * Wedding_Website_Lifecycle_Spec_2026-06-07 §6.5). Writes events.our_photos
 * (JSONB array of r2:// refs, shipped 20260919000000) — the couple's own
 * curated gallery (engagement / pre-wedding shots) shown on the invitation.
 *
 * File bytes are PUT directly to R2 by the <FileUpload> client component via
 * the /api/upload presigned endpoint (images are already whitelisted there —
 * no shared-route change). By the time this runs the photos are in R2 and the
 * form carries one `photos` field per uploaded ref. We persist the ordered
 * array. Empty array → OurPhotosWidget on /[slug] renders nothing.
 *
 * Auth mirrors the hero-photo editor: host membership via event_moderators
 * (canonical) OR the legacy event_members couple row. The R2 objects for
 * removed photos are left in the bucket (cheap to keep; a future sweep cron
 * can prune orphans) — same policy as removeHeroPhoto.
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireHostMembership } from '@/lib/host-gate';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { revalidateGuestSite, revalidateWebsiteEditor } from '@/lib/revalidate-site';

/** Hard cap on the gallery size — keeps the page light + bounds R2 cost. */
const MAX_PHOTOS = 24;

export async function updateOurPhotos(
  eventId: string,
  formData: FormData,
): Promise<void> {
  await requireHostMembership(eventId);

  // The multi-file <FileUpload> emits one hidden input named `photos` per
  // uploaded ref, in insertion order. Keep only well-formed r2:// refs,
  // de-dupe, and cap the gallery size.
  const refs = formData
    .getAll('photos')
    .filter((v): v is string => typeof v === 'string' && v.startsWith('r2://'));
  const deduped = Array.from(new Set(refs)).slice(0, MAX_PHOTOS);

  const supabase = await createClient();

  // ── Website PRO gate + grandfather (owner 2026-07-24 · Launch settings §3) ──
  // Defense-in-depth mirror of the page gate: a couple that is NOT PRO and has
  // NO existing gallery can't create one via a crafted POST. A couple that
  // already curated photos (grandfathered) OR owns PRO edits freely. Fail-open
  // on a throwing entitlement read (treat as owned) so a real couple is never
  // blocked from their own content.
  const proActive = await eventCoupleWebsiteProActive(supabase, eventId).catch(() => true);
  if (!proActive) {
    const { data: existing } = await supabase
      .from('events')
      .select('our_photos')
      .eq('event_id', eventId)
      .maybeSingle();
    const hadContent =
      Array.isArray(existing?.our_photos) &&
      existing.our_photos.some(
        (r): r is string => typeof r === 'string' && r.startsWith('r2://'),
      );
    if (!hadContent) redirect(`/dashboard/${eventId}/studio/website-pro`);
  }

  const { data: event, error } = await supabase
    .from('events')
    .update({ our_photos: deduped })
    .eq('event_id', eventId)
    .select('slug')
    .maybeSingle();

  if (error) {
    redirect(
      `/dashboard/${eventId}/website/our-photos?error=${encodeURIComponent(
        'Could not save. Please try again.',
      )}`,
    );
  }

  revalidateWebsiteEditor(eventId, 'our-photos');
  revalidateGuestSite(event?.slug);
  redirect(`/dashboard/${eventId}/website/our-photos?saved=1`);
}
