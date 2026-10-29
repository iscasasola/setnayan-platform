/**
 * 📌 SHOP'S FIGURES — the three on each section's pinned row (supplier dashboard v13, APPROVED 2026-10-29; prototype
 * `tiles(...)` per section). Pure: every number is read by the page that draws it, from a store that already exists;
 * this only words them.
 *
 *   Details    verified · documents in · details done                 (`profile/details-data.ts`)
 *   Page       opened your page · 30 d · reviews · rating             (`website/page-data.ts`)
 *   Gallery    photos · videos · credits left                         (`collections/collections-data.ts`, the shop wallet)
 *   Analytics  opened your page · asked · booked, last 30 d vs before (`lib/vendor-funnel.ts`, the funnel's own counts)
 *   (Services is `lib/shop-services-summary.ts`.)
 *
 * The prototype's "seen in Find" has no store yet (Find records no impressions), so Page leads with "opened your page"
 * instead of inventing it. HONEST: a figure that could not be read is `value: null` — drawn "—", never 0
 * (`reads-are-honest.test.ts`). 🔒 lib/shop-section-figures.test.ts
 */
import { formatCount } from '@/lib/format-number';
import type { PinFigure } from '@/lib/pin-figure';

const n = (v: number) => formatCount(v);
const plural = (v: number | null, one: string, many: string) => (v === 1 ? one : many);

export function detailsFigures(f: { verified: boolean; docsIn: number; docsTotal: number; done: number; of: number }): PinFigure[] {
  return [
    { key: 'verified', value: f.verified ? '✓' : 'Not yet', word: 'verified', hot: !f.verified, href: '/vendor-dashboard/profile#docs' },
    { key: 'docs', value: `${n(f.docsIn)}/${n(f.docsTotal)}`, word: 'documents in', short: 'papers', hot: f.docsIn < f.docsTotal, href: '/vendor-dashboard/profile#docs' },
    { key: 'done', value: `${n(f.done)}/${n(f.of)}`, word: 'details done', short: 'done', hot: f.done < f.of, href: '/vendor-dashboard/profile' },
  ];
}

export function pageFigures(f: { views30: number | null; reviewCount: number | null; rating: number | null }): PinFigure[] {
  const rated = f.reviewCount !== null && f.reviewCount > 0 && f.rating !== null;
  return [
    { key: 'opened', value: f.views30 === null ? null : n(f.views30), word: 'opened · 30 d', short: 'opened', href: '/vendor-dashboard/performance' },
    { key: 'reviews', value: f.reviewCount === null ? null : n(f.reviewCount), word: plural(f.reviewCount, 'review', 'reviews'), href: '/vendor-dashboard/website#reviews' },
    // A shop with no reviews has no rating — said as "new", never a 0 ★ that reads like a bad score.
    { key: 'rating', value: f.reviewCount === null ? null : rated ? (f.rating as number).toFixed(1) : 'New', word: '★ rating', short: '★', href: '/vendor-dashboard/website#reviews' },
  ];
}

export function galleryFigures(f: { photos: number; videos: number; credits: number | null }): PinFigure[] {
  return [
    { key: 'photos', value: n(f.photos), word: plural(f.photos, 'photo', 'photos'), href: '/vendor-dashboard/collections#gallery-media' },
    { key: 'videos', value: n(f.videos), word: plural(f.videos, 'video', 'videos'), href: '/vendor-dashboard/collections#gallery-media' },
    { key: 'credits', value: f.credits === null ? null : n(f.credits), word: 'credits left', short: 'credits', href: '/vendor-dashboard/collections#gallery-media' },
  ];
}

export type FunnelCounts = { views: number; inquiries: number; booked: number };

/** "+3" / "−2" / "same" against the 30 days before — null when either window is unread (never a fake change). */
export function changeWord(now: number | null, before: number | null): string | null {
  if (now === null || before === null) return null;
  const d = now - before;
  return d === 0 ? 'same' : d > 0 ? `+${n(d)}` : `−${n(-d)}`;
}

export function analyticsFigures(now: FunnelCounts | null, before: FunnelCounts | null): PinFigure[] {
  const at = '/vendor-dashboard/performance#funnel';
  const fig = (key: keyof FunnelCounts, word: string, short: string): PinFigure => {
    const v = now ? now[key] : null;
    const ch = changeWord(v, before ? before[key] : null);
    return { key, value: v === null ? null : n(v), word: ch ? `${word} · ${ch}` : word, short, href: at };
  };
  return [fig('views', 'opened', 'opened'), fig('inquiries', 'asked', 'asked'), fig('booked', 'booked', 'booked')];
}
