/**
 * 🏅 Shop › Badges is the approved v84 shelf (lib/shop-badge-shelf.ts) — owner 17 Nov: "old pop ups of badges".
 *   1 · the row is exactly Setnayan Verified + the five v84 badges — no retired tile;
 *   2 · each tier draws its own v84 picture, and every picture is a real file under public/badges/v84;
 *   3 · honest states: unread is "Couldn't load", Invites is "Not counted yet", below Bronze is locked with a count;
 *   4 · nothing of the old sheet is lost: Now · progress · Next goal · reward · what it counts are all lines;
 *   5 · the row component opens the award kit's full screens, and the locked look rises.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { COULDNT_LOAD, NOT_COUNTED_YET, SHELF_FAMILY, badgeArtSrc, shelfLines, shopBadgeShelf } from './shop-badge-shelf';
import type { BadgeRewardFacts } from './badge-rewards';
import { SHOP_BADGE_KEYS } from './badge-tiers';

const WEB = join(import.meta.dirname, '..');
const counts = (over: Partial<BadgeRewardFacts> = {}): BadgeRewardFacts => ({
  verified: true,
  completedEvents: 70,
  trustedReviews: 40,
  firstSourcedBooking: true,
  branchIds: [],
  serviceCards: 3,
  inspirationPhotos: 0,
  awards: [],
  completedBookings: 63,
  fiveStarReviews: 12,
  giftPoints: 160,
  trustedBy: 0,
  invites: null,
  ...over,
});

test('1 · the row is Verified + the five v84 badges, nothing retired', () => {
  const tiles = shopBadgeShelf({ counts: counts(), verified: true, granted: [] });
  assert.deepEqual([...tiles.map((t) => t.key)].sort(), ['verified', ...SHOP_BADGE_KEYS].sort());
  for (const t of tiles) assert.doesNotMatch(t.title, /Booked Loop|1st Pick|Inspiration|Branches|Service cards|Rating|Business since|Monthly|Events/);
});

test('2 · each tier draws its own v84 picture, and the picture exists', () => {
  for (const k of SHOP_BADGE_KEYS) for (let t = 1; t <= 7; t++) assert.ok(existsSync(join(WEB, 'public', badgeArtSrc(SHELF_FAMILY[k], t))), `${k} tier ${t} has no art file`);
  const tiles = shopBadgeShelf({ counts: counts(), verified: true, granted: [] });
  const cb = tiles.find((t) => t.key === 'completed_bookings')!;
  assert.equal(cb.state, 'earned');
  assert.equal(cb.tierName, 'Gold'); // 63 ≥ 50
  assert.equal(cb.src, '/badges/v84/calendar-3.webp');
  assert.equal(tiles[0]!.state, 'earned', 'what is earned is not far left');
});

test('3 · honest states', () => {
  const unread = shopBadgeShelf({ counts: null, verified: null, granted: null });
  for (const t of unread.filter((t) => t.key !== 'invites')) assert.equal(t.sub, COULDNT_LOAD, `${t.key} unread is not "Couldn't load"`);
  const tiles = shopBadgeShelf({ counts: counts(), verified: false, granted: [] });
  assert.equal(tiles.find((t) => t.key === 'invites')!.sub, NOT_COUNTED_YET);
  const five = tiles.find((t) => t.key === 'five_star_reviews')!;
  assert.equal(five.state, 'locked');
  assert.equal(five.now, 'Now: 12 five-star reviews');
  const v = tiles.find((t) => t.key === 'verified')!;
  assert.equal(v.state, 'locked');
  assert.equal(v.door?.href, '/vendor-dashboard/profile#docs');
  // exactly one closest goal says "N to go"
  assert.equal(tiles.filter((t) => t.goal).length, 1);
  assert.match(tiles.find((t) => t.goal)!.sub, /^\d[\d,]* to go$/);
});

test('4 · nothing of the old sheet is lost', () => {
  const cb = shopBadgeShelf({ counts: counts(), verified: true, granted: [] }).find((t) => t.key === 'completed_bookings')!;
  const lines = shelfLines(cb);
  assert.ok(lines.includes('Now: 63 bookings'));
  assert.ok(lines.some((l) => /^\d+% of the way to Ruby$/.test(l)), 'no progress line');
  assert.ok(lines.includes('Next goal: Ruby at 100 bookings — 37 to go'));
  assert.ok(lines.some((l) => /→/.test(l)), 'no reward line');
  assert.ok(lines.some((l) => /Bookings you import don’t count/.test(l)), 'no "what it counts" line');
});

test('5 · the row opens the award kit and lazy-loads the art', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/shop/_components/shop-badge-row.tsx'), 'utf8'));
  assert.match(src, /<BadgeFullscreen\b/);
  assert.match(src, /<VerifiedFullscreen\b/);
  assert.match(src, /<LockedTile\b/);
  assert.match(src, /<RiseScreen\b/);
  assert.match(src, /<ProgressRing\b/);
  assert.match(src, /loading="lazy"/);
  assert.match(src, /width=\{BADGE_ART_W\}\s+height=\{BADGE_ART_H\}/);
  assert.doesNotMatch(src, /ImageBadge|shop-badge-row'/, 'the old badge art is back');
});
