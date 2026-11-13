import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { cardRecordEnabled } from '@/lib/card-record-flag';
import { readShopWork } from '@/lib/card-portfolio-albums.server';
import { ALBUM_STRIP_MAX, albumLine, bookedOnRows, workAlbumAnchor } from '@/lib/card-portfolio-albums';
import { formatCount } from '@/lib/format-number';

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

      {work === null ? (
        <p className="mt-4 flex min-h-11 items-center justify-between gap-3 text-[14px] text-ink/75" role="status" data-their-work-state="unread">
          <span>Couldn’t load your work</span>
          <Link href="/vendor-dashboard/services/their-work" className="sn-press inline-flex min-h-11 items-center font-medium text-sn-accent">
            Retry
          </Link>
        </p>
      ) : work.albums.length === 0 ? (
        <p className="mt-4 text-[14px] text-ink/65" data-their-work-state="none">
          Albums arrive on their own from the events your cards are booked for — the photos the couple showed, and your
          Papic album 7 days after the guests are told.
        </p>
      ) : (
        <ul className="mt-4 divide-y" style={{ borderColor: 'var(--m-line)' }}>
          {work.albums.map((a) => {
            const rows = bookedOnRows(a, work.cards);
            const urls = a.photos.slice(0, ALBUM_STRIP_MAX).map((p) => p.url);
            const more = Math.max(0, a.photos.length - urls.length);
            return (
              <li key={a.eventId} id={workAlbumAnchor(a.eventId)} className="scroll-mt-16 py-3" data-their-work-album="">
                <b className="block text-[15px] font-medium text-ink">{a.label}</b>
                <span className="block text-[13px] text-ink/60">{albumLine(a.photos, { cards: rows.length })}</span>
                {urls.length > 0 ? (
                  <ul className="mt-1.5 grid grid-cols-4 gap-0.5" aria-label={a.label}>
                    {urls.map((u, i) => (
                      <li key={u} className="relative aspect-square overflow-hidden rounded-md bg-ink/5">
                        {/* eslint-disable-next-line @next/next/no-img-element -- an already-resolved display URL */}
                        <img src={u} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
                        {more > 0 && i === urls.length - 1 ? (
                          <b className="absolute inset-0 grid place-items-center bg-black/40 text-[15px] font-semibold text-white">+{formatCount(more)}</b>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {rows.map((r) => (
                  <Link
                    key={r.serviceId}
                    href={`/vendor-dashboard/services/${r.serviceId}`}
                    className="sn-press mt-1 flex min-h-11 items-center justify-between gap-3"
                    data-their-work-booked-on={r.retired ? 'retired' : 'live'}
                  >
                    <span className="min-w-0">
                      <span className="block text-[12px] uppercase tracking-wide text-ink/50">Booked on</span>
                      <span className="block truncate text-[15px] text-ink">{r.name}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {r.retired ? (
                        <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[12px] font-medium text-ink/70">retired</span>
                      ) : null}
                      <ChevronRight aria-hidden className="h-4 w-4 text-sn-accent" strokeWidth={2} />
                    </span>
                  </Link>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
