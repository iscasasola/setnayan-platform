/**
 * 🃏📸 ONE ALBUM, TWO PLACES — lab fixtures (DEV-ONLY; no database). Built through the REAL pure rules
 * (`lib/card-portfolio-albums.ts`), so what the labs draw is what the read would hand them. Sample events, nobody real.
 */
import {
  ALBUM_STRIP_MAX,
  albumLine,
  bookedOnRows,
  cardAlbums,
  portfolioSummary,
  shopWorkAlbums,
  toAlbumViews,
  workAlbumAnchor,
  type AlbumEvent,
  type AlbumView,
  type CardRef,
  type ListedFileRow,
  type PageNoticeRow,
} from '@/lib/card-portfolio-albums';
import type { TheirWorkAlbumView } from '@/app/vendor-dashboard/services/their-work/their-work-list';

const NOW = new Date('2026-11-13T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const IMG = ['debut', 'birthday', 'anniversary', 'celebration', 'gala_night', 'graduation', 'christening', 'corporate'].map((k) => `/event-types/${k}.webp`);

const EVENTS = new Map<string, AlbumEvent>([
  ['lab-e1', { eventId: 'lab-e1', eventType: 'wedding', eventDate: '2026-09-19', venueName: 'Makati Shangri-La', isPrivate: false }],
  ['lab-e2', { eventId: 'lab-e2', eventType: 'debut', eventDate: '2026-08-08', venueName: 'Tagaytay Highlands', isPrivate: false }],
  ['lab-e3', { eventId: 'lab-e3', eventType: 'wedding', eventDate: '2026-06-13', venueName: 'a family garden', isPrivate: true }],
  ['lab-e4', { eventId: 'lab-e4', eventType: 'christening', eventDate: '2026-05-02', venueName: 'Quezon City', isPrivate: false }],
]);
export const LAB_CARD_ID = 'lab-full';
const CARDS = new Map<string, CardRef>([
  [LAB_CARD_ID, { id: LAB_CARD_ID, title: 'Full-day wedding coverage', category: 'photography', isActive: true }],
  ['lab-half', { id: 'lab-half', title: 'Half-day coverage', category: 'photography', isActive: true }],
  ['lab-sde', { id: 'lab-sde', title: 'Same-day edit', category: 'videography', isActive: true }],
  ['lab-booth', { id: 'lab-booth', title: 'Pabati booth', category: 'photo_booth', isActive: false }],
]);
const notices: PageNoticeRow[] = [];
const files: ListedFileRow[] = [];
const papic = (eventId: string, n: number, publishedDaysAgo: number) => {
  for (let i = 0; i < n; i++)
    notices.push({ photoId: `${eventId}-p${i}`, eventId, url: IMG[(i + eventId.length) % IMG.length]!, noticedAt: daysAgo(publishedDaysAgo + 8), publicFrom: daysAgo(publishedDaysAgo), publishedAt: daysAgo(publishedDaysAgo), removedAt: null, albumHiddenAt: null });
};
const filed = (eventId: string, serviceId: string, n: number) => {
  for (let i = 0; i < n; i++) files.push({ fileId: `${eventId}-${serviceId}-f${i}`, eventId, serviceId, url: IMG[(i + 3) % IMG.length]!, at: daysAgo(20 + i) });
};
papic('lab-e1', 41, 30);
filed('lab-e1', LAB_CARD_ID, 7);
filed('lab-e2', 'lab-half', 19);
filed('lab-e2', 'lab-sde', 12);
papic('lab-e4', 12, 120);
// A photo still inside its 7-day notice — the rules leave it out.
notices.push({ photoId: 'lab-waiting', eventId: 'lab-e1', url: IMG[0]!, noticedAt: daysAgo(2), publicFrom: new Date(NOW.getTime() + 5 * 86_400_000).toISOString(), publishedAt: null, removedAt: null, albumHiddenAt: null });

const WORK = shopWorkAlbums({
  pairs: [
    { serviceId: LAB_CARD_ID, eventId: 'lab-e1', delivered: true, via: 'booking' },
    { serviceId: 'lab-half', eventId: 'lab-e2', delivered: true, via: 'booking' },
    { serviceId: 'lab-sde', eventId: 'lab-e2', delivered: true, via: 'lock' },
    { serviceId: LAB_CARD_ID, eventId: 'lab-e3', delivered: true, via: 'booking' },
    { serviceId: 'lab-booth', eventId: 'lab-e4', delivered: true, via: 'booking' },
  ],
  events: EVENTS,
  notices,
  files,
  now: NOW,
});

/** The edit sheet's Portfolio (supplier side: each album opens in Their work). */
export const LAB_CARD_ALBUMS: AlbumView[] = toAlbumViews(cardAlbums(WORK, LAB_CARD_ID), {
  href: (id) => `/dev/card-maker-lab?s=edit&work=1#${workAlbumAnchor(id)}`,
});
export const LAB_CARD_SUMMARY = portfolioSummary(cardAlbums(WORK, LAB_CARD_ID));
/** The couple's grown card (no href, no ids). */
export const LAB_COUPLE_EVENT_WORK: AlbumView[] = toAlbumViews(cardAlbums(WORK, LAB_CARD_ID));
/** Their work (frame 78). */
export const LAB_THEIR_WORK: TheirWorkAlbumView[] = WORK.map((a) => {
  const urls = a.photos.slice(0, ALBUM_STRIP_MAX).map((p) => p.url);
  const rows = bookedOnRows(a, CARDS);
  return {
    anchor: workAlbumAnchor(a.eventId),
    label: a.label,
    line: albumLine(a.photos, { cards: rows.length }),
    urls,
    more: Math.max(0, a.photos.length - urls.length),
    bookedOn: rows.map((r) => ({ ...r, href: '/dev/card-maker-lab?s=edit' })),
  };
});
