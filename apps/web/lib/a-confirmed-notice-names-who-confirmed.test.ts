/**
 * 🔔 A CONFIRMED NOTICE NAMES WHO CONFIRMED, AND LANDS WITHOUT BREAKING HOME (live fault, 2026-11-13).
 *
 * The owner tapped "They confirmed — they’re your Partner" on Home and the page fell to "Something on our end
 * didn’t work" (Problems log: PAGE_CRASH · crash global · /dashboard, build b1bbbf8a07). Two halves:
 *
 *   1. the title named nobody — the confirmer's person node had no `display_name`, and the account's own name was
 *      never asked (`labelConfirmedTitle`);
 *   2. the tap is `markNotificationRead`, which revalidated `/dashboard?seg=people` — a query, not a path — and
 *      redirected to the page the owner was already on. It now revalidates the path (`revalidationPathOf`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { labelConfirmedTitle } from '@/lib/people-label-handshake';
import { revalidationPathOf } from '@/lib/notification-return';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · no name anywhere → "Your partner confirmed", never "They confirmed"', () => {
  assert.equal(labelConfirmedTitle([null, null], 'partner'), 'Your partner confirmed');
  assert.equal(labelConfirmedTitle(['  ', undefined], 'partner'), 'Your partner confirmed');
  assert.equal(labelConfirmedTitle([null], 'sibling'), 'Confirmed — they’re your Sibling');
  for (const w of ['partner', 'sibling', 'friend'] as const) {
    assert.doesNotMatch(labelConfirmedTitle([null, null], w), /^They\b/);
  }
});

test('2 · the person node’s name wins, the account’s name fills in when it is empty', () => {
  assert.equal(labelConfirmedTitle(['Maria Santos', 'Ria'], 'partner'), 'Maria confirmed — they’re your Partner');
  assert.equal(labelConfirmedTitle([null, 'Ria Cruz'], 'partner'), 'Ria confirmed — they’re your Partner');
});

test('3 · confirmLabel reads the account’s name and says the title through the one helper', () => {
  const s = src('app/dashboard/(account)/people/actions.ts');
  const body = s.slice(s.indexOf('async function confirmLabel('), s.indexOf('async function declineLabel('));
  assert.match(body, /from\('users'\)\.select\('display_name'\)\.eq\('user_id', user\.id\)/);
  assert.match(body, /labelConfirmedTitle\(/);
  assert.doesNotMatch(body, /\?\? 'They'/);
});

test('4 · a notice’s return_to revalidates its PATH, never its query', () => {
  assert.equal(revalidationPathOf('/dashboard?seg=people'), '/dashboard');
  assert.equal(revalidationPathOf('/dashboard/abc/guests#row'), '/dashboard/abc/guests');
  assert.equal(revalidationPathOf('/dashboard'), '/dashboard');
  const s = src('lib/notification-actions.ts');
  assert.doesNotMatch(s, /revalidatePath\(returnTo\)/);
  assert.equal(s.match(/revalidatePath\(revalidationPathOf\(returnTo\)\)/g)?.length, 2);
});
