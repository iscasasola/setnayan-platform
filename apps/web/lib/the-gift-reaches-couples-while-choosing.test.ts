/**
 * SUP-4 · A COUPLE MEETS THE SETNAYAN GIFT WHILE CHOOSING.
 *
 * The gift line ("Includes a Setnayan gift — …") lived only in
 * `ServiceCardFace`, which a couple meets in ONE place: a card a supplier has
 * already offered them in chat. The card they browse (`ServiceCardView`, on
 * `/explore` and the shop page) never said it, so the gift could not influence
 * the choice it exists to influence.
 *
 * Pinned as a chain, because any one broken link renders as a card that simply
 * has no gift line — which looks exactly like a supplier who said no:
 *   1. the marketplace READS the column (it has its own select list);
 *   2. the builder carries it (executed, not grepped);
 *   3. the couple's card mounts the ONE shared line;
 *   4. the chat card mounts the same one, and nobody re-types the words.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { toServiceCard } from '@/lib/service-card-view-model';
import type { VendorServiceRow } from '@/lib/vendor-services';
import { SETNAYAN_GIFT_CARD_COPY } from '@/app/_components/setnayan-gift-line';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const BASE_ROW: VendorServiceRow = {
  vendor_service_id: 'svc-1',
  public_id: 'S89V-0000000001',
  vendor_profile_id: 'vendor-1',
  category: 'live_band',
  title: 'Live Band',
  starting_price_php: 35000,
  added_pax_price_php: null,
  pricing_basis: 'fixed',
  per_pax_price_php: null,
  min_pax: null,
  hour_base_php: null,
  min_hours: null,
  extra_hour_php: null,
  crew_size: null,
  crew_meal_required: false,
  crew_meal_included: true,
  transport_included: true,
  transport_flat_fee_php: null,
  primary_photo_r2_key: 'r2://setnayan-media/cover.jpg',
  showcase_video_r2_key: null,
  showcase_photo_r2_keys: [],
  is_active: true,
  branch_id: null,
  recommended_lead_time_months: null,
  last_minute_end_months: null,
  last_minute_surcharge_pct: null,
  daily_capacity: null,
  exclusive_perk_text: null,
  includes_setnayan_gift: null,
  base_pax: null,
  coverage_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const build = (row: VendorServiceRow) =>
  toServiceCard(row, undefined, undefined, undefined, undefined, false, null, new Date(), null, null, false);

test('1 · the marketplace query reads includes_setnayan_gift', () => {
  const q = readFileSync(join(WEB, 'lib', 'marketplace-service-cards.ts'), 'utf8');
  const cols = q.slice(q.indexOf('const SERVICE_COLS'), q.indexOf(';', q.indexOf('const SERVICE_COLS')));
  assert.ok(cols.length > 50, 'SERVICE_COLS not found — this assertion would be vacuous');
  assert.match(
    cols,
    /includes_setnayan_gift/,
    'the marketplace select dropped includes_setnayan_gift — every card reads undefined and ' +
      'no marketplace card can ever show the gift, silently',
  );
});

test('2 · the builder carries the yes, and only a real yes', () => {
  assert.equal(build({ ...BASE_ROW, includes_setnayan_gift: true }).givesSetnayanGift, true);
  assert.equal(build({ ...BASE_ROW, includes_setnayan_gift: false }).givesSetnayanGift, false);
  assert.equal(build({ ...BASE_ROW, includes_setnayan_gift: null }).givesSetnayanGift, false);
  // A shop that hides its prices still gives the gift — the line carries no peso.
  const hidden = toServiceCard(
    { ...BASE_ROW, includes_setnayan_gift: true },
    undefined, undefined, undefined, undefined, true, null, new Date(), null, null, false,
  );
  assert.equal(hidden.givesSetnayanGift, true);
});

test('3 · the couple\'s card mounts the shared line, gated on the yes', () => {
  const view = read('app/_components/service-card-view.tsx');
  const mounts = view.match(/<SetnayanGiftLine\b/g) ?? [];
  assert.equal(mounts.length, 1, `ServiceCardView mounts SetnayanGiftLine ${mounts.length} times`);
  assert.match(view, /c\.givesSetnayanGift \? \(\s*<SetnayanGiftLine\b/);
});

test('4 · the chat card mounts the same line, and the words exist once', () => {
  const face = read('app/vendor-dashboard/services/_components/service-card-face.tsx');
  assert.equal((face.match(/<SetnayanGiftLine\b/g) ?? []).length, 1);
  assert.match(face, /snap\.givesSetnayanGift \? \(\s*<SetnayanGiftLine\b/);

  // Nobody re-types the sentence: a second copy is a second promise that drifts.
  const phrase = 'free Papic photos for your celebration';
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\./.test(name)) {
        if (readFileSync(p, 'utf8').includes(phrase)) hits.push(relative(WEB, p));
      }
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  assert.deepEqual(hits, ['app/_components/setnayan-gift-line.tsx'], `the gift sentence is typed in: ${hits.join(', ')}`);
});

test('🔒 the line carries no number — the photo count belongs to the quote', () => {
  assert.ok(SETNAYAN_GIFT_CARD_COPY.length > 20);
  assert.ok(!/\d/.test(SETNAYAN_GIFT_CARD_COPY), `the card's gift line states a number: "${SETNAYAN_GIFT_CARD_COPY}"`);
});
