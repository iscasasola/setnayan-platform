import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorRoomEventsDetailed } from '@/lib/vendor-room-access';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import { formatCount } from '@/lib/format-number';
import { TEMPLATE_SUBLINE, TemplateEmpty, TemplateSection } from '@/app/_components/template-rows';
import { ShopSegments } from '../../shop/_components/shop-segments';
import { DatesRow } from '../../customers/_components/dates-row';
import { albumEventRows } from '@/lib/album-event-rows';
import { shopGearBody } from '../../shop/_components/shop-settings-body';

export const metadata = { title: 'Albums by event' };

/** PH wall-clock today (UTC+8) as 'YYYY-MM-DD' — compared as a string, never through a Date of the booked day. */
function phToday(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * /vendor-dashboard/collections/albums — ALBUMS BY EVENT, ON ANY DAY (supplier batch walk, W3, 2026-10-15).
 *
 * "Put on my page" sits on each photo of an event's private album (`PortfolioAlbumSection`, on the event's Papic page,
 * which opens on ANY day — its shutter is day-bound, its album is not). But the only way IN was the on-the-day console,
 * which links today's booking alone, so the photos a couple shares AFTER the wedding could reach the page only by a
 * typed address. This list is that door: every event the shop is booked on, upcoming and past, each opening its album.
 *
 * 🔒 THE GATES STAY WHERE THEY ARE. This page links; the album page still asks every one of its own questions (the
 * counsel flag, signed in, booked on THIS event, the booking fee), and the album's own RLS stays the boundary. While
 * the counsel flag is off the album page never opens, so this list says so instead of offering a dead door.
 *
 * Reads: the shop's booked events (the same authorisation read the console uses) + ONE album read (event ids only) for
 * the counts — paid only when this screen is opened, never on Your collections itself.
 */
export default async function AlbumsByEventPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/vendor-dashboard/collections/albums');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const papicOn = await isVendorPapicCaptureEnabled();
  const [room, albumRes] = papicOn
    ? await Promise.all([
        fetchVendorRoomEventsDetailed(supabase, profile.vendor_profile_id),
        supabase
          .from('vendor_papic_portfolio_photos')
          .select('event_id')
          .eq('vendor_profile_id', profile.vendor_profile_id)
          .is('hidden_at', null),
      ])
    : [{ events: [], complete: true }, { data: [], error: null }];
  if (albumRes.error) logQueryError('AlbumsByEvent.counts', albumRes.error, { vendorId: profile.vendor_profile_id }, 'graceful_degrade');
  const counts = albumRes.error
    ? null
    : ((albumRes.data ?? []) as { event_id: string }[]).reduce<Record<string, number>>((m, r) => {
        m[r.event_id] = (m[r.event_id] ?? 0) + 1;
        return m;
      }, {});
  const { upcoming, past } = albumEventRows(room.events, counts, phToday());

  const row = (r: (typeof upcoming)[number]) => (
    <DatesRow
      key={r.eventId}
      data={`album-${r.eventId}`}
      title={r.title}
      line={r.line}
      href={`/vendor-dashboard/on-the-day/live/${r.eventId}/papic#portfolio`}
    />
  );

  return (
    <section className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-32 pt-4 sm:px-6" data-supplier-albums="">
      <ShopSegments on="gallery" gearBody={shopGearBody(sp)} />
      {/* Rule 1 — the pinned row names the page; the heading stays for a screen reader only. */}
      <h1 className="sr-only">Albums by event</h1>
      <p className={`text-[15px] ${TEMPLATE_SUBLINE}`}>
        Only you see these. Open one and tap <b className="font-semibold text-ink">Put on my page</b> on a photo.
      </p>
      {!papicOn ? (
        <TemplateEmpty data="albums-off">
          <span data-albums-off="">Albums open here once Papic for suppliers is switched on.</span>
        </TemplateEmpty>
      ) : upcoming.length + past.length === 0 ? (
        <TemplateEmpty data="albums">
          No booked events yet — an album fills when a couple shares their Papic photos with you.
        </TemplateEmpty>
      ) : (
        <>
          {!room.complete ? (
            <p role="status" className="text-[13px]" style={{ color: 'rgb(var(--color-warn))' }}>
              Some bookings could not be read just now — the list may be short.
            </p>
          ) : null}
          {past.length > 0 ? (
            <TemplateSection label="Past" first right={formatCount(past.length)}>
              <div className="divide-y divide-[color:var(--m-line)]">{past.map(row)}</div>
            </TemplateSection>
          ) : null}
          {upcoming.length > 0 ? (
            <TemplateSection label="Coming up" first={past.length === 0} right={formatCount(upcoming.length)}>
              <div className="divide-y divide-[color:var(--m-line)]">{upcoming.map(row)}</div>
            </TemplateSection>
          ) : null}
        </>
      )}
    </section>
  );
}
