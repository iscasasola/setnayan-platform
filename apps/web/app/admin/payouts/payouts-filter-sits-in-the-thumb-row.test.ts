/**
 * Payouts' four filters sit behind the round right of the thumb-row search (admin clean port, owner 19 Nov 2026).
 * The round is keyed on the view's key, and that key is namespaced by page ("to-approve.payouts"). The first build
 * keyed it on "payouts", so the round never drew, and every other test stayed green. This pins the two halves together.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { adminShellPlaceFor } from '../../../lib/admin/admin-pages';

const WEB = join(__dirname, '..', '..', '..');

test('the payouts address resolves to the view key the thumb row draws the filter round for', () => {
  for (const [path, qs] of [
    ['/admin/payments', 'view=payouts'],
    ['/admin/payments', 'view=payouts&filter=all&open=x'],
  ] as const) {
    const place = adminShellPlaceFor(path, new URLSearchParams(qs));
    assert.ok(place && place.kind === 'tab', `${path}?${qs} is not a tab view`);
    const key = place.kind === 'tab' ? place.view.key : '';
    const rows = readFileSync(join(WEB, 'app/admin/_components/admin-tab-rows.tsx'), 'utf8');
    assert.ok(
      rows.includes(`place.view.key === '${key}'`) && rows.includes('<PayoutsShowSort'),
      `admin-tab-rows.tsx does not draw the Payouts filter round for view "${key}"`,
    );
  }
});
