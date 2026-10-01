/**
 * A guest is never told to reply by a date that has passed, or by a date the
 * host never set (controller decision 2026-09-30).
 *
 * The owner's birthday was created on its own day, and the invitation printed
 * "Please reply by <30 days before the party>", a default nobody chose, already
 * a month gone. `guestReplyBy` is the one rule; every guest-facing surface (the
 * invitation, the reply page, the reminder email) must go through it and never
 * through `resolveReplyBy`, which keeps the default for the host's editor only.
 *
 * Sabotage: make `guestReplyBy` fall back to the event date, or drop its
 * `< today` check, or point a surface back at `resolveReplyBy`, and this fails.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guestReplyBy, todayYmd } from './rsvp-ask';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

test('no host-set date → no line, whatever the event date', () => {
  assert.equal(guestReplyBy({ deadline: null, today: '2026-09-30' }), null);
  assert.equal(guestReplyBy({ deadline: '', today: '2026-09-30' }), null);
  assert.equal(guestReplyBy({ deadline: undefined, today: '2026-09-30' }), null);
});

test('a host-set date that has passed → no line', () => {
  assert.equal(guestReplyBy({ deadline: '2026-09-29', today: '2026-09-30' }), null);
  assert.equal(guestReplyBy({ deadline: '2026-08-31', today: '2026-09-30' }), null);
});

test('a host-set date today or later → that date', () => {
  assert.deepEqual(guestReplyBy({ deadline: '2026-09-30', today: '2026-09-30' }), { date: '2026-09-30' });
  assert.deepEqual(guestReplyBy({ deadline: '2026-11-18', today: '2026-09-30' }), { date: '2026-11-18' });
});

test('todayYmd is a calendar day in the event zone', () => {
  // 2026-09-30T20:00Z is already 1 Oct in Manila.
  assert.equal(todayYmd('Asia/Manila', new Date('2026-09-30T20:00:00Z')), '2026-10-01');
  assert.equal(todayYmd(null, new Date('2026-09-30T20:00:00Z')), '2026-10-01');
  assert.equal(todayYmd('Not/AZone', new Date('2026-09-30T20:00:00Z')), '2026-10-01');
});

test('every guest-facing surface asks guestReplyBy, never the host-side default', () => {
  for (const rel of [
    '../app/[slug]/invite/enter/page.tsx',
    '../app/[slug]/invite/reply/page.tsx',
    'guest-reminder-emails.ts',
  ]) {
    const code = src(rel);
    assert.match(code, /guestReplyBy\(\{/, `${rel} no longer asks guestReplyBy`);
    assert.doesNotMatch(code, /resolveReplyBy\(/, `${rel} prints the host-side default (or a passed date) again`);
  }
});
