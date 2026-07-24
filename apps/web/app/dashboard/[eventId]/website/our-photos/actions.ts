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
