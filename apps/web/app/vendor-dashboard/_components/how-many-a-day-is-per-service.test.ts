/**
 * how-many-a-day-is-per-service.test.ts — 🔢 THE DAILY LIMIT IS PER SERVICE, NOT PER SHOP (owner 13 Nov 2026,
 * DECISION_LOG d8ec0922: "How many a day" is per service, not per shop).
 *
 *   1 · Today's setup has no step 7: the checklist is the six ("N of 6"), and no "How many a day" row rides under it.
 *   2 · The service card asks it plainly, on its own existing column (`vendor_services.daily_capacity`) — no new field.
 *
 * Sabotage: mount a `daily` row on the setup folds again → RED; rename the card's question → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · Today’s setup has no "How many a day" row — the checklist stays the six', () => {
  assert.ok(!existsSync(join(WEB, 'app/vendor-dashboard/_components/setup-daily-step.tsx')), 'the step-7 row is back');
  for (const rel of [
    'app/vendor-dashboard/_components/supplier-setup-folds.tsx',
    'app/vendor-dashboard/_components/supplier-setup-screen.tsx',
    'app/vendor-dashboard/page.tsx',
    'app/dev/supplier-lab/today-easy-lab.tsx',
  ]) {
    const src = code(rel);
    assert.doesNotMatch(src, /SetupDailyStep|setupDailyView|\bdaily=\{/, `${rel} mounts a shop-wide "How many a day" on Today`);
  }
  assert.doesNotMatch(code('lib/supplier-setup.ts'), /DAILY_STEP_N|setupDailyView/);
});

test('2 · each service card asks its own daily limit, on its own column', () => {
  const maker = code('app/vendor-dashboard/services/_components/canvas-maker.tsx');
  assert.match(maker, /label="How many events a day can this service take\?"\s*htmlFor="daily_capacity"/);
  assert.match(maker, /name="daily_capacity"/);
});
