/**
 * the-redesign-builds-the-drawing.test.ts — /for-suppliers is the owner-APPROVED redesign of 23 Nov 2026 (specs
 * `prototypes/for_suppliers_redesign_2026-11-23/index.html` v4.3.1; DECISION_LOG 2026-11-23 "/for-suppliers redesign
 * APPROVED (owner)"), built 1:1 with HOUSE_DESIGN_STANDARD Part I, and every number on it is READ:
 *
 *   · the parts, in the drawing's order, on the one route;
 *   · the fee steps' fees are `bookingFeePhp` on the schedule handed in — move the schedule and they move;
 *   · the gifts are the shop-gift packs read from the catalogue; an unread read says so, never ₱0;
 *   · the Toolkit shows ONE count (`toolkitClaim`, held by the-toolkit-claim-is-true.test.ts); its sheet is the one
 *     Toolkit list (`toolkitItems`), names only, never a second number;
 *   · the plans open on Verified, every paid card carries its own checkout door, an unread price draws "—";
 *   · every media slot is a real file, every clip has a poster and fetches nothing for the first paint;
 *   · Part I: no shadow on a static card, no gradient but the hero's band, tabular numbers on the figures.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { BOOKING_FEE, bookingFeePhp, type BookingFeeSchedule } from '@/lib/booking-fee';
import { formatPhpRounded } from '@/lib/php';
import { listedWidgets } from '@/lib/specialized-tools';
import { PROMOTE_QR_MODES } from '@/lib/supplier-qr-codes';
import { isPaidStoreTool } from '@/lib/supplier-store';
import { SHOP_BADGE_KEYS } from '@/lib/badge-tiers';
import { CARD_ORDER } from '@/app/vendor-dashboard/performance/_components/analytics-cards';
import { bundleFreePacks, type ShopGiftPack } from '@/lib/shop-gifts';
import { FEE_FIRST_SUPPLIER_LINE } from '@/lib/booking-fee-who-words';
import {
  BADGE_ROW,
  FEE_STEP_BOOKINGS,
  FRONT_MEDIA,
  STAIR_TIERS,
  feeRowWords,
  feeSteps,
  giftBundleLine,
  giftFromPrice,
  giftRows,
  railShare,
  toolkitShelves,
} from './_components/supplier-front-data';

const WEB = join(__dirname, '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PAGE = code('app/for-suppliers/_components/supplier-front-page.tsx');
const CLIENT = code('app/for-suppliers/_components/supplier-front-client.tsx');
const CSS = stripComments(readFileSync(join(WEB, 'app/for-suppliers/_components/supplier-front.module.css'), 'utf8'));
const ROUTE = code('app/(shell)/for-suppliers/page.tsx');

const PACKS: ShopGiftPack[] = [
  { code: 'PAPIC_GUEST_150', title: 'Papic 150', kind: 'papic', credits: 150, srpCentavos: 12_300 },
  { code: 'PAPIC_GUEST_1K', title: 'Papic 1000', kind: 'papic', credits: 1000, srpCentavos: 45_600 },
  { code: 'EVENT_PLUS', title: 'Event Plus', kind: 'event_plus', credits: 1, srpCentavos: 300_100 },
  { code: 'COUPLE_WEBSITE_PRO', title: 'Event Pro', kind: 'event_pro', credits: 1, srpCentavos: 600_200 },
];

test('the parts are the drawing’s, in its order', () => {
  const order = ['sf-h-top', 'id="cards"', 'id="shop"', 'id="fees"', 'id="verified"', 'id="tools"', 'id="gift"', 'id="plans"', 'id="start"'];
  const at = order.map((k) => (k.startsWith('id=') ? PAGE.indexOf(`<Part ${k}`) : PAGE.indexOf(k)));
  at[at.length - 1] = PAGE.indexOf('id="start"');
  for (const [i, n] of at.entries()) assert.ok(n > 0, `${order[i]} is not drawn`);
  for (let i = 1; i < at.length; i++) assert.ok(at[i]! > at[i - 1]!, `${order[i]} is out of the drawing’s order`);
  assert.equal(FRONT_MEDIA.beats.length, 3, 'the drawing has three beats');
  assert.match(PAGE, /<OpenShopFollow href=\{OPEN_SHOP\} label=\{CTA\} watch=\{\[HERO_CTA_ID, CLOSE_CTA_ID\]\} \/>/);
  assert.match(PAGE, /\{FEE_FIRST_SUPPLIER_LINE\}/);
  assert.equal(FEE_FIRST_SUPPLIER_LINE, 'Free only for the supplier who brings the couple in first.');
});

test('the fee steps are bookingFeePhp on the schedule handed in — ₱0, then the usual fee, then a big booking’s', () => {
  const steps = feeSteps(BOOKING_FEE, 'Papic 150');
  assert.deepEqual(
    steps.map((s) => s.fee),
    [formatPhpRounded(0), formatPhpRounded(bookingFeePhp(FEE_STEP_BOOKINGS.usual, BOOKING_FEE)), formatPhpRounded(bookingFeePhp(FEE_STEP_BOOKINGS.big, BOOKING_FEE))],
  );
  assert.equal(steps[0]!.sub, 'Your gift to them: Papic 150');
  assert.equal(feeSteps(BOOKING_FEE, null)[0]!.sub, '', 'an unread gift is named anyway');
  // An admin edit moves every figure (the schedule is read, never the code default).
  const edited: BookingFeeSchedule = { ...BOOKING_FEE, rate: 0.04, tailRate: 0.02, tier1LimitPhp: 50_000, capPhp: 90_000 };
  const moved = feeSteps(edited, null);
  assert.equal(moved[1]!.fee, formatPhpRounded(bookingFeePhp(FEE_STEP_BOOKINGS.usual, edited)));
  assert.notEqual(moved[1]!.fee, steps[1]!.fee, 'the usual step did not follow the schedule');
  assert.match(moved[1]!.mean, /4%/);
  assert.equal(feeRowWords(edited).setnayan, '4%, 2% above ₱50,000');
  assert.equal(feeRowWords(edited).cap, 'Never more than ₱90,000. Your couple never pays it.');
  // The page hands the live schedule; the reduced-motion and unread states never print ₱0 as a fee they did not read.
  assert.match(PAGE, /const steps = schedule \? feeSteps\(schedule, smallestGift\) : null;/);
  assert.match(PAGE, /Couldn’t read the booking fee just now\./);
});

test('the gifts are the packs the catalogue sells — titles and prices read, unread says so, never ₱0', () => {
  const rows = giftRows(PACKS, { plusCredits: 1234, proCredits: 5678 })!;
  assert.deepEqual(rows.map((r) => [r.title, r.price]), [
    ['Papic 150', formatPhpRounded(123)],
    ['Event Plus', formatPhpRounded(3001)],
    ['Event Pro', formatPhpRounded(6002)],
  ]);
  assert.match(rows[0]!.line, /^150 Papic credits/);
  assert.match(rows[1]!.line, /1,234 Papic credits/);
  assert.match(rows[2]!.line, /5,678 Papic credits/);
  assert.doesNotMatch(giftRows(PACKS, { plusCredits: null, proCredits: null })![1]!.line, /\d/, 'an unread credit count is named anyway');
  assert.equal(giftRows(null, { plusCredits: null, proCredits: null }), null);
  assert.equal(giftFromPrice(PACKS), formatPhpRounded(123), '"from ₱…" is not the smallest pack');
  assert.equal(giftFromPrice(null), null);
  const bundle = { code: 'GIFT_BUNDLE_X', title: 'x', pack: PACKS[0]!, quantity: 11, priceCentavos: 123_000 };
  assert.equal(bundleFreePacks(bundle), 1);
  assert.equal(giftBundleLine(PACKS, [bundle]), 'Buy 10, get 1 free.');
  assert.equal(giftBundleLine(PACKS, null), null);
  assert.match(PAGE, /Couldn’t read the gifts just now\./);
  assert.match(ROUTE, /fetchShopGiftPacks\(admin\)/);
  assert.match(ROUTE, /fetchShopGiftBundles\(admin, packs\)/);
  assert.match(ROUTE, /planCreditsFrom\(catalog\)/);
  assert.match(ROUTE, /const \[p, fee, giftRead, catalog, papicCapture, cardTemplates\] = await Promise\.all\(\[/, 'the page reads in more than one batch');
});

test('the Toolkit sheet is the one Toolkit list, and the page shows ONE count — never a typed number', () => {
  for (const papic of [false, true]) {
    const shelves = toolkitShelves(papic);
    const rows = (k: string) => shelves.find((sh) => sh.key === k)?.rows ?? [];
    assert.deepEqual(rows('tools').map((r) => r.key), listedWidgets(papic).map((t) => t.key), 'the widgets are not the listed widgets');
    assert.equal(rows('qr').length, PROMOTE_QR_MODES.length);
    assert.equal(rows('graphs').length, CARD_ORDER.length);
    assert.equal(rows('badges').length, SHOP_BADGE_KEYS.length);
    for (const r of rows('graphs')) assert.ok(r.name && r.name !== r.key, `graph ${r.key} has no name`);
  }
  assert.ok(!toolkitShelves(false).some((sh) => sh.rows.some((r) => r.key === 'papic_camera')), 'the Papic camera is listed with its switch off');
  // the tags are the rules (owner a02673ac): a paid widget is Paid; every other widget Free; badges are Built in
  for (const r of toolkitShelves(true).find((sh) => sh.key === 'tools')!.rows) assert.equal(r.tag, isPaidStoreTool(r.key) ? 'paid' : 'free', r.key);
  assert.match(PAGE, /const shelves = toolkitShelves\(papicCapture\);/);
  assert.match(PAGE, /<ToolkitCount claim=\{claim\} shelves=\{shelves\} \/>/);
  assert.doesNotMatch(CLIENT, /formatCount\((total|sh\.count)\)|sh\.count/, 'the Toolkit sheet draws a second count');
  assert.doesNotMatch(PAGE + CLIENT, /\b33\b|\b11 tools\b|\b17 graphs\b|\b390\b/, 'a Toolkit number is typed');
});

test('the plans open on Verified; every paid card opens its own checkout; an unread price draws "—"', () => {
  assert.match(PAGE, /const START_PLAN = STAIR_TIERS\.indexOf\('verified'\);/);
  assert.ok(STAIR_TIERS.indexOf('verified') > 0);
  assert.match(PAGE, /<PlanPicker plans=\{plans\} start=\{START_PLAN\} \/>/);
  // calendar-month billing (batch AH): the period words are PLAN_PERIOD's, the price the catalogue's monthly row
  assert.match(PAGE, /const growPrice = \(t: GrowTier\) => monthlyPlanPrice\(prices, t\)/);
  assert.match(PAGE, /price: growPrice\(t\), per: PLAN_PERIOD\.per, cta: `Start on \$\{step\.name\}`, href: openShopWithPlanHref\(t\)/);
  assert.doesNotMatch(PAGE + CLIENT + ROUTE, /4 weeks|28[- ]?d(ay)?\b|P28D/i, 'a 4-week period is back');
  assert.match(CLIENT, /\{p\.price \?\? '—'\} <small>\{p\.per\}<\/small>/);
  // the rail's bars are each plan's room, straight: grow up the plans, the biggest full
  const shares = STAIR_TIERS.map(railShare);
  for (let i = 1; i < shares.length; i++) assert.ok(shares[i]! > shares[i - 1]!, `${STAIR_TIERS[i]}: the bar does not grow`);
  assert.equal(shares[shares.length - 1], 1);
  assert.match(PAGE, /share: railShare\(t\)/);
});

test('every media slot is a real file; clips carry a poster and fetch nothing until they are near', () => {
  const pub = (src: string) => existsSync(join(WEB, 'public', src));
  const clips = [...FRONT_MEDIA.beats.flatMap((b) => [b.pick, b.cards]), FRONT_MEDIA.gift];
  for (const c of clips) {
    assert.ok(pub(c.src), `${c.src} is missing`);
    assert.ok(pub(c.poster), `${c.poster} is missing`);
    assert.ok(c.label.length > 0);
  }
  const stills = [...FRONT_MEDIA.shop, ...FRONT_MEDIA.verified, ...FRONT_MEDIA.tools.map((t) => t.still)];
  for (const st of stills) assert.ok(pub(st.src) && st.alt && st.w > 0 && st.h > 0, `${st.src} is missing or has no size`);
  assert.ok(pub(FRONT_MEDIA.hero.src));
  for (const b of BADGE_ROW) assert.ok(pub(b.src), `${b.src} is missing`);
  assert.deepEqual(BADGE_ROW.map((b) => b.key), [...SHOP_BADGE_KEYS]);
  // the clip: nothing until near, then a poster and only its metadata; it plays only while on screen
  assert.match(CLIENT, /\{near \? \(\s*<video/);
  assert.match(CLIENT, /preload="metadata"/);
  assert.match(CLIENT, /poster=\{clip\.poster\}/);
  assert.doesNotMatch(CLIENT, /autoPlay/, 'a clip autoplays before it is on screen');
  assert.match(CLIENT, /threshold: 0\.55/);
  // the stills are lazy; the hero is the one eager picture
  assert.match(PAGE, /loading="lazy" sizes=/);
  assert.match(PAGE, /<Image src=\{FRONT_MEDIA\.hero\.src\} alt=\{FRONT_MEDIA\.hero\.alt\} fill priority/);
});

test('Part I: no shadow on a static card, no gradient but the hero’s band, tabular numbers on the figures', () => {
  const rules = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1]!.trim(), body: m[2]! }));
  const FLOATING = /^\.(fab|topOpen)$/;
  for (const r of rules) {
    const sh = /box-shadow:\s*([^;]+)/.exec(r.body)?.[1]?.trim();
    if (sh && !FLOATING.test(r.sel)) assert.match(sh, /^inset 0 0 0 1px var\(--sf-line\)$/, `${r.sel} carries a shadow (Part I: hairlines, not shadows)`);
    if (/gradient\(/.test(r.body)) assert.equal(r.sel, '.hp::after', `${r.sel} draws a gradient (Part I: only the band under words on a photo)`);
  }
  for (const sel of ['.ff', '.big', '.price']) {
    const r = rules.find((x) => x.sel === sel);
    assert.ok(r && /font-variant-numeric:\s*tabular-nums/.test(r.body), `${sel} is not tabular`);
  }
  // one typed colour only: the words on the hero's photo, white in both themes (as the front page's hero)
  assert.deepEqual(CSS.match(/[^\n;{]*#[0-9a-f]{3,8}\b/gi)?.map((x) => x.trim()), ['--sf-on-photo: #fff'], 'the sheet types a colour');
});
