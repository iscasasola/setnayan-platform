/**
 * 📅 A CANDIDATE DATE REACHES THE SUPPLIER (walk 13 Nov 2026). A birthday with ONE candidate date (date_mode
 * 'specific', date_candidates ['2027-05-22'], event_date null) asked a supplier for a quote, and the supplier read
 * "TEST's Birthday (date not set)" · DATE "Not set yet" · Target date "Not set yet". The options are now said wherever
 * the supplier sees the date, from `fitDateScope` — the one reader Find already judges on.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eventChatTitle, eventDateOptionWords, eventRowTitle } from '@/lib/event-chat-title';
import { buildCustomerEventSummary } from '@/lib/customer-event-summary';
import { stripComments } from '@/lib/strip-comments';

const NOW = Date.UTC(2026, 10, 13);
const walk = { eventDate: null, precision: null, candidates: ['2027-05-22'] };

test('the options are said from fitDateScope — one, several, a window; nothing when a day is set or nothing is', () => {
  assert.equal(eventDateOptionWords(walk), 'May 22, 2027 · option');
  assert.equal(eventDateOptionWords({ ...walk, candidates: ['2027-06-05', '2027-05-22'] }), 'May 22, 2027 or Jun 5, 2027 · options');
  assert.equal(eventDateOptionWords({ eventDate: null, precision: null, windowStart: '2027-05-01', windowEnd: '2027-05-20' }), 'May 1, 2027 – May 20, 2027 · window');
  assert.equal(eventDateOptionWords({ eventDate: '2027-05-22', precision: 'day' }), null, 'a set day is the caller’s own words');
  assert.equal(eventDateOptionWords({ eventDate: null, precision: null }), null, 'nothing → "Not set yet" stands');
  assert.equal(eventDateOptionWords({ eventDate: null, precision: null, candidates: [] }), null);
});

test('the chat title, the Customers row and the Target date fact say the option, not "not set"', () => {
  const options = eventDateOptionWords(walk);
  assert.equal(eventChatTitle({ name: 'TEST walk 2 birthday', kind: 'Birthday', date: null, nowMs: NOW, options }), "TEST's Birthday (May 22, 2027 · option)");
  assert.equal(eventChatTitle({ name: 'TEST walk 2 birthday', kind: 'Birthday', date: null, nowMs: NOW }), "TEST's Birthday (date not set)");
  assert.equal(eventChatTitle({ name: 'Ana', kind: 'Wedding', date: '2027-01-02', nowMs: NOW, options }), "Ana's Wedding (Jan 2, 2027)", 'a set date wins');
  assert.equal(eventRowTitle({ name: 'TEST walk 2 birthday', kind: 'Birthday', date: null, nowMs: NOW, options }), 'TEST walk 2 birthday · May 22, 2027 · option');
  const s = buildCustomerEventSummary({ hostName: null, eventTypeLabel: 'Birthday', eventName: null, createdAt: null, targetDate: null, targetDateOptions: options, pax: null, location: null, lockedVendors: null });
  const row = s.facts.find((f) => f.label === 'Target date')!;
  assert.equal(row.value, 'May 22, 2027 · option');
  assert.equal(row.unknown, false);
  const none = buildCustomerEventSummary({ hostName: null, eventTypeLabel: null, eventName: null, createdAt: null, targetDate: null, pax: null, location: null, lockedVendors: null });
  assert.equal(none.facts.find((f) => f.label === 'Target date')!.value, 'Not set yet');
});

test('every supplier read of the date carries the candidates and the window', () => {
  const read = (p: string) => stripComments(readFileSync(join(import.meta.dirname, '..', p), 'utf8'));
  for (const p of [
    'lib/supplier-event-lines.server.ts',
    'lib/inquiry-customer.server.ts',
    'app/vendor-dashboard/customers/page.tsx',
    'app/vendor-dashboard/messages/[threadId]/page.tsx',
  ]) {
    const src = read(p);
    assert.match(src, /date_candidates, date_window_start, date_window_end/, `${p} does not read the candidate dates`);
    assert.match(src, /eventDateOptionWords\(/, `${p} does not say them`);
  }
  assert.match(read('app/vendor-dashboard/messages/page.tsx'), /options: facts\.dateOptions/, 'the chat list title drops the options');
  assert.match(read('app/vendor-dashboard/messages/[threadId]/page.tsx'), /targetDateOptions: dateOptions/);
});

test('the opening message names the candidate day instead of "no date yet"', async () => {
  const { supplierInquiryBody } = await import('@/lib/supplier-inquiry-opening');
  const { eventCandidateDays } = await import('@/lib/event-chat-title');
  const profile = { terminology: { eventWord: 'birthday', register: 'celebratory' } } as never;
  const days = eventCandidateDays(walk);
  assert.equal(days, 'May 22, 2027');
  const body = supplierInquiryBody(profile, { dated: false, candidateDays: days });
  assert.match(body, /we're considering May 22, 2027/);
  assert.doesNotMatch(body, /no date yet/);
  assert.match(supplierInquiryBody(profile, { dated: false }), /no date yet/, 'truly no date still says so');
  const read = (p: string) => stripComments(readFileSync(join(import.meta.dirname, '..', p), 'utf8'));
  assert.match(read('app/v/[slug]/inquiry-actions.ts'), /candidateDays: theEvent\?\.event_date \? null : eventCandidateDays\(/);
  assert.match(read('app/dashboard/[eventId]/vendors/_actions/unlock-category.ts'), /candidateDays: \(ev as/);
});
