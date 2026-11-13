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

test('F-A-09 · the shop’s admin page: Manila dates, and no claim that customers pay through Setnayan', () => {
  const page = code('app/admin/vendors/[vendorProfileId]/page.tsx');
  assert.match(page, /toLocaleDateString\('en-PH', \{ year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia\/Manila' \}\)/);
  assert.doesNotMatch(page, /once a customer pays this supplier through Setnayan/);
});

test('F-A-08 · a verification document is titled by its paper, with a Manila date', () => {
  const page = code('app/admin/verification-docs/page.tsx');
  assert.match(page, /\{paperName\(d\.slot\) \? \(/);
  assert.match(page, /uploaded \$\{manilaDay\(d\.lastModified\)\}/);
  assert.doesNotMatch(page, /lastModified\.slice\(0, 10\)\}/);
});

test('F-A-12 · Overview speaks plainly: no table or column names, no setnayan.ph, no token packs', () => {
  const ex = code('app/admin/app-performance/_components/expenses.tsx');
  assert.doesNotMatch(ex, /source="[^"]*(platform_expenses|next_due_on)/);
  assert.doesNotMatch(ex, /has the platform_expenses/);
  const ac = code('app/admin/app-performance/_components/action-center.tsx');
  assert.doesNotMatch(ac, /setnayan\.ph/);
  assert.doesNotMatch(ac, /token packs?/i);
});

test('F-A-11 · Insights times are Manila time, never a UTC slice', async () => {
  const { manilaStampLabel, manilaDayLabel } = await import('@/lib/admin/manila-stamp');
  assert.match(manilaStampLabel('2026-11-13T16:30:00Z'), /Nov 14, 2026, 12:30/, '16:30 UTC is 12:30 AM the next day in Manila');
  assert.equal(manilaDayLabel('2026-11-13T17:00:00Z'), manilaDayLabel('2026-11-14T00:00:00+08:00'));
  for (const rel of [
    'app/admin/app-performance/_surfaces/overview-surface.tsx',
    'app/admin/app-performance/_surfaces/intelligence-surface.tsx',
    'app/admin/app-performance/_surfaces/operations-surface.tsx',
  ]) {
    const src = code(rel);
    assert.doesNotMatch(src, /\} UTC/, `${rel} prints a UTC stamp`);
    assert.doesNotMatch(src, /new Date\([^)]*\)\.toLocaleString\('en-PH'\)/, `${rel} formats on the server's clock`);
  }
});
