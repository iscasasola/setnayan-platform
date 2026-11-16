/**
 * 🏅 THE SERVICE-CARD BADGES (badge build J3) — one assertion per claim, each red on its sabotage.
 *
 * Fails if:
 *   1 · a threshold moves (each badge passes AT its line and fails one under it);
 *   2 · the Quick Responder clock stops being 7am–7pm Manila (an inquiry after 7pm is timed from 7am), an automatic
 *       or unanswered-past-the-hour inquiry passes, or a withdrawn one counts;
 *   3 · an unpublished card or a shop not in good standing earns a medal;
 *   4 · the row's order changes (it is also the queue order, DECISION_LOG 7fbff0cd), Setnayan Verified is not last,
 *       shows without a verified shop, or a Verified Partner shop's 6th medal is not "Verified Partner · for life" in
 *       Verified's place (DECISION_LOG 11d044c0);
 *   5 · "time held" stops reading weeks → months → years;
 *   6 · a malformed facts read parses as a card with no badges (it must be a failed read, never zero);
 *   7 · a label ink drops under 4.5:1 on the card's paper, light or dark (read from the `--sn-cb-*` tokens in
 *       globals.css), or a medal colour is written as a raw hex instead of its token;
 *   8 · the shop page stops drawing Verified from the SAME fact as the blue check, the gallery stops saying a failed
 *       read out loud, the row loses its 44 px floor, or the explainer stops loading lazily.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CARD_BADGE_ORDER,
  CARD_BADGES,
  badgeLabel,
  cardBadgeRow,
  clockMinutesBetween,
  heldWords,
  inquiryVerdict,
  parseShopBadgeFacts,
  passingCardBadges,
  type CardBadgeFacts,
  type CardInquiry,
  CARD_BADGE_TAGS,
  CARD_BADGE_KEYS,
  CARD_BADGE_CONGRATS_PARAM,
  cardBadgeCongratsHref,
  parseCardBadgeCongratsParam,
} from './card-badges';
import { CARD_BADGE_ART } from './card-badges-art';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const strip = stripComments;

/** A Manila wall-clock instant → epoch ms (Manila = UTC+8, no DST). */
const mnl = (iso: string) => Date.parse(`${iso}+08:00`);
const NOW = mnl('2026-11-15T12:00:00');

function card(over: Partial<CardBadgeFacts> = {}): CardBadgeFacts {
  return {
    id: 'c1',
    published: true,
    paid_bookings: 0,
    paid_couples: 0,
    paid_with_gift: 0,
    five_star_capped: 0,
    under_four: 0,
    couples_now: 0,
    couples_before: 0,
    inquiries: [],
    ...over,
  };
}
const q = (asked: string, replied: string | null, withdrawn = false): CardInquiry => ({
  asked_at: new Date(mnl(asked)).toISOString(),
  replied_at: replied ? new Date(mnl(replied)).toISOString() : null,
  withdrawn,
});
const onTimeInquiries = (n: number) =>
  Array.from({ length: n }, (_, i) => q(`2026-11-0${(i % 9) + 1}T10:00:00`, `2026-11-0${(i % 9) + 1}T10:30:00`));

test('1 · each badge passes AT its line and fails one under it', () => {
  const pass = (c: Partial<CardBadgeFacts>) => passingCardBadges(card(c), true, NOW);
  assert.deepEqual(pass({ paid_bookings: 5, paid_couples: 5 }).includes('hot_booking'), true);
  assert.deepEqual(pass({ paid_bookings: 5, paid_couples: 4 }).includes('hot_booking'), false, 'five bookings from four couples is not Hot');
  assert.deepEqual(pass({ paid_bookings: 4, paid_couples: 4 }).includes('hot_booking'), false);

  assert.ok(pass({ couples_now: 30, couples_before: 20 }).includes('trending_now'));
  assert.ok(!pass({ couples_now: 29, couples_before: 0 }).includes('trending_now'), '29 couples is not Trending');
  assert.ok(!pass({ couples_now: 30, couples_before: 21 }).includes('trending_now'), 'only 9 more than before is not Trending');

  assert.ok(pass({ five_star_capped: 5 }).includes('rave_reviews'));
  assert.ok(!pass({ five_star_capped: 4 }).includes('rave_reviews'));
  assert.ok(!pass({ five_star_capped: 9, under_four: 1 }).includes('rave_reviews'), 'one review under 4 stars takes it off');

  assert.ok(pass({ paid_bookings: 5, paid_couples: 5, paid_with_gift: 5 }).includes('generous_giver'));
  assert.ok(!pass({ paid_bookings: 6, paid_couples: 6, paid_with_gift: 5 }).includes('generous_giver'), 'one booking without a gift');
  assert.ok(!pass({ paid_bookings: 4, paid_couples: 4, paid_with_gift: 4 }).includes('generous_giver'), 'fewer than 5 bookings');

  assert.ok(pass({ inquiries: onTimeInquiries(10) }).includes('quick_responder'));
  assert.ok(!pass({ inquiries: onTimeInquiries(9) }).includes('quick_responder'), 'nine inquiries is too few');
});

