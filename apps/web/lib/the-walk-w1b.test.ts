/**
 * the-walk-w1b.test.ts — the W1 walk's booking round (13 Nov 2026): what each fix holds.
 *
 * SABOTAGE: drop the /vendor-dashboard/portfolio redirect → RED; start the "Also mark delivered" box ticked again
 * (`useState(canAdvanceToDelivered)`) → RED; offer it before the day (drop `dayHasPassed`) → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('F-W1-64 · /vendor-dashboard/portfolio goes to the Portfolio', () => {
  assert.match(code('next.config.ts'), /\{ source: '\/vendor-dashboard\/portfolio', destination: '\/vendor-dashboard\/collections', permanent: false \}/);
});

test('F-W1-72 · "Also mark this supplier delivered" starts unticked and waits for the day', () => {
  const inbox = code('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/handover-inbox.tsx');
  assert.match(inbox, /const \[advance, setAdvance\] = useState\(false\);/);
  const page = code('app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx');
  assert.match(page, /const dayHasPassed = deliverEventDate !== null && deliverEventDate\.slice\(0, 10\) < manilaToday\(\);/);
  assert.match(page, /const canAdvanceToDelivered = dayHasPassed && /);
});
