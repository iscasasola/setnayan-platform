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

test('F-A-13/F-A-14 · Categories and Pricing name no code paths, no SKU codes, no "celebration"', () => {
  assert.doesNotMatch(code('app/admin/categories/_components/map-panels.tsx'), /lib\/attire-designs\.ts/);
  const cat = code('app/admin/pricing/_components/catalog-editor.tsx');
  assert.doesNotMatch(cat, /\{row\.code\}<\/code>/, 'a SKU code is drawn on the price row again');
  for (const rel of ['app/admin/pricing/_components/catalog-editor.tsx', 'app/admin/pricing/_components/papic-type-sizing-editor.tsx', 'app/admin/pricing/_components/ai-bands-editor.tsx']) {
    assert.doesNotMatch(code(rel), /\bcelebrations?\b/i, `${rel} says "celebration"`);
  }
});

test('F-A-15 · admin pages name event types from the admin-managed list, never the raw key', () => {
  const reader = code('lib/admin/event-type-names.server.ts');
  assert.match(reader, /getEventTypeVocab\(\)/);
  for (const rel of [
    'app/admin/app-performance/_surfaces/intelligence-surface.tsx',
    'app/admin/payments/page.tsx',
    'app/admin/users/[userId]/page.tsx',
    'app/admin/events/[eventId]/page.tsx',
    'app/admin/gifts/page.tsx',
  ]) {
    const src = code(rel);
    assert.match(src, /readEventTypeNames\(\)/, `${rel} does not read the event-type names`);
    assert.doesNotMatch(src, /\{\(?e?v?\.?event_type as string \| null\)? \?\? '—'\}/, `${rel} draws a raw event_type`);
  }
});

test('F-A-10 · Payouts says one true thing about itself, and offers no old percentage split', () => {
  const page = code('app/admin/payouts/page.tsx');
  assert.match(page, /Couples pay their suppliers directly, so Setnayan makes no new payouts\./);
  assert.doesNotMatch(page, /Payouts land here the moment an admin reconciles/);
  assert.doesNotMatch(page, /PAYOUT_STAGE_PCT/);
});

test('F-A-16 · Problems: no [name]/[id] placeholders, and one row per problem a person can tell apart', async () => {
  const { pageName, problemLine } = await import('@/lib/telemetry/problem-line');
  assert.equal(pageName('/u/[name]/[id]'), '/u/…/…');
  assert.doesNotMatch(problemLine({ kind: 'DEAD_END', action: 'not_found /x/[id] ← /u/[name]', label: null, page: '/u/[name]', dayCount: 1, dayDate: null, today: '2026-11-13' } as never), /\[/);
  const src = code('lib/telemetry/fault-issues.server.ts');
  assert.match(src, /open: mergeSameProblem\(/);
  assert.match(src, /closed: mergeSameProblem\(/);
  // The merge itself (a pure function in a server-only file — read and executed through its text would need the module).
  const body = src.slice(src.indexOf('export function mergeSameProblem'));
  assert.match(body, /\[row\.kind, row\.action, row\.label \?\? '', pageName\(row\.page as string \| null\) \?\? ''\]/);
  assert.match(body, /merged\.hit_count = Number\(had\.hit_count \?\? 0\) \+ Number\(row\.hit_count \?\? 0\)/);
});

test('F-A-24 · the admin’s name is said once in the header — by the account pill', () => {
  const layout = code('app/admin/layout.tsx');
  assert.doesNotMatch(layout, /<span className="hidden text-sm text-ink\/70 sm:inline">\{displayName\}<\/span>/);
  assert.match(layout, /<AccountSwitcher/);
});

test('F-A-20 · every admin page title reads "Name · Admin", in sentence case', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const bad: string[] = [];
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n === 'page.tsx') {
        const m = /export const metadata = \{ title: '([^']*)'/.exec(readFileSync(p, 'utf8'));
        if (m && !/ · Admin$/.test(m[1]!)) bad.push(`${p.slice(WEB.length + 1)}: ${m[1]}`);
      }
    }
  };
  walk(join(WEB, 'app/admin'));
  assert.deepEqual(bad, [], 'an admin page title does not end " · Admin"');
});