test('2 · the Quick Responder clock runs 7am–7pm Manila; after 7pm is timed from 7am', () => {
  assert.equal(clockMinutesBetween(mnl('2026-11-10T10:00:00'), mnl('2026-11-10T11:00:00')), 60);
  assert.equal(clockMinutesBetween(mnl('2026-11-10T20:00:00'), mnl('2026-11-11T07:45:00')), 45, 'night is not on the clock');
  assert.equal(clockMinutesBetween(mnl('2026-11-10T18:30:00'), mnl('2026-11-11T07:31:00')), 61, 'the clock pauses at 7pm');
  assert.equal(clockMinutesBetween(mnl('2026-11-10T05:00:00'), mnl('2026-11-10T07:59:00')), 59, 'before 7am is timed from 7am');

  assert.equal(inquiryVerdict(q('2026-11-10T21:00:00', '2026-11-11T07:59:00'), NOW), 'on_time');
  assert.equal(inquiryVerdict(q('2026-11-10T10:00:00', '2026-11-10T11:01:00'), NOW), 'late');
  assert.equal(inquiryVerdict(q('2026-11-10T10:00:00', null), NOW), 'late', 'unanswered past the hour');
  assert.equal(inquiryVerdict(q('2026-11-15T11:30:00', null), NOW), 'pending', 'unanswered, still inside its hour');
  assert.equal(inquiryVerdict(q('2026-11-10T10:00:00', null, true), NOW), 'skipped', 'a withdrawn inquiry is skipped');

  const nine = onTimeInquiries(10);
  const withLate = [...nine, q('2026-11-12T10:00:00', '2026-11-12T12:00:00')];
  assert.ok(!passingCardBadges(card({ inquiries: withLate }), true, NOW).includes('quick_responder'), 'one late reply takes it off');
  const withWithdrawn = [...nine, q('2026-11-12T10:00:00', null, true)];
  assert.ok(passingCardBadges(card({ inquiries: withWithdrawn }), true, NOW).includes('quick_responder'));
});

test('3 · an unpublished card, or a shop not in good standing, earns nothing', () => {
  const full = card({ paid_bookings: 9, paid_couples: 9, paid_with_gift: 9, five_star_capped: 9, couples_now: 50 });
  assert.equal(passingCardBadges(full, true, NOW).length, 4);
  assert.deepEqual(passingCardBadges({ ...full, published: false }, true, NOW), []);
  assert.deepEqual(passingCardBadges(full, false, NOW), []);
});

test('4 · the order is fixed and Setnayan Verified is always last — and only for a verified shop', () => {
  assert.deepEqual([...CARD_BADGE_ORDER], ['hot_booking', 'quick_responder', 'trending_now', 'rave_reviews', 'generous_giver', 'verified']);
  assert.deepEqual(
    Object.values(CARD_BADGES).map((b) => b.name),
    ['Hot Booking', 'Quick Responder', 'Trending Now', 'Rave Reviews', 'Generous Giver', 'Setnayan Verified', 'Verified Partner'],
  );
  const holds = [
    { badge: 'generous_giver' as const, held_since: '2026-10-01T00:00:00Z' },
    { badge: 'hot_booking' as const, held_since: '2026-07-01T00:00:00Z' },
  ];
  assert.deepEqual(
    cardBadgeRow(holds, { on: true, since: '2025-01-01T00:00:00Z' }).map((b) => b.key),
    ['hot_booking', 'generous_giver', 'verified'],
  );
  assert.deepEqual(cardBadgeRow(holds, { on: false, since: '2025-01-01T00:00:00Z' }).map((b) => b.key), ['hot_booking', 'generous_giver']);
  assert.deepEqual(cardBadgeRow([], { on: true, since: null }).map((b) => b.key), ['verified'], 'every card of a verified shop shows it');
  // DECISION_LOG 11d044c0: a Verified Partner shop's 6th medal is the Partner seal, IN PLACE of Setnayan Verified.
  const partnerRow = cardBadgeRow(holds, { on: true, since: '2025-01-01T00:00:00Z', partner: true });
  assert.deepEqual(partnerRow.map((b) => b.key), ['hot_booking', 'generous_giver', 'partner'], 'Partner takes Verified’s slot, never beside it');
  assert.equal(badgeLabel(partnerRow[2]!, NOW), 'Verified Partner · for life');
});

