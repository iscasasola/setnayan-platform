/**
 * Final check 25 Nov, area 6, batch 3 — Clients (Money, Events, Dates), the chat list and the client's sub-pages say a
 * read that did not answer, never "none", "Not available", "open with 0 waiting" or a silent bounce.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const read = (rel: string) => stripComments(readFileSync(join(__dirname, '../..', rel), 'utf8'));
const chat = read('lib/chat.ts');
const moneyLog = read('app/vendor-dashboard/customers/_components/money-log.tsx');
const moneySeg = read('app/vendor-dashboard/customers/_components/money-segment.tsx');
const customers = read('app/vendor-dashboard/customers/page.tsx');
const editorialLib = read('lib/editorial-vendor-media.ts');
const editorialPage = read('app/vendor-dashboard/clients/[eventId]/editorial-media/page.tsx');
const editorialBody = read('app/vendor-dashboard/clients/[eventId]/editorial-media/editorial-media-body.tsx');
const mood = read('app/vendor-dashboard/clients/[eventId]/mood-board/page.tsx');
const theirPart = read('app/vendor-dashboard/clients/[eventId]/their-event/[part]/page.tsx');
const theirBody = read('app/vendor-dashboard/clients/[eventId]/_components/their-event-part-body.tsx');
const schedule = read('app/vendor-dashboard/clients/[eventId]/_components/supplier-schedule.tsx');

test('A6-13 · a chat list whose archive state did not load is reported incomplete', () => {
  const fallback = chat.slice(chat.indexOf("'fetchVendorThreads (archive embed)'"));
  assert.match(fallback.slice(0, fallback.indexOf('export async function fetchVendorThreads(')), /complete: false,/);
});

test('A6-31 · Log a payment says an unread customer list, never "No booked customer yet"', () => {
  assert.match(moneySeg, /const logCustomers: MoneyLogCustomer\[\] \| null = paydayIncomplete \? null :/);
  assert.ok(moneyLog.indexOf('customers === null') < moneyLog.indexOf('No booked customer yet'));
});

test('A6-35 · the month list follows its tile: unread is said, and a refused branches read is not "Main"', () => {
  assert.match(customers, /monthCount === null\s*\?\s*'We couldn’t load this month’s bookings right now\.'/);
  assert.match(customers, /const branchesUnread = Boolean\(branchesRes\.error\)/);
});

test('A6-36 · the day sheet reads the honest twins and answers "Couldn’t read" on a short read', () => {
  assert.match(customers, /fetchVendorPoolsOrNull\(supabase, vendorProfileId\),\s*fetchVendorPoolBookingsDetailed\(supabase, vendorProfileId\)/);
  assert.match(customers, /const daySeatsUnread = poolsRead === null \|\| !bookingsRead\.complete/);
  assert.match(customers, /answer: daySeatsUnread \? DAY_UNREAD_ANSWER :/);
  assert.match(customers, /!waitlistRead\.ok \?/);
});

test('A6-54 · editorial eligibility says a refused read, never "Not available for this event yet"', () => {
  assert.match(editorialLib, /if \(evRowsError\) \{\s*logQueryError\([^)]*\);\s*return \{ \.\.\.none, unread: true \}/);
  assert.match(editorialLib, /if \(svcRowsError\) \{\s*logQueryError\([^)]*\);\s*return \{ \.\.\.none, unread: true \}/);
  assert.match(editorialPage, /eligibility\.unread\s*\?\s*\{ kind: 'unread' \}/);
  assert.ok(editorialBody.indexOf("view.kind === 'unread'") < editorialBody.indexOf('Not available for this event yet'));
});

test('A6-55 · A6-56 · only the RPCs’ refusals leave the mood board and their-event pages', () => {
  for (const src of [mood, theirPart]) {
    assert.match(src, /error && error\.code !== '42501' && error\.code !== 'P0002'/);
    assert.match(src, /<ReadFailedBody mark=/);
  }
  assert.match(theirPart, /hubSlug = evError \? 'unread'/);
  assert.ok(theirBody.indexOf("hubSlug === 'unread'") < theirBody.indexOf('not published their Hub'));
});

test('second pass · no screen tells a person to "pull to refresh" (the app turns the gesture off)', () => {
  assert.doesNotMatch(schedule, /pull to refresh/i);
});
