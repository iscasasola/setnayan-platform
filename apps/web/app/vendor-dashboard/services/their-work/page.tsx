import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { cardRecordEnabled } from '@/lib/card-record-flag';
import { readShopWork } from '@/lib/card-portfolio-albums.server';
import { ALBUM_STRIP_MAX, albumLine, bookedOnRows, workAlbumAnchor } from '@/lib/card-portfolio-albums';
import { TheirWorkList } from './their-work-list';

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

  const work = await readShopWork(createAdminClient(), { vendorProfileId: profile.vendor_profile_id }).catch(() => null);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-4 sm:px-6" data-their-work="">
      <div className="mb-2 flex min-h-11 items-center gap-2">
        <Link href="/vendor-dashboard/shop" className="sn-press inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-sn-accent">
          <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
          Shop
        </Link>
      </div>
      <h1 className="text-[22px] font-semibold text-ink">Their work</h1>
      <p className="mt-1 text-[14px] text-ink/60">One album per event · newest first · type · venue · month · no names</p>

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
        retryHref="/vendor-dashboard/services/their-work"
      />
    </div>
  );
}
