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
import {
  ADDON_TIERS,
  GROW_LINES,
  GROW_TIERS,
  VERIFIED_PAPERS,
  foldGroups,
  growLines,
  growSpec,
  tierOfPlansRow,
} from './_components/supplier-front-data';

const WEB = join(__dirname, '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PAGE_FILES = [
  'app/for-suppliers/_components/supplier-front-page.tsx',
  'app/for-suppliers/_components/supplier-front-client.tsx',
  'app/for-suppliers/_components/supplier-front-info.tsx',
  'app/for-suppliers/_components/supplier-badge-shelf.tsx',
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
  assert.match(client, /bookingFeePhp\(v, schedule\)/, 'the slider does not compute the fee from the schedule it was handed');
  assert.doesNotMatch(client, /BOOKING_FEE\b(?!_)/, 'the slider can fall back to the code default schedule');
  assert.match(code('app/(shell)/for-suppliers/page.tsx'), /getLiveBookingFeeSchedule\(\)/);
});

test('each plan spec is its caps', () => {
  for (const t of GROW_TIERS) {
    const c = TIER_CAPS[t];
    const spec = growSpec(t);
    assert.ok(spec.includes(Number.isFinite(c.serviceRadiusKm) ? `${formatCount(c.serviceRadiusKm)} km` : 'Nationwide'), `${t}: ${spec}`);
    assert.ok(spec.includes(`${formatCount(c.parentCategories)} categor`), `${t}: ${spec}`);
    assert.ok(spec.includes(`${formatCount(c.servicesPerLeaf)} service card`), `${t}: ${spec}`);
    assert.ok(spec.includes(`${formatCount(c.agentAccounts)} team seat`), `${t}: ${spec}`);
  }
});

test('every Grow line still finds its Plans-page row, and sits under exactly one plan', () => {
  const placed = GROW_TIERS.flatMap((t) => growLines(t).map((l) => l.text));
  assert.equal(placed.length, GROW_LINES.length, `a Grow line lost its Plans-page row: ${GROW_LINES.map((l) => l.text).filter((x) => !placed.includes(x)).join(' · ')}`);
  assert.equal(new Set(placed).size, placed.length, 'a Grow line is shown under two plans');
  assert.ok(tierOfPlansRow(/^Market Intelligence/), 'anti-vacuity: the Market Intelligence row is gone from the Plans page');
});

test('Verified names the papers it asks for, and the add-ons name who may buy them', () => {
  assert.equal(VERIFIED_PAPERS.length, REQUIRED_DOC_COUNT, 'the Verified step lists a different number of papers than verification asks for');
  assert.ok(ADDON_TIERS.length > 0, 'no plan may buy an extra branch and seat — the add-on block would be a promise nobody can take');
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
