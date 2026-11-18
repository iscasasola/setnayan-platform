import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  albumMatches,
  albumRowHeading,
  albumRowLine,
  albumViewsLabel,
  portfolioAlbums,
  portfolioSortIsOn,
  showKeepsAlbum,
  showKeepsWay,
  sortAlbums,
  type AlbumStats,
} from './portfolio-albums';
import { eventAlbums, inspirationAlbums, serviceAlbums, type PortfolioGroups } from './portfolio-groups';

/**
 * 🖼 Portfolio, simpler (owner 2026-11-19) — Row 1's albums, the Show filter, the Sort, and Search by place.
 * Each test names the owner's rule it holds. Tests 3, 5 and 8 were seen RED against a deliberate break (nulls sorted first; place words ignored).
 */
const groups: PortfolioGroups = {
  events: eventAlbums(
    [
      { eventId: 'e-old', url: 'old.jpg', createdAt: '2026-05-01T00:00:00Z' },
      { eventId: 'e-new', url: 'new.jpg', createdAt: '2026-11-01T00:00:00Z' },
    ],
    [
      { eventId: 'e-old', eventName: 'Reyes debut', bookedDate: '2026-05-01' },
      { eventId: 'e-new', eventName: 'Santos · Dela Cruz', bookedDate: '2026-11-01' },
    ],
    {
      thisYear: 2026,
      albumHref: null,
      facts: new Map([['e-new', { venue: 'Taal Vista Hotel', address: 'Tagaytay City, Cavite', services: ['Full styling'] }]]),
    },
  ),
  services: serviceAlbums(
    [
      { id: 's-quiet', title: 'Lights', urls: ['l.jpg'], total: 1 },
      { id: 's-busy', title: 'Full styling', urls: ['f.jpg'], total: 3 },
      { id: 's-bare', title: 'No photo', urls: [], total: 0 },
    ],
    new Map([['s-busy', 'Taal Vista Hotel · Tagaytay City, Cavite']]),
  ),
  inspiration: inspirationAlbums([{ id: 'look-1', url: 'i.jpg', part: 'Ceiling' }], new Map([['look-1', 'Wedding · Taal Vista Hotel · Nov 2026']])),
  stories: [],
};
const page = { title: 'On my page', line: '4 photos', urls: ['p.jpg'] };
const stats: AlbumStats = { serviceOpens: { 's-busy': 212, 's-quiet': 3 }, pageViews: 96, opened: { 'event:e-old': '2026-11-18T10:00:00Z', 'service:s-quiet': '2026-11-19T10:00:00Z' } };
const all = portfolioAlbums(groups, page, stats);
const ids = (list: ReturnType<typeof sortAlbums>) => list.map((a) => `${a.kind}:${a.key}`);

test('1 · Row 1 is every album that holds a photo — the page, each event, each card with a photo, each part', () => {
  assert.deepEqual(ids(all), ['page:page', 'event:e-new', 'event:e-old', 'service:s-quiet', 'service:s-busy', 'inspiration:Ceiling']);
});

test('2 · "Most viewed" reads the shipped counters only — an event or inspiration album has NO count, never 0', () => {
  const by = Object.fromEntries(all.map((a) => [`${a.kind}:${a.key}`, a.views]));
  assert.equal(by['service:s-busy'], 212);
  assert.equal(by['page:page'], 96);
  assert.equal(by['event:e-new'], null);
  assert.equal(by['inspiration:Ceiling'], null);
  assert.equal(albumViewsLabel(null), null, 'an uncounted album wears no badge');
  assert.equal(albumViewsLabel(0), '0 views', 'a counted album nobody opened says 0 — that one is measured');
  assert.equal(albumViewsLabel(1), '1 view');
});

test('3 · most viewed first; the uncounted albums come AFTER every counted one, in the order they were listed', () => {
  assert.deepEqual(ids(sortAlbums(all, 'most')), ['service:s-busy', 'page:page', 'service:s-quiet', 'event:e-new', 'event:e-old', 'inspiration:Ceiling']);
});

test('4 · "Opened by you" = the albums this shop opened last, first; never-opened ones after', () => {
  assert.deepEqual(ids(sortAlbums(all, 'opened')).slice(0, 2), ['service:s-quiet', 'event:e-old']);
});

test('5 · "Newest" = the album with the newest photo first', () => {
  assert.equal(ids(sortAlbums(all, 'newest'))[0], 'event:e-new');
});

test('6 · a refused count is "not read", never 0 — and the line says so', () => {
  const unread = portfolioAlbums(groups, page, { serviceOpens: null, pageViews: null, opened: null });
  assert.ok(unread.every((a) => a.views === null && a.openedAt === null));
  assert.match(albumRowLine('most', { serviceOpens: null, pageViews: null, opened: null }), /Couldn’t load/);
  assert.equal(albumRowLine('most', stats), 'by couples');
});

test('7 · Show is a FILTER, All by default; the Sort round wears its dot only off the defaults', () => {
  assert.ok(showKeepsAlbum('all', 'page') && showKeepsAlbum('all', 'event'));
  assert.ok(showKeepsAlbum('events', 'event') && !showKeepsAlbum('events', 'service') && !showKeepsAlbum('events', 'page'));
  assert.ok(!showKeepsAlbum('videos', 'event'), 'videos have no albums');
  assert.ok(showKeepsWay('all', 'videos') && showKeepsWay('videos', 'videos') && !showKeepsWay('videos', 'events'));
  assert.equal(portfolioSortIsOn('all', 'most'), false);
  assert.equal(portfolioSortIsOn('events', 'most'), true);
  assert.equal(portfolioSortIsOn('all', 'newest'), true);
});

test('8 · typing a place finds the event there, the card booked there and the look tagged there (owner: "tagaytay")', () => {
  const found = ids(all.filter((a) => albumMatches(a, 'tagaytay')));
  assert.deepEqual(found, ['event:e-new', 'service:s-busy']);
  const venue = ids(all.filter((a) => albumMatches(a, 'taal vista')));
  assert.deepEqual(venue, ['event:e-new', 'service:s-busy', 'inspiration:Ceiling']);
  assert.ok(all.every((a) => albumMatches(a, '  ')), 'no words keep everything');
  assert.deepEqual(ids(all.filter((a) => albumMatches(a, 'reyes'))), ['event:e-old'], 'and a name still finds its album');
});

test('9 · an event says its venue and the cards booked at it; Row 1’s heading follows the Sort', () => {
  const ev = groups.events!.find((a) => a.key === 'e-new')!;
  assert.equal(ev.place, 'Taal Vista Hotel');
  assert.deepEqual(ev.services, ['Full styling']);
  assert.match(ev.line, /Taal Vista Hotel/);
  assert.equal(albumRowHeading('most'), 'Most viewed albums');
  assert.equal(albumRowHeading('opened'), 'Albums you opened');
  assert.equal(albumRowHeading('newest'), 'Newest albums');
});
