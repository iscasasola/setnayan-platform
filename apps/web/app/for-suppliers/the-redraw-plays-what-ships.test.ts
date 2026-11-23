/**
 * the-redraw-plays-what-ships.test.ts — the /for-suppliers redraw of 23 Nov 2026 (owner: *"Approved, build it"*; the
 * drawing is `prototypes/for_suppliers_redraw_2026-11-23/for_suppliers_redraw_fable.html` in the spec corpus) says only
 * what the app does, through the app's own pieces:
 *
 *   § 5 · the live cards — the REAL Check a date month (`SeatMonths`, imported, its look never copied), Card 14
 *         (`ServiceFace layout="mall"`) with `mallPrice` / `DATE_FIT_WORDS` / `aboutKmLine`, played on NATIVE scroll
 *         (passive, nothing takes the wheel), with its scroll room a real block inside the scene;
 *   § 7 · the stairs — every fact `TIER_CAPS`, every price the catalog's, every paid step a real checkout door;
 *   tools — each paid widget's chip says the one rule (bought once, works on Plus, Pro or Ultra — owner a02673ac), the
 *         Toolkit's live count (5ae3fbb2); the on-the-day tools are `SPECIALIZED_TOOLS`, never a typed list.
 */
import { isPaidStoreTool } from '@/lib/supplier-store';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { TIER_CAPS, VENDOR_TIERS, isTierAtLeast } from '@/lib/vendor-tier-caps';
import { DATE_FIT_WORDS } from '@/lib/calendar-truth';
import { aboutKmLine, mallPrice } from '@/lib/mall-card';
import { formatPhpRounded } from '@/lib/php';
import { storageWords } from '@/lib/downgrade-limits';
import { PRO_TOOLS_MIN_TIER } from '@/lib/specialized-tools-access';
import { SPECIALIZED_TOOLS } from '@/lib/specialized-tools';
import { PAID_WIDGET_PLAN_WORDS } from '@/lib/special-tools';
import { openShopWithPlanHref } from '@/lib/supplier-plan-offer';
import {
  EVERY_PLAN_TOOLS,
  FIRST_TOOLS_TIER,
  LIVE_CARD_SAMPLES,
  LIVE_GUESTS,
  LIVE_SCRIPT,
  LIVE_VENUES,
  PAID_TOOL_GATES,
  PAID_TOOL_TILES,
  PAID_WIDGET_CHIP_WORDS,
  STAIR_TIERS,
  liveCardsMonth,
  liveStepAt,
  paidToolChip,
  planStair,
  stairHasTools,
} from './_components/supplier-front-data';

const WEB = join(__dirname, '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const LIVE = code('app/for-suppliers/_components/supplier-live-cards.tsx');
const PAGE = code('app/for-suppliers/_components/supplier-front-page.tsx');
const CLIENT = code('app/for-suppliers/_components/supplier-front-client.tsx');
const CSS = readFileSync(join(WEB, 'app/for-suppliers/_components/supplier-front.module.css'), 'utf8');
const ROUTE = code('app/(shell)/for-suppliers/page.tsx');

/* ───────────────────────── § 5 · the live cards ───────────────────────── */

test('the month is the real Check a date month — imported, its look never copied', () => {
  assert.match(LIVE, /import \{ SeatMonths[^}]*\} from '@\/app\/v\/\[slug\]\/dates\/_components\/seat-months'/);
  assert.match(LIVE, /<SeatMonths\b/);
  assert.doesNotMatch(CSS, /--seat-(top|off|ink|hot-line)/, 'the page sheet copies the seat colours — reuse SeatMonths instead');
  assert.doesNotMatch(CSS, /repeating-linear-gradient/, 'the page sheet redraws the striped "not bookable" day');
});

