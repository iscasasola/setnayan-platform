/**
 * supplier-front-reads-its-numbers.test.ts — the approved /for-suppliers (6 Nov 2026) says only what the app keeps.
 *
 * Owner brief for the build: *"Every number READS its source … Never type a peso figure."* The page's words are the
 * prototype's; its numbers are read from `TIER_CAPS`, the Plans page's own rows (`VENDOR_TIER_SECTIONS`), the
 * catalog (`getVendorPrices`) and the live booking-fee schedule. This file holds that:
 *
 *   · no peso figure is typed into the page's files (the "₱0" of Free is the one exception — it is the meaning of free);
 *   · the fee is placed by `bookingFeeFigures` and counted by `bookingFeePhp`, never written as a rate;
 *   · each plan's spec line is its caps; every Grow line still finds its Plans-page row; the papers match
 *     `REQUIRED_DOC_COUNT`; only the plans that may buy add-ons are named as able to;
 *   · the page promises nothing the brief forbids (no "Coming soon", no launch wording, no in-app calls).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { TIER_CAPS, canBuyExtraBranches, canBuyExtraSeats } from '@/lib/vendor-tier-caps';
import { REQUIRED_DOC_COUNT } from '@/lib/vendor-verification';
import { formatCount } from '@/lib/format-number';
import { storageWords } from '@/lib/downgrade-limits';
import { clientRangeWords } from '@/lib/supplier-client-room';
import {
  ADDON_TIERS,
  GROW_LINES,
  GROW_TIERS,
  VERIFIED_PAPERS,
  foldGroups,
  foldedLines,
  growLines,
  growSpec,
  planLine,
  STAIR_TIERS,
  planStair,
  tierOfPlansRow,
} from './_components/supplier-front-data';

const WEB = join(__dirname, '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PAGE_FILES = [
  'app/for-suppliers/_components/supplier-front-page.tsx',
  'app/for-suppliers/_components/supplier-front-client.tsx',
  'app/for-suppliers/_components/supplier-live-cards.tsx',
  'app/for-suppliers/_components/supplier-front-info.tsx',
  'app/for-suppliers/_components/supplier-how-we-earn.tsx',
  'app/for-suppliers/_components/supplier-how-we-earn-data.ts',
  'app/(shell)/for-suppliers/page.tsx',
];

test('no peso figure is typed into the page', () => {
  for (const rel of PAGE_FILES) {
    const typed = (code(rel).match(/₱\s?\d[\d,]*/g) ?? []).filter((m) => m.replace(/[\s,]/g, '') !== '₱0');
    assert.deepEqual(typed, [], `${rel} types a peso figure — read it from the catalog or the fee schedule`);
  }
});

test('the fee is read and computed, never typed as a rate', () => {
  const page = code('app/for-suppliers/_components/supplier-front-page.tsx');
  assert.match(page, /bookingFeeFigures\(fee\.schedule\)/, 'the fee sentence does not place the live figures');
  assert.doesNotMatch(page, /\b\d+(\.\d+)?%\s*(on the first|after|booking fee)/i, 'a fee rate is typed into the page');
  const client = code('app/for-suppliers/_components/supplier-front-client.tsx');
  // The ruler's stops (with the 🔒 lock point) are built by `feeRulerStops(schedule)` in the data file since the lock landed.
  assert.match(client, /feeRulerStops\(schedule\)/, 'the slider does not build its stops from the schedule it was handed');
  const data = code('app/for-suppliers/_components/supplier-front-data.ts');
  assert.match(data, /bookingFeePhp\(v, schedule\)/, 'the ruler stops do not compute the fee from the schedule they were handed');
  assert.doesNotMatch(data, /BOOKING_FEE\b(?!_)/, 'the ruler stops can fall back to the code default schedule');
  assert.doesNotMatch(client, /BOOKING_FEE\b(?!_)/, 'the slider can fall back to the code default schedule');
  assert.match(code('app/(shell)/for-suppliers/page.tsx'), /getLiveBookingFeeSchedule\(\)/);
});

