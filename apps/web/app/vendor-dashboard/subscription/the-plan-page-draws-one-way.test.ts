/**
 * 🧱 THE PLAN PAGE DRAWS ONE WAY, AND A MISSING ROW NEVER CRASHES IT (Batch 0 · L1, MASTER-PLAN L2, walk 27 Nov 12e).
 *
 * The walk: first load of `/vendor-dashboard/subscription` threw React #418 (the server's text and the browser's
 * differed), then nine "Cannot read properties of null (reading 'parentNode')" as React's streamed boundaries arrived
 * into a page it had already re-drawn; Admin › Problems logged it as "uncaught … TypeError … null".
 *
 *  1. A client piece on this page never formats with the runtime's own locale data (`toLocale*`, `Intl.*`) or reads
 *     the clock while drawing: the server and a phone answer those differently. The badge-upgrade row did
 *     (`toLocaleDateString('en-PH')`); it now prints the Manila day by arithmetic, the page's one phrasing (RW-30).
 *  2. The plan read coming back with NO row (not refused, just nothing) reads as Free and never throws.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { manilaDayOf, offerDayWords } from '@/lib/personal-invite-offer';
import { endedPlanReadsFree, tierHasLapsed } from '@/lib/vendor-tier-lapse';
import { planGiftOf } from '@/lib/plan-gift';
import { asVendorTier } from '@/lib/vendor-tier-caps';

const DIR = join(process.cwd(), 'app/vendor-dashboard/subscription/_components');
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('no client piece on the Plan page formats by the runtime locale or reads the clock while drawing', () => {
  const clientFiles = readdirSync(DIR).filter((f) => f.endsWith('.tsx') && /^'use client';/.test(readFileSync(join(DIR, f), 'utf8')));
  assert.ok(clientFiles.includes('badge-upgrades-section.tsx'), 'the scan reaches the row that drifted');
  for (const f of clientFiles) {
    const src = strip(readFileSync(join(DIR, f), 'utf8'));
    assert.doesNotMatch(src, /\.toLocale(Date|Time)?String\(/, `${f}: a locale format answers differently on the server and a phone (#418)`);
    assert.doesNotMatch(src, /\bIntl\./, `${f}: Intl answers from each runtime's own data (#418)`);
    assert.doesNotMatch(src, /\bDate\.now\(\)|new Date\(\)/, `${f}: the clock differs between the server's draw and the phone's`);
  }
});

test("the upgrade row's day is the Manila day, written one way on every runtime", () => {
  // 23:30 UTC on 3 Dec is 07:30 on 4 Dec in Manila.
  assert.equal(offerDayWords(manilaDayOf('2026-12-03T23:30:00Z')!), '4 Dec 2026');
  assert.equal(manilaDayOf('not a date'), null, 'an unreadable day prints nothing, never "Invalid Date"');
  const src = strip(readFileSync(join(DIR, 'badge-upgrades-section.tsx'), 'utf8'));
  assert.match(src, /offerDayWords\(/);
});

test('a plan read with no row reads as Free and never throws', () => {
  const now = Date.parse('2026-11-27T00:00:00Z');
  assert.doesNotThrow(() => tierHasLapsed(null, now));
  assert.equal(tierHasLapsed(null, now), false);
  assert.equal(endedPlanReadsFree(null, now), null);
  assert.equal(asVendorTier((null as { tier_state?: string | null } | null)?.tier_state), 'free');
  assert.equal(planGiftOf({ tier_state: null, tier_source: null, tier_expires_at: null }, now), null);
  assert.equal(planGiftOf(null, now), null);
});
