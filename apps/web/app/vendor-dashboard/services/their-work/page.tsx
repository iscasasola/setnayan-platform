import { notFound, redirect } from 'next/navigation';
import { BackButton } from '@/app/_components/back-button';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { cardRecordEnabled } from '@/lib/card-record-flag';
import { readShopWork } from '@/lib/card-portfolio-albums.server';
import { ALBUM_STRIP_MAX, albumLine, bookedOnRows, workAlbumAnchor } from '@/lib/card-portfolio-albums';
import { TheirWorkList, type TheirOwnUploadsView } from './their-work-list';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { logQueryError } from '@/lib/supabase/error-detect';
import { cardName } from '@/lib/card-portfolio-albums';
import type { SupabaseClient } from '@supabase/supabase-js';

export const metadata = { title: 'Their work' };

/**
 * /vendor-dashboard/services/their-work — THEIR WORK, EACH ALBUM NAMING THE CARD(S) IT WAS BOOKED ON (frame 78 of the
 * approved service card maker drawing; DECISION_LOG 2026-10-08 "ONE ALBUM, TWO PLACES").
 *
 * One album per booked event, newest first, labelled type · venue · month (no names; a private event says "private
 * venue"). Under each, one **Booked on › card** row per card that event booked (a multi-card booking = several rows,
 * the same album by reference); a retired card keeps its name and carries a *retired* pill. A row opens that card's edit
 * sheet; a card's Portfolio row opens its album here (`#album-<event>`).
 *
 * Rides the card-record flag (`NEXT_PUBLIC_CARD_RECORD_ENABLED`): OFF → this page does not exist (404), so nothing new
 * shows. A refused read is said with Retry, never drawn as "no work yet".
 */
export default async function TheirWorkPage() {
  if (!cardRecordEnabled()) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const [work, own] = await Promise.all([
    readShopWork(createAdminClient(), { vendorProfileId: profile.vendor_profile_id }).catch(() => null),
    readOwnUploads(supabase, profile.vendor_profile_id),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-4 sm:px-6" data-their-work="">
      <div className="mb-2 flex min-h-11 items-center gap-2">
        <BackButton route="/vendor-dashboard/services/their-work" />
      </div>
      <h1 className="text-[22px] font-semibold text-ink">Their work</h1>
      <p className="mt-1 text-[14px] text-ink/60">Photos from the events this card was booked for</p>

      <TheirWorkList
        albums={
          work === null
            ? null
            : work.albums.map((a) => {
                const urls = a.photos.slice(0, ALBUM_STRIP_MAX).map((p) => p.url);
                const rows = bookedOnRows(a, work.cards);
                return {
                  anchor: workAlbumAnchor(a.eventId),
                  label: a.label,
                  line: albumLine(a.photos, { cards: rows.length }),
                  urls,
                  more: Math.max(0, a.photos.length - urls.length),
                  bookedOn: rows.map((r) => ({ ...r, href: `/vendor-dashboard/services/${r.serviceId}` })),
                };
              })
        }
        own={own}
        retryHref="/vendor-dashboard/services/their-work"
      />
    </div>
  );
}

/**
 * "Their own uploads" — the LAST row (frame 78): the live cards' own cover + showcase photos, the supplier's own, never
 * from an event. A refused read leaves the row off (it is the supplier's own media, already on each card's sheet).
 */
async function readOwnUploads(supabase: SupabaseClient, vendorProfileId: string): Promise<TheirOwnUploadsView | null> {
  const { data, error } = await supabase
    .from('vendor_services')
    .select('title, category, primary_photo_r2_key, showcase_photo_r2_keys')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('is_active', true);
  if (error) {
    logQueryError('theirWork.ownUploads', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const rows = (data ?? []) as { title: string | null; category: string; primary_photo_r2_key: string | null; showcase_photo_r2_keys: string[] | null }[];
  const refs: string[] = [];
  const from: string[] = [];
  for (const r of rows) {
    const mine = [r.primary_photo_r2_key, ...(r.showcase_photo_r2_keys ?? [])].filter((k): k is string => typeof k === 'string' && k.length > 0);
    if (mine.length === 0) continue;
    refs.push(...mine);
    from.push(cardName({ id: '', title: r.title, category: r.category, isActive: true }));
  }
  const unique = [...new Set(refs)];
  const urls = (await Promise.all(unique.slice(0, 4).map((k) => displayUrlForStoredAsset(k).catch(() => null)))).filter((u): u is string => Boolean(u));
  return { count: unique.length, urls, from };
}
