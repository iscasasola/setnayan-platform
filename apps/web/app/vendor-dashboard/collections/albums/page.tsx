import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorRoomEventsDetailed } from '@/lib/vendor-room-access';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import { formatCount } from '@/lib/format-number';
import { ShopSegments } from '../../shop/_components/shop-segments';
import { DatesRow } from '../../customers/_components/dates-row';
import { albumEventRows } from '@/lib/album-event-rows';

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
export default async function AlbumsByEventPage() {
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
      <ShopSegments on="page" />
      <h1 className="sn-h1">Albums by event</h1>
      <p className="text-[15px] text-ink/70">
        Only you see these. Open one and tap <b className="font-semibold text-ink">Put on my page</b> on a photo.
      </p>
      {!papicOn ? (
        <p className="rounded-xl bg-ink/5 p-3 text-sm text-ink/70" data-albums-off="">
          Albums open here once Papic for suppliers is switched on.
        </p>
      ) : upcoming.length + past.length === 0 ? (
        <p className="text-sm text-ink/60">No booked events yet — an album fills when a couple shares their Papic photos with you.</p>
      ) : (
        <>
          {!room.complete ? (
            <p role="status" className="text-[13px] text-ink/60">Some bookings could not be read just now — the list may be short.</p>
          ) : null}
          {past.length > 0 ? (
            <div>
              <h2 className="sn-eye">Past · {formatCount(past.length)}</h2>
              <div className="divide-y divide-ink/10">{past.map(row)}</div>
            </div>
          ) : null}
          {upcoming.length > 0 ? (
            <div>
              <h2 className="sn-eye">Coming up · {formatCount(upcoming.length)}</h2>
              <div className="divide-y divide-ink/10">{upcoming.map(row)}</div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
