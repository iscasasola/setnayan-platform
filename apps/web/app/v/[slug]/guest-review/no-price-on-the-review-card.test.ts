/**
 * GUARD — 🏷 A REVIEW REQUEST NEVER SHOWS A PRICE (owner, 6 Nov 2026, verbatim: *"Don't show the price. Just the
 * service."*) and shows ONLY THAT SUPPLIER'S cards (*"they do not show other supplier requests, only their
 * services"*). Read by source: none of the review screens may read, format or print a price.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const SCREENS = [
  'app/dashboard/[eventId]/vendors/[vendorId]/review/_components/review-request-card.tsx',
  'app/v/[slug]/guest-review/page.tsx',
  'app/v/[slug]/guest-review/_components/guest-review-form.tsx',
  'app/v/[slug]/guest-review/_components/guest-review-header.tsx',
  'app/v/[slug]/_components/review-groups.tsx',
];
const PRICE = /₱|price|formatPhp|starting_price|amount_php|_php\b|peso/i;

test('no review screen reads, formats or prints a price', () => {
  for (const f of SCREENS) {
    const src = read(f).replace(/No communication, price or schedule questions/g, '');
    assert.doesNotMatch(src, PRICE, `${f} names a price`);
  }
});

test('the card titles are read by name only — the read selects no price column', () => {
  const lib = read('lib/guest-reviews.ts');
  const titles = lib.slice(lib.indexOf('export async function readServiceTitles'));
  assert.match(titles.slice(0, 400), /\.select\('vendor_service_id, title'\)/);
  const host = read('app/dashboard/[eventId]/vendors/[vendorId]/review/page.tsx');
  assert.match(host, /\.select\('vendor_service_id, title, primary_photo_r2_key'\)/);
});

test('the host request lists only THIS shop’s bookings on THIS event', () => {
  const host = read('app/dashboard/[eventId]/vendors/[vendorId]/review/page.tsx');
  const at = host.indexOf('const { data: shopRows');
  assert.ok(at > 0, 'the booked-cards read is gone');
  const block = host.slice(at, at + 400);
  assert.match(block, /\.eq\('event_id', eventId\)/);
  assert.match(block, /\.eq\('marketplace_vendor_id', vendorProfile\.vendor_profile_id\)/);
});
