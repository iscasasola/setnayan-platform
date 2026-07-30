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
 *
 * ── 🔴 NSFW SCREENING (added 2026-07-30 — this closed a LIVE hole) ────────────
 * `events.our_photos` is host-writable and renders on the PUBLIC guest page, and
 * until now nothing screened it. It was a named-deliberate exception in
 * `lib/security/events-column-privileges.ts` and the oldest open item on the
 * security register: arbitrary unscreened images, one host upload away from the
 * public internet.
 *
 * ⚠ WHY THIS SCREENS **SYNCHRONOUSLY**, against the house pattern. Papic captures
 * screen in the BACKGROUND via `after()` (see api/papic/guest-capture/route.ts)
 * because those rows carry `moderation_state`, start `'unscreened'`, and every
 * guest-facing surface excludes that state structurally — so a deferred verdict is
 * safe there. **`our_photos` has no such state.** It is a JSONB array of `r2://`
 * refs on `events`; the moment a ref is in the array the OurPhotosWidget renders
 * it. A deferred screen would therefore have nothing to hold back, so the screen
 * has to happen BEFORE the write. Nothing unscreened is ever persisted, which
 * means the public page cannot show an unscreened image — a structural guarantee
 * rather than a filter someone must remember to apply.
 *
 * ⚠ AND IT FAILS **CLOSED**, also against the house convention.
 * `classifyImageBytes` documents "caller fail-opens", which is right for captures
 * (a failure leaves the row `unscreened` and thus hidden). Here fail-open would
 * mean *publishing* an unclassified image, so an undecodable file / unreachable
 * object / model-load failure REJECTS the photo and tells the host to retry. The
 * trade is deliberate: "that photo didn't save, try again" is a far cheaper
 * failure than an unscreened image live on a wedding's public page.
 *
 * Only NEW refs are screened — re-ordering or removing within an existing gallery
 * re-screens nothing, so the cost tracks what the host actually just uploaded.
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireHostMembership } from '@/lib/host-gate';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { revalidateGuestSite, revalidateWebsiteEditor } from '@/lib/revalidate-site';
import { resolveReturnTo } from '@/lib/editor-return';

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

  // The gallery as it stands. Needed for BOTH the PRO grandfather check below and
  // the NSFW screen (only NEW refs are screened), so it is read once here rather
  // than twice.
  const { data: currentRow } = await supabase
    .from('events')
    .select('our_photos')
    .eq('event_id', eventId)
    .maybeSingle();
  const currentRefs = Array.isArray(currentRow?.our_photos)
    ? (currentRow.our_photos as unknown[]).filter(
        (r): r is string => typeof r === 'string' && r.startsWith('r2://'),
      )
    : [];

  // ── Website PRO gate + grandfather (owner 2026-07-24 · Launch settings §3) ──
  // Defense-in-depth mirror of the page gate: a couple that is NOT PRO and has
  // NO existing gallery can't create one via a crafted POST. A couple that
  // already curated photos (grandfathered) OR owns PRO edits freely. Fail-open
  // on a throwing entitlement read (treat as owned) so a real couple is never
  // blocked from their own content.
  const proActive = await eventCoupleWebsiteProActive(supabase, eventId).catch(() => true);
  if (!proActive && currentRefs.length === 0) {
    redirect(`/dashboard/${eventId}/studio/website-pro`);
  }

  // ── NSFW screen, on the NEW refs only, BEFORE anything is persisted ─────────
  // See the module note: this surface has no `moderation_state` to hide behind, so
  // the verdict must precede the write and a failure must reject rather than pass.
  // Sequential on purpose — nsfwjs/tfjs decode is memory-hungry and a host submits
  // a handful of photos, not a batch.
  const newRefs = deduped.filter((ref) => !currentRefs.includes(ref));
  const blocked: string[] = [];
  if (newRefs.length > 0) {
    const [{ classifyImageBytes, decideNsfw, parseR2Ref }, { readR2Object }, { R2_BUCKETS }] =
      await Promise.all([
        import('@/lib/nsfw-screen'),
        import('@/lib/drive-upload'),
        import('@/lib/r2'),
      ]);
    for (const ref of newRefs) {
      try {
        const { bucket, key } = parseR2Ref(ref);
        const bytes = await readR2Object(key, bucket ?? R2_BUCKETS.media);
        if (decideNsfw(await classifyImageBytes(bytes)) === 'nsfw_blocked') blocked.push(ref);
      } catch {
        // Unreadable object, undecodable file, model-load failure — all reject.
        // Fail-open here would publish an unclassified image to a public page.
        blocked.push(ref);
      }
    }
  }
  const cleared = deduped.filter((ref) => !blocked.includes(ref));

  const { data: event, error } = await supabase
    .from('events')
    .update({ our_photos: cleared })
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

  // Say so plainly when something was rejected — a photo that silently vanishes
  // reads as a bug, and the host is the only one who can choose a different image.
  if (blocked.length > 0) {
    const note =
      blocked.length === 1
        ? "One photo couldn't be added — it didn't pass our automatic check. Please try a different image."
        : `${blocked.length} photos couldn't be added — they didn't pass our automatic check. Please try different images.`;
    redirect(
      `/dashboard/${eventId}/website/our-photos?error=${encodeURIComponent(note)}`,
    );
  }

  redirect(
    resolveReturnTo(formData, `/dashboard/${eventId}/website/our-photos?saved=1`, '?saved=1'),
  );
}
