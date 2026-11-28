/**
 * a-post-on-facebooks-schedule-stays-on-the-queue-page.test.ts — once the flush hands a post to Facebook
 * (`scheduled_on_fb`, lib/social/fb-queue.ts), the admin queue page must still list it, or its Pull and Edit
 * controls cannot be reached and the post shows only in Meta Business Suite.
 *
 * The queue read in `social-queue-surface.tsx` is the one place those rows are loaded, so this pins its status
 * list: every status `fb-queue.ts` leaves a waiting post in must be in it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SURFACE = stripComments(
  readFileSync(join(HERE, '..', '..', 'app', 'admin', 'studio', '_surfaces', 'social-queue-surface.tsx'), 'utf8'),
);

/** The status list of the queue read: the `.in('status', [...])` on the select that orders by `scheduled_for`. */
function queueStatuses(src: string): string[] {
  const m = src.match(/\.in\(\s*'status'\s*,\s*\[([^\]]*)\]\s*\)\s*\.order\(\s*'scheduled_for'/);
  assert.ok(m, 'the queue read (status list, then order by scheduled_for) was not found in social-queue-surface.tsx');
  return [...(m[1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1] ?? '');
}

test('the queue page loads posts waiting on Facebook, next to the ones still with us', () => {
  const statuses = queueStatuses(SURFACE);
  for (const s of ['takedown_needed', 'scheduled', 'scheduled_on_fb', 'publishing']) {
    assert.ok(statuses.includes(s), `the queue page no longer loads '${s}' posts (has: ${statuses.join(', ')})`);
  }
});

test('the row type on the queue page knows the scheduled_on_fb status', () => {
  assert.match(SURFACE, /status:\s*[^;]*'scheduled_on_fb'/);
});

test('a pulled post Facebook still holds leads the queue page with its Remove, and every flush retries it first', () => {
  assert.match(SURFACE, /Still scheduled on Facebook — remove it/);
  assert.match(SURFACE, /status === 'takedown_needed'[\s\S]*?action=\{pullSocialPost\}/);
  const FLUSH = stripComments(readFileSync(join(HERE, 'flush.ts'), 'utf8'));
  const body = FLUSH.slice(FLUSH.indexOf('export async function runSocialFlush'));
  const retry = body.indexOf('await retryTakedowns(');
  assert.ok(retry > 0, 'runSocialFlush retries the Facebook take-downs');
  for (const later of ['await sweepCoupleCreations(', 'await handOffToFacebook(', 'await dispatchDuePosts(']) {
    assert.ok(body.indexOf(later) > retry, `${later} runs after the take-down retry`);
  }
});
