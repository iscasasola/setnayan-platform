/**
 * 🏅 Shop › Badges is the approved v84 shelf (lib/shop-badge-shelf.ts) — owner 17 Nov: "old pop ups of badges".
 *   1 · the row is exactly Setnayan Verified + the five v84 badges — no retired tile;
 *   2 · each tier draws its own v84 picture, and every picture is a real file under public/badges/v84;
 *   3 · honest states: unread is "Couldn't load", Invites is "Not counted yet", below Bronze is locked with a count;
 *   4 · nothing of the old sheet is lost: Now · progress · Next goal · reward · what it counts are all lines;
 *   5 · the row component opens the award kit's full screens, and the locked look rises.
 *   6 · the Shop header's "Next badge" IS the Completed bookings tile's goal — one ladder, one goal (W1 F2);
 *   7 · a sheet says what a badge counts ONCE (W1 F1: the not-earned Verified sheet printed its line twice).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { BADGE_ART_BOX, COULDNT_LOAD, NOT_COUNTED_YET, SHELF_FAMILY, VERIFIED_HOW, badgeArtFit, badgeArtSrc, shelfLines, shelfNextBadgeLine, shopBadgeShelf } from './shop-badge-shelf';
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
  assert.match(src, /<ShopDoorScreen\b/); // the ONE RiseScreen on a phone, the 440 right panel from 701 (main, 16 Nov)
  assert.match(src, /<ProgressRing\b/);
  assert.match(src, /loading="lazy"/);
  assert.match(src, /width=\{BADGE_ART_W\}\s+height=\{BADGE_ART_H\}/);
  assert.doesNotMatch(src, /ImageBadge|shop-badge-row'/, 'the old badge art is back');
});

test('6 · the Shop header’s "Next badge" is the Completed bookings tile’s own goal, at every count', () => {
  // The fault: the header read the retired events ladder ("10 events · 10 to go") while the tile said "Bronze at 5".
  const zero = shopBadgeShelf({ counts: counts({ completedBookings: 0, completedEvents: 0 }), verified: false, granted: [] });
  assert.equal(shelfNextBadgeLine(zero), 'Next badge: Bronze at 5 bookings · 5 to go');
  for (const n of [0, 1, 4, 5, 9, 10, 24, 25, 63, 99, 100, 249, 999]) {
    const tiles = shopBadgeShelf({ counts: counts({ completedBookings: n, completedEvents: n + 7 }), verified: true, granted: [] });
    const cb = tiles.find((t) => t.key === 'completed_bookings')!;
    const m = /^Next goal: (.+) — (.+) to go$/.exec(cb.next ?? '');
    assert.ok(m, `${n}: the tile has no next goal`);
    // Same tier, same step, same "to go" — and nothing from the events count (which is deliberately different here).
    assert.equal(shelfNextBadgeLine(tiles), `Next badge: ${m![1]} · ${m![2]} to go`, `${n}: the header and the tile disagree`);
  }
  // At the top, unread, and no row at all: the header says nothing rather than a guess.
  const top = shopBadgeShelf({ counts: counts({ completedBookings: 1000 }), verified: true, granted: [] });
  assert.equal(shelfNextBadgeLine(top), null);
  assert.equal(shelfNextBadgeLine(shopBadgeShelf({ counts: null, verified: true, granted: [] })), null);
  assert.equal(shelfNextBadgeLine(null), null);
  // Both Shop callers hand the header the shelf — never a ladder of their own.
  for (const f of ['app/vendor-dashboard/shop/page.tsx', 'app/dev/supplier-lab/shop-tab-lab.tsx']) {
    const src = stripComments(readFileSync(join(WEB, f), 'utf8'));
    assert.match(src, /nextBadge: shelfNextBadgeLine\((?:badges|tiles)\)/, `${f}: the header's next badge is not the tile's goal`);
    assert.doesNotMatch(src, /nextBadgeShort|nextToEarnLine/, `${f}: a second ladder feeds the header`);
  }
});

test('7 · a sheet says what a badge counts once', () => {
  const row = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/shop/_components/shop-badge-row.tsx'), 'utf8'));
  // The locked tile says `takes` (the next goal, else `how`); the plain line repeats `how` only when it differs.
  assert.match(row, /\{takes !== tile\.how \? <p [^>]*>\{tile\.how\}<\/p> : null\}/, 'the sheet repeats what the locked tile already says');
  const v = shopBadgeShelf({ counts: counts(), verified: false, granted: [] }).find((t) => t.key === 'verified')!;
  assert.equal(v.next, null, 'Verified grew a next goal — its sheet would say a different line');
  assert.equal(v.how, VERIFIED_HOW);
});

test('8 · every badge draws at one size, centred in its ring, the lock at the edge (owner 18 Nov)', () => {
  // The measured boxes: seven per family, each inside the 300 × 286 canvas.
  for (const fam of Object.values(SHELF_FAMILY)) {
    const boxes = BADGE_ART_BOX[fam];
    assert.equal(boxes.length, 7, `${fam}: a tier has no measured box`);
    for (const [x0, y0, x1, y1] of boxes) assert.ok(x0 >= 0 && y0 >= 0 && x1 <= 300 && y1 <= 286 && x1 > x0 && y1 > y0, `${fam}: a box is off the canvas`);
  }
  // Fitted into a 54 px square, every tier's DRAWN badge is 54 px on its long side and centred both ways.
  for (const fam of Object.values(SHELF_FAMILY)) {
    for (let t = 1; t <= 7; t++) {
      const fit = badgeArtFit(badgeArtSrc(fam, t), 54)!;
      const [x0, y0, x1, y1] = BADGE_ART_BOX[fam][t - 1]!;
      const s = fit.width / 300;
      const l = fit.left + x0 * s, r = fit.left + x1 * s, tp = fit.top + y0 * s, b = fit.top + y1 * s;
      assert.ok(Math.abs(Math.max(r - l, b - tp) - 54) < 0.6, `${fam}-${t}: drawn at ${Math.max(r - l, b - tp)} px, not 54`);
      assert.ok(Math.abs(l - (54 - r)) < 0.6 && Math.abs(tp - (54 - b)) < 0.6, `${fam}-${t}: not centred`);
    }
  }
  assert.equal(badgeArtFit('/some/other.png', 54), null);
  // The row and the risen look both place the picture by its measured box; the lock is never over the art's middle.
  const row = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/shop/_components/shop-badge-row.tsx'), 'utf8'));
  assert.match(row, /badgeArtFit\(src, box\)/, 'the v84 picture is no longer placed by its measured box');
  assert.ok((row.match(/<FittedArt /g) ?? []).length >= 2, 'the row or the risen look draws the v84 picture at its canvas size again');
  assert.doesNotMatch(row, /top: size \* 0\.62/, 'the row lock is back over the badge face');
  const css = readFileSync(join(WEB, 'app/_components/award/award.module.css'), 'utf8');
  const lock = /\.lktLock \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(lock, /left: calc\(50% \+ \d+px\)/, 'the risen lock is back in the middle of the art');
});