test('the stage plays on NATIVE scroll — passive, and nothing takes the wheel or the touch', () => {
  assert.match(LIVE, /addEventListener\('scroll', onScroll, \{ passive: true \}\)/);
  assert.doesNotMatch(LIVE, /'wheel'|'touchmove'|onWheel|onTouchMove|preventDefault\(/, 'the stage captures the wheel or the touch');
  assert.doesNotMatch(LIVE, /scrollTo\(|scrollIntoView\(/, 'the stage moves the page by itself');
});

test('the scroll room is a real block INSIDE the scene (padding gives a sticky child no room — the drawing’s bug)', () => {
  const scene = LIVE.indexOf('className={s.liveScene}');
  const room = LIVE.indexOf('className={s.liveRoom}');
  const pin = LIVE.indexOf('className={s.livePin}');
  assert.ok(scene > 0 && pin > scene && room > pin, 'the room is not a block after the stage inside the scene');
  assert.match(CSS, /\.liveScene\[data-motion\] \.liveRoom \{ display: block; height: \d+vh; \}/);
  assert.match(CSS, /\.liveScene\[data-motion\] \.livePin \{ position: sticky;/);
  assert.doesNotMatch(CSS, /\.liveScene[^{]*\{[^}]*padding-bottom:\s*\d+vh/, 'the scroll room is padding again');
  // Reduced motion / no script: nothing pins, nothing is hidden — every such rule sits behind the script's mark.
  assert.doesNotMatch(CSS, /(^|\n)\.livePin \{[^}]*sticky/, 'the stage pins without the script');
  assert.match(LIVE, /prefers-reduced-motion: reduce/);
});

test('four states: the day flips a date line, then the guests move the caterer’s total, then the venue moves the km', () => {
  assert.equal(LIVE_SCRIPT.length, 4);
  assert.deepEqual([0, 0.2, 0.5, 0.9].map(liveStepAt), [0, 1, 2, 3]);
  const fit = (day: number) => LIVE_CARD_SAMPLES.map((c) => (c.closed.includes(day) ? 'booked' : 'free'));
  const [a, b, c, d] = LIVE_SCRIPT as [typeof LIVE_SCRIPT[0], typeof LIVE_SCRIPT[0], typeof LIVE_SCRIPT[0], typeof LIVE_SCRIPT[0]];
  assert.notDeepEqual(fit(a.day), fit(b.day), 'the day step flips no card’s date line');
  assert.ok(fit(a.day).includes('booked') && fit(a.day).includes('free'), 'the first day shows both answers');
  assert.notEqual(b.guests, c.guests, 'the guest step moves nothing');
  assert.notEqual(c.venue, d.venue, 'the venue step moves nothing');
  for (const s of LIVE_SCRIPT) {
    assert.ok((LIVE_GUESTS as readonly number[]).includes(s.guests), `the script plays ${s.guests} guests, which no pill offers`);
    assert.ok(s.venue < LIVE_VENUES.length);
  }
  assert.deepEqual(DATE_FIT_WORDS.free, 'Free on your date');
  assert.deepEqual(DATE_FIT_WORDS.booked, 'Booked that day');
});

test('the one per-guest caterer: its band is mallPrice — "for your N guests" and the total', () => {
  const per = LIVE_CARD_SAMPLES.filter((c) => c.perGuest != null);
  assert.equal(per.length, 1, 'the drawing has exactly one per-guest card');
  const c = per[0]!;
  assert.equal(c.shop, 'Casa Lirio Catering');
  for (const g of LIVE_GUESTS) {
    const band = mallPrice({ perGuest: { pricePhp: c.perGuest!, minPax: null }, guests: g, price: null, priceNote: null });
    assert.equal(band?.big, formatPhpRounded(c.perGuest! * g));
    assert.equal(band?.you, `for your ${g} guests`);
  }
  for (const card of LIVE_CARD_SAMPLES) {
    assert.equal(card.km.length, LIVE_VENUES.length, `${card.shop}: a venue has no km`);
    for (const k of card.km) assert.ok(aboutKmLine(k), `${card.shop}: ${k} km reads as no distance`);
  }
});

test('the sample month is never in the past', () => {
  assert.deepEqual(liveCardsMonth(Date.UTC(2026, 10, 23)), { y: 2026, m: 12 });
  assert.deepEqual(liveCardsMonth(Date.UTC(2026, 11, 2)), { y: 2027, m: 12 }, 'in December the sample would show the month already under way');
  assert.match(PAGE, /<SupplierLiveCards month=\{liveCardsMonth\(nowMs\)\}/);
});

test('a tap drives the same stage: a day, a guest count, a venue, a need, a card', () => {
  assert.match(LIVE, /onPick=\{\(day\) => set\(\{ day:/);
  assert.match(LIVE, /onPick=\{\(k\) => set\(\{ guests: Number\(k\)/);
  assert.match(LIVE, /onPick=\{\(k\) => set\(\{ venue: Number\(k\)/);
  assert.match(LIVE, /onClick=\{\(\) => set\(\{ slide: n\.slide \}\)\}/);
  assert.match(LIVE, /door=\{\{ label: `Show the month of \$\{c\.shop\}`, onOpen: onPick \}\}/);
});

/* ───────────────────────── § 7 · the stairs ───────────────────────── */

test('the stairs are every plan, smallest to biggest, each fact read from TIER_CAPS', () => {
  assert.deepEqual([...STAIR_TIERS], [...VENDOR_TIERS]);
  let last = 0;
  for (const t of STAIR_TIERS) {
    const st = planStair(t);
    const c = TIER_CAPS[t];
    assert.equal(st.size, storageWords(c.storageBytes!), `${t}: size`);
    assert.ok(st.share > last && st.share <= 1, `${t}: the meter does not grow up the stairs`);
    last = st.share;
    assert.equal(st.services.lead, Number.isFinite(c.serviceCardsTotal) ? String(c.serviceCardsTotal) : 'No limit', `${t}: services`);
    assert.equal(st.people.team, c.agentAccounts > 0, `${t}: people`);
    assert.equal(st.branches.text === 'Main shop', c.branchesIncluded === 0, `${t}: branches`);
    assert.equal(st.marketplace, t !== 'free', `${t}: marketplace — verified shops are found, an unverified one is not`);
    assert.equal(st.tools, TIER_CAPS[t].specialTools && isTierAtLeast(t, PRO_TOOLS_MIN_TIER), `${t}: tools`);
  }
  assert.doesNotMatch(PAGE + CLIENT, /PlanRows|planRows|Upgrade only to manage more/, 'the retired plan rows or their lede are back');
  assert.match(PAGE, /No plan limits your inquiries\./);
});

test('every stair’s price is the catalog’s, and every paid step opens its own checkout door', () => {
  assert.match(PAGE, /const growPrice = \(t: GrowTier\) => \(\{ solo: prices\.soloMonthly, pro: prices\.proMonthly, enterprise: prices\.enterpriseMonthly \}\)\[t\]/);
  assert.match(PAGE, /price: growPrice\(t\), per: 'per 4 weeks', cta: `Start on \$\{step\.name\}`, href: openShopWithPlanHref\(t\)/);
  assert.match(CLIENT, /\{p\.price \?\? '—'\}/, 'an unread price draws something other than "—"');
  assert.ok(openShopWithPlanHref('solo').startsWith('/open-shop?plan='));
});

test('the plan words are the house words — no Max, no Enterprise, no Supplier Plus, no vendor', () => {
  for (const [name, src] of [['page', PAGE], ['client', CLIENT], ['live', LIVE]] as const) {
    // what a person reads: JSX text and string literals — never an import path or a line of code
    const said = [...(src.match(/>[^<>{}=;()]+</g) ?? []), ...(src.match(/'[^']*'|`[^`]*`/g) ?? [])].filter((w) => !/^'@\//.test(w));
    const words = said.join(' ');
    assert.doesNotMatch(words, /\bMax\b|\bEnterprise\b|Supplier Plus/, `${name} prints a plan name the house retired`);
    assert.doesNotMatch(words, /\bvendors?\b/i, `${name} says "vendor" — the word is "supplier"`);
  }
});

/* ───────────────────────── specialized tools ───────────────────────── */

test('the three paid widgets are SPECIALIZED_TOOLS, each under the one Toolkit rule', () => {
  assert.deepEqual(PAID_TOOL_TILES.map((t) => t.key), ['cake_tool', 'papic_challenge', 'plan_3d']);
  assert.ok(Object.values(PAID_TOOL_GATES).every((g) => g === 'toolkit'), 'a paid widget drawn under another gate');
  assert.equal(FIRST_TOOLS_TIER, PRO_TOOLS_MIN_TIER, 'the tools’ door is not the first plan a bought widget works on');
  // Every free widget the Toolkit lists, and only those (v19 PR 2): never a paid one (the Song bank is bought), never a
  // gated one (the Papic camera waits on its privacy switch).
  assert.deepEqual(
    EVERY_PLAN_TOOLS.map((t) => t.key),
    SPECIALIZED_TOOLS.filter((t) => !isPaidStoreTool(t.key) && !t.gate).map((t) => t.key),
  );
  assert.ok(!EVERY_PLAN_TOOLS.some((t) => t.key === 'song_bank' || t.key === 'papic_camera'), 'a paid or gated widget is said to be in every plan');
  assert.match(PAGE, /EVERY_PLAN_TOOLS\.map\(/, 'the on-the-day tools are typed, not read');
  assert.match(PAGE, /\{t\.title\}/);
});

test('🔒 honesty (owner a02673ac): every paid widget’s chip says bought once, works on a paid plan — never “included”, never “every plan”', () => {
  for (const k of ['cake_tool', 'papic_challenge', 'plan_3d'] as const) {
    assert.deepEqual(paidToolChip(k), { words: PAID_WIDGET_CHIP_WORDS, locked: true });
  }
  assert.equal(PAID_WIDGET_CHIP_WORDS, `Buy once · ${PAID_WIDGET_PLAN_WORDS}`);
  assert.equal(paidToolChip('scanner'), null, 'a free widget wears a paid chip');
  // the strip marks exactly the plans a bought widget works on
  for (const t of STAIR_TIERS) assert.equal(stairHasTools(t), isTierAtLeast(t, PRO_TOOLS_MIN_TIER), t);
  // the old open-to-all start date opens nothing any more: the page no longer reads it
  assert.doesNotMatch(ROUTE, /readSpecialToolsPaidFrom|specialTools=/);
  assert.doesNotMatch(PAGE, /specialToolsOpenToAll|Every plan, for now|Included in/);
});

test('the tools’ door is a real checkout door, priced from the catalog', () => {
  assert.match(PAGE, /href: openShopWithPlanHref\(FIRST_TOOLS_TIER\)/);
  assert.match(PAGE, /price: growPrice\(FIRST_TOOLS_TIER\)/);
  assert.match(PAGE, /\{toolsDoor\.price \?\? '—'\}/);
  assert.match(PAGE, /per 4 weeks, with \{toolsDoor\.name\}/);
});
