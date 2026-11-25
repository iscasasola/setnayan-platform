/**
 * Final check 25 Nov, area 6, batch 2 — a supplier read that did not answer is SAID, never drawn as zero, empty, "not
 * your client" or "opens on <date>". One test per finding; each reads the code that makes the claim.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const read = (rel: string) => stripComments(readFileSync(join(__dirname, '../..', rel), 'utf8'));
const hub = read('app/vendor-dashboard/on-the-day/page.tsx');
const live = read('app/vendor-dashboard/on-the-day/live/[eventId]/page.tsx');
const dayBody = read('app/vendor-dashboard/on-the-day/live/[eventId]/_components/event-day-body.tsx');
const client = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
const thread = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
const refresh = read('app/vendor-dashboard/messages/[threadId]/pay-confirm-actions.ts');
const pending = read('lib/vendor-service-payment-schedules.server.ts');

test('A6-17 · On the day keeps the bookings read’s `complete` and says an unread list, not "No events yet"', () => {
  assert.match(hub, /complete: bookingsComplete \} = await fetchVendorRoomEventsDetailed/);
  assert.match(hub, /const eventsUnread = !bookingsComplete \|\| !runsMeasured/);
  assert.ok(hub.indexOf('!selected && eventsUnread') < hub.indexOf('No events yet'), 'the unread answer comes before the empty one');
});

test('A6-18 · delivery and capture counts say "couldn’t load" on a refused read', () => {
  assert.match(hub, /const deliveryUnread = Boolean\(completionRes\.error \|\| handoverRes\.error\)/);
  assert.match(hub, /const mediaUnread = Boolean\(mediaRes\.error\)/);
  assert.match(hub, /mediaUnread \? 'Couldn’t load'/);
});

test('A6-21 · the live headcount is "—" on a failed brief, never 0 / 0', () => {
  assert.match(live, /headcount=\{has\('pax_headcount'\) \? \(brief \? \{ attending, invited \} : 'unread'\) : null\}/);
  assert.match(dayBody, /headcount === 'unread' \? '—'/);
});

test('A6-22 · an unread bookings or crew-grant read is said, not "opens on <date>" or the shop papers', () => {
  assert.match(live, /data: grants, error: grantsError/);
  assert.match(live, /if \(grantsError\) return <DayReadFailed/);
  assert.match(live, /if \(!booking && ownRoomUnread\) return <DayReadFailed/);
  assert.ok(live.indexOf('ownRoomUnread) return') < live.indexOf("live=not-yet"), 'unread is decided before not-yet');
});

test('A6-43 · a refused booking row makes its money parts unread, never measured-empty', () => {
  assert.match(client, /data: evRow, error: evRowError/);
  assert.match(client, /const changeOrdersMeasured = !changeOrderRowsError && !bookingRowUnread/);
  assert.match(client, /const askRead = bookingRowUnread\s*\?\s*\{ rows: \[\] as OpenPaymentAskRow\[\], error: null, complete: false \}/);
  assert.match(client, /if \(evRowError\) ledgerUnreadable = true/);
});

test('A6-44 · unread fee bills and waived fees are said on the client page', () => {
  assert.match(client, /clientFeeBillsRead === FEE_BILLS_UNREADABLE \? \(\s*<ReadFailedNote mark="client-fee-bills">/);
  assert.match(client, /clientWaivedRead === FEE_BILLS_UNREADABLE \? \(\s*<ReadFailedNote mark="client-fee-waived">/);
});

test('A6-02 · A6-45 · the pending-payments reader reports whether it answered, and both pages say it', () => {
  assert.match(pending, /data: bookings, error: bookingsError/);
  assert.match(pending, /data: rows, error: rowsError/);
  assert.match(pending, /return \{ payments: \[\], complete: false \}/);
  assert.match(client, /if \(!pending\.complete\) ledgerUnreadable = true/);
  assert.match(thread, /const pendingUnread = !pendingRead\.complete/);
  assert.match(thread, /<ReadFailedNote mark="thread-pending-payments">/);
  assert.match(thread, /if \(pendingUnread\) toolsState\.paymentsToConfirm = Math\.max\(1, pendingPayments\.length\)/);
  assert.match(refresh, /if \(!pendingRead\.complete\) return null/);
});

test('A6-47 · only the brief RPC’s refusals bounce to Clients; a refused contracts read never offers a second upload', () => {
  assert.match(client, /error\.code !== '42501' && error\.code !== 'P0002'/);
  assert.match(client, /We couldn&rsquo;t load this client right now\./);
  assert.match(client, /const hasContract = contracts\.length > 0 \|\| Boolean\(contractRowsError\)/);
});

test('A6-05 · a refused live-quote read is said above the builder, never a blank builder that reads as "no quote"', () => {
  assert.match(thread, /quoteRevisionUnread = true/);
  assert.match(thread, /cm === 'quote' && quoteRevisionUnread \? \(\s*<ReadFailedNote mark="quote-revision">/);
});
