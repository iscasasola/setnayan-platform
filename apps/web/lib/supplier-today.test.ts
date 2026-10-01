/**
 * supplier-today.test.ts — the ONE Next card on a supplier's Today picks the
 * most urgent thing, in the approved order (DECISION_LOG 2026-10-01 "THE
 * SUPPLIER PHONE APP — APPROVED, WITH THE THREE RECOMMENDED ANSWERS": "Run the
 * day" is a Next card; on an event day it is THE Next card).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPLIER_NEXT_ORDER,
  eventsThisWeek,
  owedToYouPhp,
  pickSupplierNext,
  type SupplierNextInput,
} from './supplier-today';
import type { UpcomingEventRow, WhatsNewCard } from './vendor-overview';
import type { DueFeeBill } from './booking-fee-disclosure';

const row = (inDays: number, id = `e${inDays}`): UpcomingEventRow =>
  ({
    id: `up-${id}`,
    eventId: id,
    eventName: `Event ${id}`,
    date: '2026-10-10',
    place: 'Makati',
    category: 'photo_video',
    inDays,
    href: `/vendor-dashboard/clients/${id}?tab=details`,
    threadHref: null,
    opensCard: true,
  }) as unknown as UpcomingEventRow;

const inquiry = { kind: 'inquiry', threadId: 't1', descriptor: 'Wedding', eventDate: null, paxAtInquiry: 180 } as unknown as WhatsNewCard;

const base: SupplierNextInput = {
  answer: null,
  answerSince: null,
  deskIncomplete: false,
  upcoming: [],
  setupStep: null,
  findability: null,
  fee: null,
  owedPhp: null,
  now: Date.UTC(2026, 9, 1),
};

test('every rung of the order is reachable, in order', () => {
  const everything: SupplierNextInput = {
    ...base,
    upcoming: [row(0)],
    answer: inquiry,
    deskIncomplete: true,
    setupStep: { title: 'Add a service', body: 'b', cta: 'Add', href: '/vendor-dashboard/services' },
    findability: { title: 'Nobody can find you', body: 'b', cta: null },
    fee: { bill: { orderId: 'o1' } as DueFeeBill, copy: { headline: 'Fee due', detail: 'd', tone: 'due' } },
    owedPhp: 5000,
  };
  const seen: string[] = [];
  let input = everything;
  // Peel each winner off and check the next one takes its place.
  const peel: Record<string, (i: SupplierNextInput) => SupplierNextInput> = {
    run_day: (i) => ({ ...i, upcoming: [row(1)] }),
    answer: (i) => ({ ...i, answer: null }),
    unread: (i) => ({ ...i, deskIncomplete: false }),
    setup: (i) => ({ ...i, setupStep: null }),
    findable: (i) => ({ ...i, findability: null }),
    tomorrow: (i) => ({ ...i, upcoming: [] }),
    fee: (i) => ({ ...i, fee: null }),
    payday: (i) => ({ ...i, owedPhp: 0 }),
  };
  for (;;) {
    const k = pickSupplierNext(input).kind;
    seen.push(k);
    if (k === 'clear') break;
    input = peel[k]!(input);
  }
  assert.deepEqual(seen, [...SUPPLIER_NEXT_ORDER]);
});

test('on an event day the card is "Run the day" even with an answer waiting', () => {
  const n = pickSupplierNext({ ...base, upcoming: [row(0)], answer: inquiry });
  assert.equal(n.kind, 'run_day');
  assert.equal(n.action, 'Run the day');
  assert.deepEqual(n.target, { to: 'event-hub' });
});

test('a new inquiry opens its thread with one Reply button', () => {
  const n = pickSupplierNext({ ...base, answer: inquiry });
  assert.equal(n.action, 'Reply');
  assert.deepEqual(n.target, { to: 'thread', threadId: 't1' });
});

test('an unread desk never says "all caught up"', () => {
  assert.equal(pickSupplierNext({ ...base, deskIncomplete: true }).kind, 'unread');
});

test('events this week says "5+" when the five-row read is all inside the week', () => {
  assert.equal(eventsThisWeek([row(0), row(1), row(9)]), '2');
  assert.equal(eventsThisWeek([0, 1, 2, 3, 4].map((d) => row(d, `w${d}`))), '5+');
});

test('owed to you is expected − confirmed, and null (never 0) when unread', () => {
  assert.equal(owedToYouPhp({ confirmedPhp: 2000, expectedPhp: 10170, paydayMeasured: true }), 8170);
  assert.equal(owedToYouPhp({ confirmedPhp: 0, expectedPhp: 0, paydayMeasured: false }), null);
});
