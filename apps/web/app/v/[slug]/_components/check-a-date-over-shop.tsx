import { readCheckADate } from '@/lib/check-a-date.server';
import { readCheckADateViewer } from '@/lib/check-a-date-viewer.server';
import { arrivalInquirySourceOf } from '@/lib/supplier-qr-codes';
import { CheckADateOverShopView, CheckADateUnreadableView } from './check-a-date-over-shop-view';

/**
 * 📅 The server half of Check a date over the shop (SHOP-02 v7). The shop page mounts this ONLY when its address carries
 * `?dates` and the shop is bookable (verified). It reads exactly what the old `/v/[slug]/dates` page read — the shop's
 * Not-bookable days (`readCheckADate`, request-cached) and the viewer's own events — and nothing about anyone's asks
 * (guard: `app/v/[slug]/dates/no-inquiry-reads.test.ts`).
 */
export async function CheckADateOverShop({
  slug,
  logoUrl,
  shopHref,
  search,
}: {
  slug: string;
  logoUrl: string | null;
  /** The shop page itself, carrying where the visit came from — where × lands on a cold arrival. */
  shopHref: string;
  search: { d?: string; s?: string; step?: string; src?: string; via?: string | null; utm?: string | null };
}) {
  const read = await readCheckADate(slug);
  if (read.kind === 'missing') return null;
  if (read.kind === 'unreadable') {
    const join = shopHref.includes('?') ? '&' : '?';
    return <CheckADateUnreadableView shopHref={shopHref} retryHref={`${shopHref}${join}dates=1`} />;
  }
  const viewer = await readCheckADateViewer(read.today);
  const day = typeof search.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.d) ? search.d : null;
  const picked = typeof search.s === 'string' ? search.s.split(',').map((x) => x.trim()).filter(Boolean) : [];
  return (
    <CheckADateOverShopView
      shopHref={shopHref}
      shop={read.shop}
      logoUrl={logoUrl}
      // 🖨💳 The plan half (only Ultra's prints are own) is judged again at send, with the piece — see the shop page.
      inquirySource={arrivalInquirySourceOf(search.src)}
      inquiryVia={search.via ?? null}
      inquiryUtm={search.utm ?? null}
      services={read.services}
      today={read.today}
      to={read.to}
      notBookable={read.notBookable}
      perService={read.perService}
      signedIn={viewer.signedIn}
      events={viewer.events}
      initialDay={day}
      initialServices={picked}
      initialStep={search.step === 'event' && day ? 'event' : null}
    />
  );
}
