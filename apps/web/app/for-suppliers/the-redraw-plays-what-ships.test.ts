/**
 * the-redraw-plays-what-ships.test.ts — the /for-suppliers redraw of 23 Nov 2026 (owner: *"Approved, build it"*; the
 * drawing is `prototypes/for_suppliers_redraw_2026-11-23/for_suppliers_redraw_fable.html` in the spec corpus) says only
 * what the app does, through the app's own pieces:
 *
 *   § 5 · the live cards — the REAL Check a date month (`SeatMonths`, imported, its look never copied), Card 14
 *         (`ServiceFace layout="mall"`) with `mallPrice` / `DATE_FIT_WORDS` / `aboutKmLine`, played on NATIVE scroll
 *         (passive, nothing takes the wheel), with its scroll room a real block inside the scene;
 *   § 7 · the stairs — every fact `TIER_CAPS`, every price the catalog's, every paid step a real checkout door;
 *   tools — each paid tool's chip from its OWN live gate; the Cake Maker's from the special tools' start date, read by
 *         the same reader the gate uses; the on-the-day tools are `SPECIALIZED_TOOLS`, never a typed list.
 */
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
import { PRO_INCLUDED_TOOLS, PRO_TOOLS_MIN_TIER } from '@/lib/specialized-tools-access';
import { SPECIALIZED_TOOLS } from '@/lib/specialized-tools';
import { SPECIAL_TOOLS_LOCKED_WORDS } from '@/lib/special-tools';
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
  PLAN_TOOLS_LOCKED_WORDS,
  SPECIAL_TOOLS_OPEN_WORDS,
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

test('four states: the day takes a card out of the row, then the guests move the caterer’s total, then the venue moves the km', () => {
  assert.equal(LIVE_SCRIPT.length, 4);
  assert.deepEqual([0, 0.2, 0.5, 0.9].map(liveStepAt), [0, 1, 2, 3]);
  const inRow = (day: number) => LIVE_CARD_SAMPLES.filter((c) => !c.closed.includes(day)).map((c) => c.shop);
  const [a, b, c, d] = LIVE_SCRIPT as [typeof LIVE_SCRIPT[0], typeof LIVE_SCRIPT[0], typeof LIVE_SCRIPT[0], typeof LIVE_SCRIPT[0]];
  // Owner 23 Nov: a shop not free that day DROPS OUT of the row. The row starts full, so the day step shows one leave.
  assert.equal(inRow(a.day).length, LIVE_CARD_SAMPLES.length, 'the first day already hides a card: nothing is seen leaving');
  assert.ok(inRow(b.day).length < inRow(a.day).length && inRow(b.day).length > 0, 'the day step takes no card out of the row');
  const caterer = LIVE_CARD_SAMPLES.find((x) => x.perGuest != null)!;
  for (const st of [b, c, d]) assert.ok(!caterer.closed.includes(st.day), 'the per-guest card the guest step moves has left the row');
  assert.notEqual(b.guests, c.guests, 'the guest step moves nothing');
  assert.notEqual(c.venue, d.venue, 'the venue step moves nothing');
  for (const s of LIVE_SCRIPT) {
    assert.ok((LIVE_GUESTS as readonly number[]).includes(s.guests), `the script plays ${s.guests} guests, which no pill offers`);
    assert.ok(s.venue < LIVE_VENUES.length);
  }
  assert.deepEqual(DATE_FIT_WORDS.free, 'Free on your date');
  assert.deepEqual(DATE_FIT_WORDS.booked, 'Booked that day');
});