test('5 · time held reads weeks under a month, then months, then years', () => {
  assert.equal(heldWords(3), '1 wk');
  assert.equal(heldWords(15), '2 wks');
  assert.equal(heldWords(29), '4 wks');
  assert.equal(heldWords(30), '1 mo');
  assert.equal(heldWords(125), '4 mos');
  assert.equal(heldWords(365), '1 yr');
  assert.equal(heldWords(800), '2.1 yrs');
  assert.equal(badgeLabel({ key: 'hot_booking', since: new Date(NOW - 125 * 86_400_000).toISOString() }, NOW), 'Hot Booking · 4 mos');
  assert.equal(badgeLabel({ key: 'verified', since: null }, NOW), 'Setnayan Verified', 'no start date → the name alone');
});

test('6 · a malformed facts read is a FAILED read (null), never a card with no badges', () => {
  assert.equal(parseShopBadgeFacts(null), null);
  assert.equal(parseShopBadgeFacts({ cards: 'x', good_standing: true }), null);
  assert.equal(parseShopBadgeFacts({ cards: [{ id: 'c1', published: true }], good_standing: true }), null);
  const { inquiries: _drop, ...noInquiries } = card();
  assert.equal(parseShopBadgeFacts({ good_standing: true, cards: [noInquiries] }), null, 'a card with no inquiry list is unread, not "none"');
  const ok = parseShopBadgeFacts({ verified_since: null, good_standing: true, cards: [{ ...card(), inquiries: [] }] });
  assert.equal(ok?.cards.length, 1);
});

