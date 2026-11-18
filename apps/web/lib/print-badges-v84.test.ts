/**
 * 🖨 WHAT A PRINT WEARS — only the approved v84 badges (owner 15 Nov 2026), each retired pill mapped to its v84
 * equivalent or removed (`lib/print-badges-v84.ts`), and the art the prints place is the approved art itself.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { BadgeRewardFacts } from './badge-rewards';
import { printBadgesV84, printBadgeListItem, printBadgeWords, type PrintBadge } from './print-badges-v84';
import { resolvePrintBadgeArt } from './print-badge-art';
import { sealPrintSvg, SEAL_ART_OF } from './print-seal-art';
import { PRINT_SEAL_SVG } from './print-seal-art.generated';
import { badgeArtSrc, shelfBadge } from './shop-badge-shelf';
import { STORED_SEALS } from './shop-seals';

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
const keys = (b: PrintBadge[]) => b.map((x) => x.key);

test('the retired pills map to their v84 equivalent: events → Completed bookings, ★ → Five-star reviews, at their tier', () => {
  const worn = printBadgesV84({ verified: true, counts: counts({ fiveStarReviews: 60 }), seals: [] });
  assert.deepEqual(keys(worn), ['verified', 'completed_bookings', 'five_star_reviews', 'gifts_given']);
  for (const b of worn) {
    if (b.kind !== 'tier') continue;
    const tile = shelfBadge(b.key, { counts: counts({ fiveStarReviews: 60 }), verified: true, granted: null });
    assert.equal(tile.state, 'earned');
    assert.equal(b.tier, tile.tier, `${b.key} prints a tier the shelf does not show`);
    assert.equal(badgeArtSrc(b.family, b.tier), tile.src, `${b.key} prints a picture the shelf does not show`);
  }
});

test('years in business and the monthly awards have NO v84 badge — they never print as one', () => {
  const worn = printBadgesV84({ verified: true, counts: counts({ awards: [{ type: 'top_pick', periodMonth: '2026-10-01' }] as BadgeRewardFacts['awards'] }), seals: [] });
  assert.ok(worn.every((b) => ['verified', 'tier', 'seal'].includes(b.kind)));
  assert.ok(!worn.some((b) => /years|award|milestone|rating/.test(b.key)));
});

test('only an EARNED tier prints — locked, unread and not-counted badges never do', () => {
  assert.deepEqual(keys(printBadgesV84({ verified: false, counts: counts({ completedBookings: 4, fiveStarReviews: 0, giftPoints: 0 }), seals: [] })), []);
  assert.deepEqual(keys(printBadgesV84({ verified: true, counts: null, seals: null })), ['verified'], 'unread counts: no tier, never a guess');
  assert.ok(!keys(printBadgesV84({ verified: true, counts: counts({ invites: 999 }), seals: [] })).includes('invites'), 'Invites is not counted yet');
});

test('the seals print in the flow order; Verified Partner replaces Setnayan Verified; one year per seal', () => {
  const worn = printBadgesV84({
    verified: true,
    counts: null,
    seals: [
      { seal: 'most_in_demand', award_year: 2026 },
      { seal: 'top10', award_year: 2026 },
      { seal: 'top10', award_year: 2027 },
      { seal: 'verified_partner', award_year: 2026 },
    ],
  });
  assert.deepEqual(keys(worn), ['top10', 'most_in_demand', 'verified_partner']);
  assert.equal((worn[0] as Extract<PrintBadge, { kind: 'seal' }>).year, 2027, 'the newest year');
  assert.deepEqual(keys(printBadgesV84({ verified: true, counts: null, seals: [{ seal: 'no1', award_year: 2026 }, { seal: 'top10', award_year: 2026 }] })), ['no1', 'verified'], 'No. 1 IS that year’s Top 10');
  assert.equal(printBadgeWords(worn[0]!), 'Top 10 Supplier 2027');
});

test('the sheet lists each badge with the picture it prints', () => {
  const [v, t] = printBadgesV84({ verified: true, counts: counts(), seals: [] });
  assert.equal(printBadgeListItem(t!).src, '/badges/v84/calendar-3.webp', '63 bookings: Completed bookings at its third tier');
  assert.equal(printBadgeListItem(v!).src, '/api/vendor/badges?badge=verified&inline=1');
});

test('a tier prints the APPROVED v84 picture itself — the same pixels as public/badges/v84, as PNG', async () => {
  const [art] = await resolvePrintBadgeArt([{ kind: 'tier', key: 'trusted_by', label: 'Trusted by (Gold)', family: 'shield', tier: 3 }]);
  assert.ok(art?.png);
  const raw = (b: Buffer | Uint8Array) => sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const a = await raw(readFileSync(path.join(__dirname, '../public/badges/v84/shield-3.webp')));
  const b = await raw(art.png!);
  assert.deepEqual([b.info.width, b.info.height], [a.info.width, a.info.height]);
  assert.ok(a.data.equals(b.data), 'the printed picture is not the v84 file');
  assert.match(art.svg, /<image href="data:image\/png;base64,/);
});

test('every seal prints still and font-free: no <text>, no animation, its own ids, its award year — and it renders', async () => {
  for (const seal of STORED_SEALS) {
    const svg = await sealPrintSvg(seal, 2027, `t_${seal}`);
    assert.doesNotMatch(svg, /<text\b|<textPath\b/, `${seal}: a letter a print shop could lack the font for`);
    assert.doesNotMatch(svg, /<animate|<set\b|\{\{YEAR\}\}|§/, `${seal}: not still, or a slot left open`);
    assert.doesNotMatch(svg, / class="/, `${seal}: a screen-only class`);
    for (const m of svg.matchAll(/ id="([^"]+)"/g)) assert.ok(m[1]!.startsWith(`t_${seal}_`), `${seal}: id ${m[1]} is not this copy's`);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    assert.ok(png.length > 2000, `${seal}: did not render`);
  }
  // the year rides the ribbon: a different year draws different outlines there, and nothing else changes
  const a = await sealPrintSvg('top10', 2026, 'y');
  const b = await sealPrintSvg('top10', 2031, 'y');
  assert.notEqual(a, b);
  assert.equal(a.replace(/\{\{YEAR\}\}/, ''), a);
  assert.deepEqual(Object.keys(SEAL_ART_OF).sort(), ['clients_choice', 'most_in_demand', 'top10', 'verified_partner']);
  assert.deepEqual(Object.keys(PRINT_SEAL_SVG).sort(), ['crest', 'heart', 'medal', 'partner']);
});

test('the resolver hands every kind a box and a picture for the PDF; Verified is vector', async () => {
  const arts = await resolvePrintBadgeArt([
    { kind: 'verified', key: 'verified', label: 'Setnayan Verified' },
    { kind: 'seal', key: 'clients_choice', label: "Clients' Choice", year: 2026 },
    { kind: 'tier', key: 'gifts_given', label: 'Gifts given (Bronze)', family: 'giftbox', tier: 1 },
  ]);
  assert.deepEqual(arts.map((a) => [a.w, a.h]), [[75, 75], [320, 304], [300, 286]]);
  assert.equal(arts[0]!.png, null);
  for (const a of arts.slice(1)) assert.ok(a.png && a.png.length > 1000);
  assert.match(arts[0]!.svg, /data-verified-v84/);
});
