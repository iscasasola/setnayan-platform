import { Lock } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { r2SignedGet, R2_BUCKETS } from '@/lib/r2';
import { parseR2Ref } from '@/lib/nsfw-screen';
import { visiblePortfolioPhotos, portfolioAlbumSummary } from '@/lib/vendor-papic-portfolio-album';
import { PortfolioImportForm } from './portfolio-import-form';
import { PutOnMyPageButton } from '@/app/vendor-dashboard/collections/_components/put-on-my-page-button';
import { InfoTip } from '@/app/_components/info-tip';
import { SUPPLIER_PAGE_NOTICE_DAYS, supplierPageNoticeState, type SupplierPageNoticeRow, type SupplierPageNoticeState } from '@/lib/supplier-page-notice';

/**
 * "Your private portfolio" — a supplier's OWN imported work for THIS booked
 * event, spent out of their Papic credits. Deliberately its own section,
 * visibly separate from "What you've shot" (own-captures-strip.tsx) just
 * above it: that strip is the couple's gallery reflected back at the vendor
 * (their captures of somebody else's wedding, which the couple can also see
 * and take down); this album is never shown to the couple at all, lives under
 * its own storage prefix, and does not shrink when the couple moderates
 * anything of theirs.
 *
 * Read with the vendor's OWN client, never the admin one — same reasoning as
 * OwnCapturesStrip: the RLS policy (vendor_papic_portfolio_photos_vendor_read)
 * is the boundary, and a service-role read here would quietly replace it with
 * our own idea of one.
 */
export async function PortfolioAlbumSection({
  supabase,
  eventId,
  creditsLeft,
  canPutOnPage = false,
}: {
  supabase: SupabaseClient;
  eventId: string;
  /** null = unlimited (Unli tier); a number is what's left to spend. */
  creditsLeft: number | null;
  /** Owners and admins only — the page is an owner room, and `putAlbumPhotoOnMyPage` refuses everyone else. */
  canPutOnPage?: boolean;
}) {
  const { data, error } = await supabase
    .from('vendor_papic_portfolio_photos')
    .select('photo_id, event_id, r2_object_key, credits_spent, created_at, hidden_at, nsfw_checked')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) console.error('[supabase-error] app/vendor-dashboard/on-the-day/live/[eventId]/_components/portfolio-album-section.tsx · from:vendor_papic_portfolio_photos.select', error);

  // A read failure must not read as "you've imported nothing" — same posture
  // as own-captures-strip.tsx.
  if (error) {
    return (
      <section id="portfolio" className="mt-8 scroll-mt-24 border-t pt-6" style={{ borderColor: 'var(--m-line)' }}>
        <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
          Couldn&rsquo;t load your portfolio just now. Your photos are safe — this is only
          the view.
        </p>
      </section>
    );
  }

  const photos = visiblePortfolioPhotos(data ?? []);

  // ⏳ Where each photo stands on the way to the page (the 7-day guest notice, owner 2026-10-03) — read under the
  // supplier's OWN session (`supplier_page_photo_notices_vendor_read`). A failed read offers the button again, and a
  // second tap is answered from the notice that exists (never a second one), so it can never re-start a window.
  const noticeByPhoto = new Map<string, { state: SupplierPageNoticeState; publicFrom: string }>();
  if (canPutOnPage && photos.length > 0) {
    const { data: notices, error: noticeErr } = await supabase
      .from('supplier_page_photo_notices')
      .select('photo_id, public_from, published_at, removed_at, removed_by, notice_id')
      .in('photo_id', photos.map((p) => p.photoId));
    if (noticeErr) console.error('[supabase-error] app/vendor-dashboard/on-the-day/live/[eventId]/_components/portfolio-album-section.tsx · from:supplier_page_photo_notices.select', noticeErr);
    for (const n of (notices ?? []) as (SupplierPageNoticeRow & { photo_id: string })[]) {
      noticeByPhoto.set(n.photo_id, { state: supplierPageNoticeState(n), publicFrom: n.public_from });
    }
  }

  // Same ref-vs-key trap as own-captures-strip.tsx: r2_object_key is a stored
  // `r2://bucket/key` reference, not a bare key, and must be parsed before
  // signing or every tile 404s in the browser with green CI.
  const tiles = await Promise.all(
    photos.map(async (p) => {
      const { key } = parseR2Ref(p.r2Key);
      return {
        photo: p,
        url: await r2SignedGet({ bucket: R2_BUCKETS.media, key, expiresIn: 3600 }).catch(() => null),
      };
    }),
  );

  const canImport = creditsLeft == null || creditsLeft >= 1;

  return (
    <section id="portfolio" className="mt-8 scroll-mt-24 border-t pt-6" style={{ borderColor: 'var(--m-line)' }}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--m-slate-3)' }}>
          Your private portfolio
        </h2>
        <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
          {portfolioAlbumSummary(photos)}
        </p>
      </div>
      <div className="mt-1 flex items-start gap-1.5 text-xs" style={{ color: 'var(--m-slate-3)' }}>
        <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        {/* Title + one short line; the rest in the ⓘ (house rule). The old line said "never their guests" — no longer
            true of a photo you put on your page: the event's guests are shown it first (owner 2026-10-03). */}
        <InfoTip label="Only you see this album. A photo you put on your page goes up after the guests’ notice." labelClassName="text-xs" align="start">
          Each photo you import spends one Papic credit. When you put one on your page, everyone at this event is told
          in their Event Hub and has {SUPPLIER_PAGE_NOTICE_DAYS} days to remove it. If nobody does, it goes up on your
          page by itself. A guest can still remove it later, and a photo taken down at a guest&rsquo;s request comes
          off your page too.
        </InfoTip>
      </div>

      <PortfolioImportForm eventId={eventId} canImport={canImport} />

      {tiles.length > 0 ? (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {tiles.map(({ photo, url }) => (
            <li key={photo.photoId} className="flex flex-col gap-1">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-ink/10">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : null}
              </div>
              {/* One tap puts THIS photo on your page (owner 2026-10-15, "SIX OWNER ANSWERS" (3)) — after the guests'
                  7-day notice (owner 2026-10-03); a copy in your page's gallery, the album keeps its private one. */}
              {canPutOnPage ? <PutOnMyPageButton photoId={photo.photoId} notice={noticeByPhoto.get(photo.photoId) ?? null} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
