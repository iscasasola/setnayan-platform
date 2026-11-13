/**
 * the-admin-walk.test.ts — the admin walk round (13 Nov 2026): what each fix holds.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('F-A-18 · /admin/insights opens Insights’ Overview, not Intelligence', () => {
  assert.match(code('app/admin/insights/page.tsx'), /redirect\('\/admin\/app-performance'\);/);
  assert.match(code('lib/admin-tabs.ts'), /\{ route: '\/admin\/insights', tab: 'insights', stubTo: '\/admin\/app-performance' \}/);
});

test('F-A-19 · /admin/vendors/verification goes to /admin/verify', () => {
  assert.match(code('next.config.ts'), /\{ source: '\/admin\/vendors\/verification', destination: '\/admin\/verify', permanent: false \}/);
});

test('F-A-23 · the booking-fees empty state reads the real switch', () => {
  const page = code('app/admin/booking-fees/page.tsx');
  assert.match(page, /\.select\('bookings_open, booking_fee_minting_live'\)/);
  assert.match(page, /feesMinting === true\s*\?\s*'Nobody owes a booking fee right now\. The booking fee is on/);
  assert.doesNotMatch(page, /fees are only charged once the\s+booking fee is switched on/);
});
