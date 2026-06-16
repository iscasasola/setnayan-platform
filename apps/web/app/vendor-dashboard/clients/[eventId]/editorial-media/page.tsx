import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { findRecommendedEventVendorId } from '@/lib/editorial-vendor-media';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { EditorialMediaStudio, type ExistingMedia } from './_components/editorial-media-studio';

export const metadata = { title: 'Editorial media · Vendor' };

/**
 * Vendor "From Your Vendors" submit surface (iteration 0046, Inc 2). Visible
 * only to the couple's RECOMMENDED pick (event_vendors.selection_match_rank=1)
 * for a category on this event. They add up to 3 photos + 3 five-second clips
 * of their day-of service; clips bake to a boomerang in the browser. The media
 * auto-shows on the couple's editorial once it clears the NSFW screen.
 */
export default async function VendorEditorialMediaPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const admin = createAdminClient();
  const eventVendorId = await findRecommendedEventVendorId(admin, eventId, profile.vendor_profile_id);

  const { data: ev } = await admin
    .from('events')
    .select('display_name')
    .eq('event_id', eventId)
    .maybeSingle();
  const eventName = (ev?.display_name as string | null) ?? 'this wedding';

  // Existing submissions by this vendor on this event (any moderation state —
  // the vendor sees their own pending/blocked rows with a status).
  let existing: ExistingMedia[] = [];
  if (eventVendorId) {
    const { data: rows } = await admin
      .from('editorial_vendor_media')
      .select('media_id, media_type, still_r2_key, boomerang_r2_key, caption, moderation_state, hidden_by_couple')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    existing = await Promise.all(
      ((rows ?? []) as Array<Record<string, unknown>>).map(async (r) => ({
        mediaId: String(r.media_id),
        type: r.media_type === 'clip' ? ('clip' as const) : ('photo' as const),
        stillUrl: (await displayUrlForStoredAsset(String(r.still_r2_key ?? ''))) ?? '',
        boomerangUrl:
          r.media_type === 'clip'
            ? await displayUrlForStoredAsset(String(r.boomerang_r2_key ?? ''))
            : null,
        caption: (r.caption as string | null) ?? null,
        moderationState: String(r.moderation_state ?? 'unscreened'),
        hiddenByCouple: Boolean(r.hidden_by_couple),
      })),
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href={`/vendor-dashboard/clients/${eventId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Event brief
      </Link>

      <header className="space-y-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <Sparkles aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">From your camera</h1>
        <p className="max-w-prose text-base text-ink/65">
          Add a few of your favourite shots from {eventName} — up to <strong>3 photos</strong> and{' '}
          <strong>3 short clips</strong>. They appear in a “From your vendors” strip on the couple’s
          editorial, credited to you. Clips loop as a seamless boomerang.
        </p>
      </header>

      {eventVendorId ? (
        <EditorialMediaStudio eventId={eventId} existing={existing} />
      ) : (
        <div className="rounded-2xl border border-ink/10 bg-cream p-6">
          <h2 className="text-lg font-semibold">Not available for this event yet</h2>
          <p className="mt-2 text-sm text-ink/65">
            “From your vendors” is open to the couple’s recommended vendor for a category. Once
            you’re the couple’s confirmed pick here, you’ll be able to add your photos and clips to
            their editorial.
          </p>
        </div>
      )}
    </section>
  );
}
