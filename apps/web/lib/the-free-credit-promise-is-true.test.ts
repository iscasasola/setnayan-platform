/**
 * THE FREE-CREDIT PROMISE IS TRUE — /papic may only say what the product gives.
 *
 * 🎁 UPDATED 27 Nov 2026, NOT DELETED. This file used to pin the sentence "N free
 * credits on your first event" to `papic_claim_free_pool()` (MONEY-1,
 * 2026-09-14): the first event got `free_grant_points`, every later one a
 * 1-point floor, and a switched-off column had to render as silence. The owner
 * then retired the grant outright (16 Nov 2026, DECISION_LOG "Free 50 Papic
 * credits REMOVED": every booking carries a Setnayan gift instead), and set the
 * column to 0 in prod on 28 Nov. So the true sentence is now NONE: /papic names
 * no free credits at all, and where it needs a line it says
 * `PAPIC_BOOKING_GIFT_LINE`. The tree-wide sweep is
 * `the-free-first-event-papic-grant-is-gone.test.ts`; this file holds the
 * public Papic page itself, which was the surface the defect lived on.
 *
 * ⛔ AND THE FLOOR IS STILL NOT A FEATURE. Nothing may sell "1 credit on every
 * event" either.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { stripComments } from './strip-comments';
import { PAPIC_BOOKING_GIFT_LINE } from './setnayan-gift';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Every file that renders a word of the public Papic page about credits. */
const PAPIC_PUBLIC_FILES = [
  'app/(shell)/papic/page.tsx',
  'app/(shell)/papic/_papic-dial.tsx',
  'app/(shell)/papic/_papic-sections.tsx',
] as const;

test('the free-credit components are gone from /papic', () => {
  assert.equal(existsSync(join(WEB, 'app/(shell)/papic/_papic-free-credits.tsx')), false, 'the free-credit badge/fact/closing file is back');
  const page = read('app/(shell)/papic/page.tsx');
  for (const mount of ['<PapicFreeCreditBadge', '<PapicFreeCreditFact', '<PapicFreeCreditClosing', 'readPapicFreeGrantRead', 'papicFreeCreditPromise']) {
    assert.equal(page.includes(mount), false, `${mount} is back on /papic`);
  }
});

test('/papic names no free credits, no first-event condition, no "every event" pool', () => {
  for (const rel of PAPIC_PUBLIC_FILES) {
    const src = read(rel);
    for (const shape of [/free credits?/i, /credits? (?:come )?free/i, /first event/i, /every celebration/i, /\bcredits left\b/i]) {
      assert.equal(shape.test(src), false, `${rel} matches ${shape}: the free first-event grant is retired (owner 16 Nov 2026)`);
    }
  }
});

test('the floor is never sold as a feature', () => {
  const all = PAPIC_PUBLIC_FILES.map(read).join('\n');
  for (const shape of [/1 credit on every/i, /one credit on every/i, /a credit on every (?:event|celebration)/i]) {
    assert.equal(shape.test(all), false, `a 1-credit "perk" is being advertised (${shape})`);
  }
});

test('the facts under the hero say the booking gift, and the structured data names no free credits', () => {
  const page = read('app/(shell)/papic/page.tsx');
  assert.match(page, /<Fact>\{PAPIC_BOOKING_GIFT_LINE\}<\/Fact>/, 'the first fact no longer says the gift line');
  const ld = page.slice(page.indexOf('const APP_LD = {'), page.indexOf('};', page.indexOf('const APP_LD = {')));
  assert.ok(ld.length > 100, 'premise: the SoftwareApplication data was found');
  assert.doesNotMatch(ld, /free credits|first event|trial clock/i, 'search engines are told about free credits again');
  assert.match(PAPIC_BOOKING_GIFT_LINE, /^Many bookings come with free Papic photos as a Setnayan gift\.$/);
});