test('each plan spec is its caps', () => {
  for (const t of GROW_TIERS) {
    const c = TIER_CAPS[t];
    const spec = growSpec(t);
    // 🔓 Reach is not a plan allowance (owner 2026-11-19): no km and no "Nationwide" on any plan's spec.
    assert.doesNotMatch(spec, /\bkm\b|nationwide/i, `${t} still prints a reach: ${spec}`);
    // 22 Nov "SAME FEATURES IN EVERY SIZE": each spec leads with its size, then the caps — or "no limit" in words.
    assert.ok(spec.startsWith(storageWords(c.storageBytes ?? 0)), `${t} does not lead with its size: ${spec}`);
    assert.doesNotMatch(spec, /Infinity|—/, `${t} prints a no-limit cap as a symbol: ${spec}`);
    if (Number.isFinite(c.serviceCardsTotal)) {
      assert.ok(spec.includes(`${formatCount(c.serviceCardsTotal)} service card`), `${t}: ${spec}`);
      assert.ok(spec.includes(`you and ${formatCount(c.agentAccounts)} more`), `${t}: ${spec}`);
    } else {
      assert.ok(spec.includes('no limit on cards, people or branches'), `${t}: ${spec}`);
    }
  }
});

test('every Grow line still finds its Plans-page row, and sits under exactly one plan', () => {
  // The folded add-ons (2026-11-14, `foldedLines`) lead each plan's list; the rest are the Plans-page rows.
  const folded = new Set(GROW_TIERS.flatMap((t) => foldedLines(t).map((l) => l.text)));
  const placed = GROW_TIERS.flatMap((t) => growLines(t).map((l) => l.text)).filter((x) => !folded.has(x));
  assert.equal(placed.length, GROW_LINES.length, `a Grow line lost its Plans-page row: ${GROW_LINES.map((l) => l.text).filter((x) => !placed.includes(x)).join(' · ')}`);
  assert.equal(new Set(placed).size, placed.length, 'a Grow line is shown under two plans');
  assert.ok(tierOfPlansRow(/^Market Intelligence/), 'anti-vacuity: the Market Intelligence row is gone from the Plans page');
});

test('Verified names the papers it asks for, and the add-ons name who may buy them — nobody, since 2026-11-22', () => {
  assert.equal(VERIFIED_PAPERS.length, REQUIRED_DOC_COUNT, 'the Verified step lists a different number of papers than verification asks for');
  // Owner 2026-11-22 "FINAL LADDER": no add-ons — Pro and Ultra have no seat or branch limit, so nobody buys one.
  assert.equal(ADDON_TIERS.length, 0, 'a plan is offered an extra seat or branch');
  for (const t of GROW_TIERS) assert.equal(ADDON_TIERS.includes(t), canBuyExtraBranches(t) && canBuyExtraSeats(t), t);
});

test('the fold keeps the prototype’s five groups', () => {
  assert.deepEqual(
    foldGroups().map((g) => [g.title, g.lines.length]),
    [
      ['Get found', 8],
      ['Get booked', 11],
      ['Work together', 6],
      ['Run the day', 6],
      ['Grow', 9],
    ],
  );
});

test('the page says nothing the brief forbids', () => {
  for (const rel of PAGE_FILES) {
    const src = code(rel);
    assert.doesNotMatch(src, /coming soon/i, `${rel} says "Coming soon"`);
    assert.doesNotMatch(src, /\blaunch(ing|ed)?\b/i, `${rel} carries launch wording`);
    assert.doesNotMatch(src, /be (one of )?the first/i, `${rel} carries launch wording`);
    assert.doesNotMatch(src, /(video|audio)\s*(&|and|&amp;)\s*(video|audio)\s+calls?/i, `${rel} promises in-app calls`);
    assert.doesNotMatch(src, /demo shop/i, `${rel} offers a demo shop`);
  }
});

