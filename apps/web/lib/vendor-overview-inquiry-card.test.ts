/**
 * Vendor Overview "What's new" — pre-accept inquiry card DTO (Glass PR-6b ·
 * spec Vendor_Inquiry_Anonymization_Spec_2026-07-15 · extends #3266). Node
 * built-in runner via tsx (`pnpm test:unit`).
 *
 * The load-bearing guarantee: the card payload served to the client for a
 * PENDING (pre-accept) inquiry carries NO couple identity — no `display_name`,
 * no `eventName` field at all, only the neutral anonymized descriptor + the
 * non-identifying facts. Anonymization is a DATA-layer property, so this asserts
 * the DTO the builder produces, not the rendered UI.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildInquiryCard } from './vendor-overview-inquiry-card';

test("What's-new inquiry card: no `eventName` field is ever shipped", () => {
  const card = buildInquiryCard({
    threadId: 'S89T-abc',
    createdAt: '2026-07-15T00:00:00Z',
    eventDate: '2026-12-20',
    eventType: 'wedding',
    region: 'ncr',
    category: 'Photography',
  });
  // The field that leaked the couple's event title is structurally gone.
  assert.equal('eventName' in card, false);
  // What it ships instead is the neutral placeholder.
  assert.ok(card.descriptor.startsWith('A couple planning'));
});

test("What's-new inquiry card: payload contains no couple identity", () => {
  const card = buildInquiryCard({
    threadId: 'S89T-xyz',
    createdAt: '2026-07-15T00:00:00Z',
    eventDate: '2026-11-11',
    eventType: 'wedding',
    region: 'c-visayas',
    category: 'Catering',
  });
  const serialized = JSON.stringify(card);
  // No name-like tokens can appear — the descriptor is built from event_type +
  // city only, so a hostile display_name has no entry point.
  assert.ok(!/&|@|\bmr\b|\bmrs\b|\bjr\b/i.test(serialized));
  // The only person-referencing text is the neutral placeholder (city = the
  // c-visayas region label, never a couple name).
  assert.match(card.descriptor, /^A couple planning a wedding in /);
});

test("What's-new inquiry card: masked facts stay non-identifying (city-level place, banded cost)", () => {
  const card = buildInquiryCard({
    threadId: 'S89T-band',
    createdAt: '2026-07-15T00:00:00Z',
    eventDate: null,
    eventType: 'birthday',
    region: 'ncr',
    category: null,
  });
  // place is a city/area label, never a venue name/address.
  assert.equal(typeof card.place, 'string');
  // tokenCost resolves to a real region burn band (1..3), never fabricated.
  assert.ok(card.tokenCost >= 1 && card.tokenCost <= 3);
  assert.equal(card.kind, 'inquiry');
  assert.equal(card.threadId, 'S89T-band');
});

test("What's-new inquiry card: unknown region/type degrade to a fully generic descriptor", () => {
  const card = buildInquiryCard({
    threadId: 'S89T-nil',
    createdAt: '2026-07-15T00:00:00Z',
    eventDate: null,
    eventType: null,
    region: null,
    category: null,
  });
  assert.equal(card.descriptor, 'A couple planning an event');
  assert.equal(card.place, null);
});
