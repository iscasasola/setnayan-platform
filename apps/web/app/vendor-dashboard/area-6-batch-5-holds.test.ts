/**
 * Final check 25 Nov, area 6, batch 5 (plan batch A4) — each claim this batch makes, held by the code that makes it.
 * A6-08 notification links come from the route builders; A6-07 a refused "comes with" read is said on the quote card;
 * A6-15 a refused notifications read (a missing relation included) says "couldn't load", never "Nothing yet.".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { routes } from '@/lib/routes';
import { readOwnNotifications, fetchOwnNotifications } from '@/lib/notifications';
import type { SupabaseClient } from '@supabase/supabase-js';

const read = (rel: string) => stripComments(readFileSync(join(__dirname, '../..', rel), 'utf8'));
const pay = read('app/vendor-dashboard/messages/[threadId]/pay-confirm-actions.ts');
const pax = read('app/vendor-dashboard/messages/[threadId]/pax-actions.ts');
const thread = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
const maker = read('app/_components/proposal-maker.tsx');
const notifPage = read('app/vendor-dashboard/notifications/page.tsx');
const notifView = read('app/vendor-dashboard/notifications/notifications-view.tsx');

test('A6-08 · the chat actions type no "/dashboard/${" link; the builders draw the same address as before', () => {
  for (const [name, src] of [['pay-confirm-actions', pay], ['pax-actions', pax]] as const) {
    assert.ok(!src.includes('`/dashboard/${'), `${name} types a /dashboard/ link`);
    assert.match(src, /routes\.dashboard\./, `${name} uses a route builder`);
  }
  assert.equal(`${routes.dashboard.vendors.workspace('E1', 'V1')}?tab=payments`, '/dashboard/E1/vendors/V1/workspace?tab=payments');
  assert.equal(`${routes.dashboard.messages.detail('E1', 'T1')}?view=decisions`, '/dashboard/E1/messages/T1?view=decisions');
  assert.equal(routes.dashboard.budget('E1'), '/dashboard/E1/budget');
});

test('A6-07 · a refused "comes with" read is logged and said on the picked card, never an empty bundle', () => {
  assert.match(thread, /if \(linkRows\.error\) logQueryError\('vendorThread\.serviceLinks'/);
  assert.match(thread, /const comesWithUnread = Boolean\(linkRows\.error\)/);
  assert.match(thread, /\.\.\.\(comesWithUnread \? \{ comesWithUnread: true \} : \{\}\)/);
  assert.match(maker, /pickedCards\[c\.id\] && c\.comesWithUnread/);
  assert.match(maker, /\{c\.label\}: \{COMES_WITH_UNREAD_WORDS\}/);
});

function fakeNotifications(answer: { data: unknown; error: unknown }): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => Promise.resolve(answer),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

test('A6-15 · a missing relation is an unread notifications read, never an empty list', async () => {
  const err = console.error;
  console.error = () => {};
  try {
    const missing = fakeNotifications({ data: null, error: { code: '42P01', message: 'relation "notifications" does not exist' } });
    assert.deepEqual(await readOwnNotifications(missing, 'u1'), { items: [], unread: true });
    await assert.rejects(fetchOwnNotifications(missing, 'u1'), 'the throwing form never answers []');
    const denied = fakeNotifications({ data: null, error: { code: '42501', message: 'permission denied' } });
    assert.equal((await readOwnNotifications(denied, 'u1')).unread, true);
  } finally {
    console.error = err;
  }
  const ok = fakeNotifications({ data: [], error: null });
  assert.deepEqual(await readOwnNotifications(ok, 'u1'), { items: [], unread: false }, 'a real empty list stays empty');
});

test('A6-15 · the supplier notifications page says the failure before it can say "Nothing yet."', () => {
  assert.match(notifPage, /\{ items, unread \}, switcherData\] = await Promise\.all\(\[readOwnNotifications/);
  assert.match(notifPage, /unread=\{unread\}/);
  assert.match(notifView, /\{unread \? \(\s*<ReadFailedBody mark="notifications">\{NOTIFICATIONS_UNREAD_WORDS\}<\/ReadFailedBody>/);
  assert.ok(notifView.indexOf('NOTIFICATIONS_UNREAD_WORDS}') < notifView.indexOf('Nothing yet.'));
});