test('owner 2026-11-22: every tool on every paid size — the 3D booth logo and Papic Challenges are named once, from Plus, and nothing calls the booth an add-on', async () => {
  const { growLines } = await import('./_components/supplier-front-data');
  const words = (t: 'solo' | 'pro' | 'enterprise') => growLines(t).map((l) => l.text + (l.tail ?? '')).join(' | ');
  assert.match(words('solo'), /3D seat plan/);
  assert.match(words('solo'), /Papic Challenges|All specialized tools/);
  assert.doesNotMatch(words('pro'), /3D seat plan/, 'Pro repeats a line Plus already gives');
  for (const t of ['solo', 'pro', 'enterprise'] as const) assert.doesNotMatch(words(t), /add-on\)/);
});

test('owner via controller 22 Nov: a plan is never its size alone — Free and Verified cards say what they hold, with the size', () => {
  assert.equal(planLine('free'), 'Run your own clients, 1 live service, just you, main shop only, and 128 MB. Room for about 25–150 clients.');
  assert.equal(planLine('verified'), 'On the marketplace with the basics, 3 live services, just you, main shop only, and 1 GB. Room for about 200–1,200 clients.');
  // 23 Nov redraw (plans as growth stairs): every card — Free and Verified too — is its size AND its facts, from `planStair`.
  const page = code('app/for-suppliers/_components/supplier-front-page.tsx');
  assert.match(page, /STAIR_TIERS\.map\(\(t\) => \{\s*const step = planStair\(t\)/, 'a plan card is drawn from something other than its read facts');
  for (const t of ['free', 'verified'] as const) {
    const st = planStair(t);
    assert.equal(st.size, storageWords(TIER_CAPS[t].storageBytes!), `${t}: the card lost its size`);
    assert.ok(st.services.lead && st.people.text && st.branches.text, `${t}: the card is a slogan again`);
  }
  // Owner 2026-11-23 "Give them a quick range of how many clients can they serve": every card says it, from ONE helper.
  for (const t of STAIR_TIERS) assert.equal(planStair(t).clients, clientRangeWords(t), `${t}: the card's client range is not the helper's`);
  assert.match(code('app/for-suppliers/_components/supplier-front-client.tsx'), /\{p\.clients \? <p className=\{s\.clients\}>\{p\.clients\}<\/p> : null\}/, 'the plan card does not draw its client range');
  const coord = code('app/(shell)/for-coordinators/page.tsx');
  assert.match(coord, /\{planLine\('free'\)\}/);
  assert.match(coord, /\{planLine\('verified'\)\}/);
});

test('owner 23 Nov "this is not our agreed service card": the samples wear Card 14, the mall face (approved 20 Nov, #8070)', () => {
  // /for-suppliers draws its samples in the live cards (redraw 23 Nov); /for-coordinators still draws the still row.
  const SLOTS: Record<string, readonly string[]> = {
    'app/for-suppliers/_components/supplier-live-cards.tsx': ['city=', 'rating=', 'mallPrice={band}', 'medals=', 'lines={<SampleDateFit fit={fit} />}', 'distance={km}', 'aboutKmLine(', 'mallPrice({'],
    'app/(shell)/for-coordinators/page.tsx': ['city=', 'rating=', 'price=', 'priceNote=', 'medals=', 'lines={<SampleDateFit />}', 'distance={aboutKmLine('],
  };
  for (const [rel, slots] of Object.entries(SLOTS)) {
    const src = code(rel);
    const faces = src.match(/<ServiceFace\b[^>]*?layout="(\w+)"/gs) ?? [];
    assert.ok(src.includes('<ServiceFace'), `${rel} draws no sample card`);
    assert.equal((src.match(/<ServiceFace\b/g) ?? []).length, faces.length, `${rel}: a sample card has no layout — the old row face`);
    for (const f of faces) assert.match(f, /layout="mall"/, `${rel}: a sample is not Card 14`);
    assert.doesNotMatch(src, /includesLineOf|notIncluded=/, `${rel}: Includes / Not included live in the opened card, not on the face`);
    // Owner 23 Nov: "load up the sample cards. we want to show if the details were complete." — every Card 14 slot.
    for (const slot of slots) assert.ok(src.includes(slot), `${rel}: a sample card is missing ${slot}`);
  }
  assert.doesNotMatch(code('app/for-suppliers/_components/supplier-front-page.tsx'), /<ServiceFace\b/, 'the still sample row is back beside the live cards');
});