function contrast(a: string, b: string): number {
  const L = (h: string) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const [x, y] = [L(a), L(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test('7 · every label ink reads at 4.5:1 on the card, light and dark — and every colour is a token', () => {
  const css = read('app/globals.css');
  const medals = css.slice(css.indexOf('THE SERVICE-CARD BADGE MEDALS'));
  const light = medals.slice(medals.indexOf(':root {'), medals.indexOf('html.dark {'));
  const dark = medals.slice(medals.indexOf('html.dark {'));
  const tok = (block: string, name: string) => new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(block)?.[1];
  // The card's paper, as the app declares it: --m-paper / --m-paper-2, first in :root, then in html.dark.
  const papers = (name: string) => [...css.matchAll(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`, 'g'))].map((m) => m[1]!);
  const [p1Light, p1Dark] = papers('m-paper');
  const [p2Light, p2Dark] = papers('m-paper-2');
  assert.ok(p1Light && p1Dark && p2Light && p2Dark, 'the card paper tokens were not found in globals.css');

  const art = read('lib/card-badges-art.ts');
  assert.doesNotMatch(strip(art), /#[0-9A-Fa-f]{3,8}\b/, 'a raw hex in the medal art — the colour belongs in a --sn-cb-* token');
  for (const [k, a] of Object.entries(CARD_BADGE_ART)) {
    const t = k.replace(/_/g, '-');
    assert.equal(a.fill, `var(--sn-cb-${t}-fill)`, `${k}: the fill is not its token`);
    assert.equal(a.ink, `var(--sn-cb-${t}-ink)`, `${k}: the ink is not its token`);
    assert.ok(tok(light, `sn-cb-${t}-fill`), `${k}: no --sn-cb-${t}-fill in globals.css`);
    const inkLight = tok(light, `sn-cb-${t}-ink`);
    const inkDark = tok(dark, `sn-cb-${t}-ink`);
    assert.ok(inkLight && inkDark, `${k}: its ink is not declared for light and dark`);
    for (const p of [p1Light!, p2Light!]) assert.ok(contrast(inkLight!, p) >= 4.5, `${k} light on ${p}: ${contrast(inkLight!, p).toFixed(2)}`);
    for (const p of [p1Dark!, p2Dark!]) assert.ok(contrast(inkDark!, p) >= 4.5, `${k} dark on ${p}: ${contrast(inkDark!, p).toFixed(2)}`);
  }
});

test('8 · the page, the gallery and the row keep their promises', () => {
  const page = strip(read('app/v/[slug]/page.tsx'));
  assert.match(
    page,
    /const shopVerified = vendor\.verification_state === 'verified';[\s\S]{0,600}readCardBadges\(admin, \{\s*vendorProfileId: vendor\.vendor_profile_id,\s*shopVerified,/,
    'Verified on the card is the SAME fact as the blue check by the name',
  );
  // Verified Partner comes from the ONE seals read (J2), never typed — and a failed seals read is a failed badge read.
  assert.match(page, /const shopSeals = await readShopSeals\(vendor\.vendor_profile_id, shopVerified\);\s*if \(!shopSeals\) return \{ kind: 'unreadable' \};/);
  assert.match(page, /verifiedPartner: shopSeals\.seals\.includes\('verified_partner'\)/);
  assert.doesNotMatch(page, /verifiedPartner: (false|true)\b/, 'Verified Partner is hard-coded again');
  assert.match(page, /cardBadges=\{cardBadges\}/, 'the section hands the badges to the gallery');

  const gallery = strip(read('app/v/[slug]/_components/services-gallery.tsx'));
  assert.match(gallery, /cardBadges\?\.kind === 'unreadable' \?/, 'a failed read is said out loud');
  assert.match(gallery, /We couldn’t check these cards’ badges just now\./);
  assert.match(gallery, /footer=\{\s*cardBadges\?\.kind === 'ok'[\s\S]{0,120}<CardBadgeRow /, 'each card draws its row');
  assert.match(gallery, /cardBadgeRow=\{\s*cardBadges\?\.kind === 'ok'[\s\S]{0,160}<CardBadgeRow /, 'the full card draws the same row');

  const view = strip(read('app/_components/service-card-view.tsx'));
  assert.match(view, /footer=\{footer\}/, 'the row reaches the face, inside the frame');

  const row = strip(read('app/_components/card-badges/card-badge-row.tsx'));
  assert.match(row, /<button[\s\S]{0,400}min-h-\[44px\]/, 'the row is a 44 px button');
  // The rules pop-up is main's award-kit shell, loaded and mounted on the tap (no second explainer).
  assert.match(row, /dynamic\(\(\) => import\('@\/app\/_components\/award\/card-badge-rules'\)/, 'the rules shell loads on the first tap');
  assert.match(row, /\{open \? \(\s*<CardBadgeRules/, 'the rules pop-up mounts only on a tap');
  assert.ok(!existsSync(join(WEB, 'app/_components/card-badges/card-badges-explainer.tsx')), 'a second rules explainer is back');
  assert.match(row, /CARD_BADGE_TURN_MS = 2600/, 'the design’s 2.6 s beat');
  assert.match(row, /prefers-reduced-motion: reduce/, 'nothing turns under reduced motion');
});

test('9 · the Today line links to its congratulations, in the drawing’s words, with v86’s tags', () => {
  // The link round-trips, and anything that is not one card id + one earned key opens nothing.
  const id = '0b8e7c1a-3f2d-4e5a-9b6c-7d8e9f0a1b2c';
  const href = cardBadgeCongratsHref(id, 'hot_booking');
  const raw = decodeURIComponent(href.split(`${CARD_BADGE_CONGRATS_PARAM}=`)[1]!);
  assert.deepEqual(parseCardBadgeCongratsParam(raw), { vendorServiceId: id, badge: 'hot_booking' });
  for (const bad of [null, '', id, `${id}.verified`, `${id}.partner`, `nope.hot_booking`, `${id}.made_up`]) {
    assert.equal(parseCardBadgeCongratsParam(bad), null, `"${bad}" opened a congratulations`);
  }
  // Every earned badge has its v86 tag (AW[].mini); Verified / Partner are the shop's and have none.
  assert.deepEqual(Object.keys(CARD_BADGE_TAGS).sort(), [...CARD_BADGE_KEYS].sort());

  const server = strip(read('lib/card-badges.server.ts'));
  assert.match(server, /title: cardCongratsTodayLine\(title, badge\.name\)/, 'the Today line is main’s words');
  assert.match(server, /relatedUrl: cardBadgeCongratsHref\(f\.vendor_service_id, f\.badge\)/, 'the line opens its congratulations');
  assert.doesNotMatch(server, /relatedUrl: '\/vendor-dashboard'/);

  const today = strip(read('app/vendor-dashboard/page.tsx'));
  assert.match(today, /parseCardBadgeCongratsParam\(search\.card_badge\)/);
  assert.match(today, /<CardBadgeCongratsLink read=\{await cardBadgeCongratsP\} \/>/);
  const mount = strip(read('app/vendor-dashboard/_components/card-badge-congrats-mount.tsx'));
  assert.match(mount, /<CardBadgeCongrats\b/, 'the mount draws main’s congratulations');
});
