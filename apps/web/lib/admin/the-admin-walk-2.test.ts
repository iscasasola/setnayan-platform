/**
 * 🚶 ADMIN WALK, ROUND 2 (W1 on live 5453b77, 14 Nov 2026). Each test names the walk row.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '../strip-comments';
import { problemLine, plainWords } from '../telemetry/problem-line';

const code = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));
const day = { dayCount: 1, dayDate: '2026-11-14', today: '2026-11-14' };

test('F-A-16 · a Problems line is plain words: no code names, no placeholders, never "vendor"', () => {
  const lines = [
    problemLine({ ...day, kind: 'DB_WRITE_REFUSED', action: 'POST rpc/get_vendor_cocktail_editor', label: null, page: '/vendor-dashboard/services' }),
    problemLine({ ...day, kind: 'DB_READ_REFUSED', action: 'GET vendor_profiles', label: null, page: '/admin' }),
    problemLine({ ...day, kind: 'BUTTON_FAIL', action: 'app/admin/actions.ts#refreshBottleneckSignals', label: null, page: '/admin/insights' }),
    problemLine({ ...day, kind: 'BUTTON_FAIL', action: 'x#y', label: 'Submit for [name]', page: '/admin/approvals' }),
  ];
  for (const l of lines) {
    assert.doesNotMatch(l, /vendor/i, l);
    assert.doesNotMatch(l, /\[|\]|_|database refused|rpc|[a-z][A-Z]/, l);
  }
  // A `get_…` call is a read even when it is POSTed and filed as a refused write — never "Saving … get".
  assert.match(lines[0]!, /^Loading the supplier cocktail editor .* — could not load/);
  assert.doesNotMatch(lines[0]!, /Saving|get\b/);
  assert.match(
    problemLine({ ...day, kind: 'DB_WRITE_REFUSED', action: 'POST rpc/save_vendor_cocktail_editor', label: null, page: null }),
    /^Saving the supplier cocktail editor — could not save/,
  );
  assert.match(lines[1]!, /^Loading the supplier profiles .* — could not load/);
  assert.match(lines[2]!, /^Refresh bottleneck signals on admin — did not work/);
  assert.match(lines[3]!, /^Submit for … button/);
  assert.equal(plainWords('vendorPayouts_list'), 'supplier Payouts list');
});

test('F-A-08 · each verification paper names its supplier (or says the name could not load)', () => {
  const page = code('app/admin/verification-docs/page.tsx');
  assert.match(page, /verificationDocSupplierNames\(/);
  assert.match(page, /data-doc-supplier=""/);
  assert.match(page, /Supplier name couldn’t load/);
  assert.match(code('lib/verification-doc-suppliers.server.ts'), /\.from\('vendor_profiles'\)\s*\.select\('vendor_profile_id, business_name'\)/);
});

test('F-A-10 · Payouts offers no escrow stage filters', () => {
  const page = code('app/admin/payouts/page.tsx');
  assert.doesNotMatch(page, /STAGE_TABS|All stages|Immediate \(verified\)|at confirmation|at the event start|after the event'/);
  assert.doesNotMatch(page, /params\.set\('stage'/);
});

test('F-A-20 · admin tab titles read "X · Admin" (no "· Setnayan", no "Setnayan HQ")', () => {
  const layout = code('app/admin/layout.tsx');
  assert.match(layout, /export const metadata = \{ title: \{ absolute: 'Admin', template: '%s' \} \};/);
  assert.doesNotMatch(layout, /title: 'Setnayan HQ'/);
  assert.match(code('app/admin/booking-fees/page.tsx'), /title: 'Booking fees · Admin'/);
  assert.match(code('app/admin/verification-docs/page.tsx'), /title: 'Verification documents · Admin'/);
  assert.match(code('app/admin/page.tsx'), /title: 'Work · Admin'/);
});

test('F-A-21 · the revenue card’s explainer sits behind the ⓘ', () => {
  const card = code('app/admin/money/_components/revenue-summary.tsx');
  assert.match(card, /<Explain title="What this counts"[^>]*>\s*\{revenueScopeNote\(s\)\}\s*<\/Explain>/);
  assert.doesNotMatch(card, /<p className="mt-3 text-xs leading-relaxed text-ink\/55">\{revenueScopeNote\(s\)\}<\/p>/);
});