test('a closed shop leaves the row — never "Booked that day" on a card — and a day with none free says so', () => {
  // The card in the row is always one that is free: the line is the free one, and a closed day hides the card.
  assert.match(LIVE, /lines=\{<SampleDateFit fit="free" \/>\}/);
  assert.doesNotMatch(LIVE, /fit=\{fit\}|'booked'/, 'a closed shop’s card stays in the row, labelled booked');
  assert.match(LIVE, /li\.hidden = true/, 'a closed shop’s card is not taken out of the row');
  assert.match(CSS, /\.liveScene\[data-motion\] \.liveCard\[data-out\] \{ opacity: 0; transform: scale\(\.\d+\); \}/);
  // Some sample day closes all four (24 · 25 Dec): the row then speaks, it is never a blank strip.
  assert.ok(Array.from({ length: 31 }, (_, i) => i + 1).some((d) => LIVE_CARD_SAMPLES.every((c) => c.closed.includes(d))));
  assert.match(LIVE, /\{allOut \? \(\s*<li className=\{s\.liveNone\}[^>]*>\s*\{LIVE_TIPS\.none\(dayLabel\)\}/);
});

test('💬 each change is explained by ONE tip that points at it, in words from one place, heard by a screen reader', () => {
  assert.match(LIVE, /className=\{s\.liveTip\}\s+role="status"/);
  for (const k of ['leaves', 'returns', 'guests', 'place'] as const) {
    assert.match(LIVE, new RegExp(`LIVE_TIPS\\.${k}\\b`), `no change says "${k}"`);
  }
  assert.equal(LIVE.match(/className=\{s\.liveTip\}/g)?.length, 1, 'more than one tip');
  // The tip settles on the motion tokens, and only with the script and without reduced motion.
  assert.match(CSS, /\.liveScene\[data-motion\] \.liveTip \{ transition: opacity var\(--sn-m-move\) var\(--sn-m-settle\)/);
  assert.match(CSS, /\.liveTip \{ position: absolute;[^}]*pointer-events: none; \}/, 'the tip can catch a tap meant for the stage');
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

test('the three paid tools are SPECIALIZED_TOOLS, each held by its real gate', () => {
  assert.deepEqual(PAID_TOOL_TILES.map((t) => t.key), ['cake_tool', 'papic_challenge', 'plan_3d']);
  // the plan gate's tools are PRO_INCLUDED_TOOLS (the access file names the 3D plan `3d_plan`)
  const planGated = Object.entries(PAID_TOOL_GATES).filter(([, g]) => g === 'plan').map(([k]) => (k === 'plan_3d' ? '3d_plan' : k));
  assert.deepEqual(planGated.sort(), [...PRO_INCLUDED_TOOLS].sort());
  assert.equal(FIRST_TOOLS_TIER, PRO_TOOLS_MIN_TIER, 'the tools’ door is not the first plan that carries them');
  assert.equal(EVERY_PLAN_TOOLS.length + PAID_TOOL_TILES.length, SPECIALIZED_TOOLS.length);
  assert.equal(EVERY_PLAN_TOOLS.length, 8, 'the drawing’s eight on-the-day tools');
  assert.match(PAGE, /EVERY_PLAN_TOOLS\.map\(/, 'the on-the-day tools are typed, not read');
  assert.match(PAGE, /\{t\.title\}/);
});

test('🔒 honesty: the Cake Maker’s chip reads the live start date; the plan tools’ lock is always true', () => {
  assert.deepEqual(paidToolChip('cake_tool', true), { words: SPECIAL_TOOLS_OPEN_WORDS, locked: false });
  assert.deepEqual(paidToolChip('cake_tool', false), { words: SPECIAL_TOOLS_LOCKED_WORDS, locked: true });
  assert.equal(paidToolChip('cake_tool', null), null, 'an unread date still claims open or locked');
  for (const k of ['papic_challenge', 'plan_3d'] as const) {
    assert.deepEqual(paidToolChip(k, true), { words: PLAN_TOOLS_LOCKED_WORDS, locked: true });
  }
  // the strip locks exactly the plans the plan gate refuses
  for (const t of STAIR_TIERS) assert.equal(stairHasTools(t), isTierAtLeast(t, PRO_TOOLS_MIN_TIER), t);
  // the page reads the date with the gate's own reader and decides with the gate's own rule
  assert.match(ROUTE, /readSpecialToolsPaidFrom\(createAdminClient\(\)\)/);
  assert.match(ROUTE, /specialTools=\{specialTools\}/);
  assert.match(PAGE, /specialTools\.status === 'ok' \? specialToolsOpenToAll\(specialTools\.paidFrom, nowMs\) : null/);
  assert.doesNotMatch(PAGE, /special_tools_paid_from'?\s*[<>]=?|Date\.parse\(specialTools/, 'the page re-implements the gate');
});

test('the tools’ door is a real checkout door, priced from the catalog', () => {
  assert.match(PAGE, /href: openShopWithPlanHref\(FIRST_TOOLS_TIER\)/);
  assert.match(PAGE, /price: growPrice\(FIRST_TOOLS_TIER\)/);
  assert.match(PAGE, /\{toolsDoor\.price \?\? '—'\}/);
  assert.match(PAGE, /per 4 weeks, with \{toolsDoor\.name\}/);
});
