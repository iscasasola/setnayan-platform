import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideReply } from './engine';
import type { EngineInput, VendorStoreSnapshot } from './types';

const store: VendorStoreSnapshot = {
  businessName: 'Blooms & Co.',
  services: [
    {
      serviceId: 's1',
      category: 'wedding_photography',
      title: 'Wedding Signature',
      startingPricePhp: 48000,
      pricingBasis: 'fixed',
      perPaxPricePhp: null,
      minPax: null,
      basePax: 150,
      hourBasePhp: null,
      minHours: null,
      extraHourPhp: null,
      addedPaxPricePhp: null,
      crewSize: 4,
      crewMealIncluded: true,
      transportIncluded: false,
      transportFlatFeePhp: null,
      recommendedLeadTimeMonths: 6,
      lastMinuteEndMonths: null,
      lastMinuteSurchargePct: null,
      dailyCapacity: 1,
      inclusions: [],
      discounts: [],
      addons: [],
    },
  ],
  packages: [],
  coverages: [],
  reviews: [],
  avgRating: null,
  reviewCount: null,
};

function inp(text: string, extra: Partial<EngineInput> = {}): EngineInput {
  return { inquiryText: text, store, ...extra };
}

test('price inquiry -> reply with the real quote', () => {
  const d = decideReply(inp('How much is your package?'));
  assert.equal(d.action, 'reply');
  assert.equal(d.intent, 'price');
  assert.ok(d.replyText?.includes('₱48,000'), d.replyText ?? 'null');
});

test('customization -> handoff, no text', () => {
  const d = decideReply(inp('can you customize a package for us?'));
  assert.equal(d.action, 'handoff');
  assert.equal(d.intent, 'customization');
  assert.equal(d.replyText, null);
  assert.equal(d.handoffReason, 'customization_request');
});

test('booking -> handoff', () => {
  const d = decideReply(inp("we want to book, what's the downpayment?"));
  assert.equal(d.action, 'handoff');
  assert.equal(d.intent, 'booking');
  assert.equal(d.handoffReason, 'booking_intent');
});

test('unknown -> handoff', () => {
  const d = decideReply(inp('hi there!'));
  assert.equal(d.action, 'handoff');
  assert.equal(d.intent, 'unknown');
});

test('factual intent but empty store -> handoff (no_store_data)', () => {
  const d = decideReply({ inquiryText: 'how much?', store: { ...store, services: [] } });
  assert.equal(d.action, 'handoff');
  assert.equal(d.intent, 'price');
  assert.equal(d.handoffReason, 'no_store_data');
});

test('availability without a date -> clarify', () => {
  const d = decideReply(inp('are you available?'));
  assert.equal(d.intent, 'availability');
  assert.equal(d.action, 'clarify');
  assert.ok(d.replyText?.includes('which date'), d.replyText ?? 'null');
});

test('availability with date + signal -> reply', () => {
  const d = decideReply(
    inp('are you free on my date?', {
      event: { primaryDate: '2027-06-14', candidateDates: [], pax: null, budgetPerHeadPhp: null, region: null },
      signals: { dateAvailable: true },
    }),
  );
  assert.equal(d.action, 'reply');
  assert.ok(d.replyText?.includes('looks open'), d.replyText ?? 'null');
});

test('weak / ambiguous match -> handoff (low_confidence)', () => {
  const d = decideReply(inp('budget?'));
  assert.equal(d.action, 'handoff');
  assert.equal(d.intent, 'price');
  assert.equal(d.confidence, 0.6);
  assert.equal(d.handoffReason, 'low_confidence');
});

test('strong match auto-answers (pins the confidence boundary)', () => {
  const d = decideReply(inp('what are your rates?'));
  assert.equal(d.action, 'reply');
  assert.equal(d.confidence, 0.9);
});

test('booking word-forms hand off, never auto-answer', () => {
  const cases = [
    'can I make a booking for your services?',
    'we already booked you, what services do we get?',
    "I'd like reserving a slot",
    "let's proceed with booking your services",
  ];
  for (const t of cases) {
    const d = decideReply(inp(t));
    assert.equal(d.action, 'handoff', `"${t}" -> ${d.action}/${d.intent}`);
    assert.equal(d.replyText, null, `"${t}" leaked a reply`);
  }
});
