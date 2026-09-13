/**
 * Vendor Overview "What's new" — inquiry card DTO. Node built-in runner via tsx
 * (`pnpm test:unit`).
 *
 * ── THIS FILE USED TO ASSERT THE OPPOSITE ──────────────────────────────────
 * It was written for `Vendor_Inquiry_Anonymization_Spec_2026-07-15` (Glass
 * PR-6b), and its load-bearing guarantee was that a PENDING inquiry's payload
 * "carries NO couple identity … only the neutral anonymized descriptor". Owner
 * ruling 2026-09-08: *"we do not need to hide anything, since no more tokens."*
 * The mask was the token wallet's storefront and the wallet was retired on
 * 2026-05-11 — see `the-inquiry-card-honours-the-ruling.test.ts` for the full
 * history, which is deliberately kept rather than deleted.
 *
 * 🔑 WHAT DID NOT CHANGE, AND IS WHY THIS FILE STILL EXISTS. Naming the customer
 * is not licence to ship everything about them. `place` stays a CITY/AREA label
 * and never a venue name or address — a venue is where somebody will physically
 * be on a known date, which is a different disclosure from a name, and nothing
 * in the ruling asked for it. Identity is a DATA-layer property either way, so
 * this asserts the DTO the builder produces, not the rendered UI.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildInquiryCard } from './vendor-overview-inquiry-card';

test("What's-new inquiry card: the customer is named", () => {
  const card = buildInquiryCard({
    threadId: 'S89T-abc',
    createdAt: '2026-07-15T00:00:00Z',
    eventDate: '2026-12-20',
    eventType: 'wedding',
    region: 'ncr',
    category: 'Photography',
    displayName: 'Cale & Ice',
  });
  assert.equal(card.descriptor, 'Cale & Ice');
  // The DTO still has ONE name slot. `eventName` was the field that used to
  // leak the event title alongside the descriptor; it stays structurally gone
  // so there is exactly one thing to read and one thing to get right.
  assert.equal('eventName' in card, false);
});

test("What's-new inquiry card: place stays city-level, never a venue", () => {
  const card = buildInquiryCard({
    threadId: 'S89T-band',
    createdAt: '2026-07-15T00:00:00Z',
    eventDate: null,
    eventType: 'birthday',
    region: 'ncr',
    category: null,
    displayName: 'Ronnie’s 40th',
  });
  // A resolved region label — the builder is given `region`, a slug, and has no
  // venue parameter at all. That absence is the enforcement; this pins it.
  assert.equal(typeof card.place, 'string');
  assert.ok(
    !/street|st\.|barangay|brgy|road|ave|building|floor|#\d/i.test(card.place ?? ''),
    `place looks like an address, not a city: ${card.place}`,
  );
  // `tokenCost` was dropped 2026-08-07 with the token retirement. It had been
  // computed on every inquiry card and RENDERED NOWHERE since #4216 removed the
  // Accept badge — so the old assertion was pinning a number no vendor could
  // see. It matters more now: the wallet's last trace is what this whole change
  // is unwinding.
  assert.ok(!('tokenCost' in card), 'inquiry cards must not carry a token cost');
  assert.equal(card.kind, 'inquiry');
  assert.equal(card.threadId, 'S89T-band');
});

test("What's-new inquiry card: unknown region degrades to null, not to a guess", () => {
  const card = buildInquiryCard({
    threadId: 'S89T-nil',
    createdAt: '2026-07-15T00:00:00Z',
    eventDate: null,
    eventType: null,
    region: null,
    category: null,
    displayName: null,
  });
  assert.equal(card.place, null);
  // ⚠ The descriptor's old degrade was "A couple planning an event" — a wedding
  // asserted at the exact moment nothing about the event is known. Seventeen
  // event types exist. The replacement claims nothing at all.
  assert.equal(card.descriptor, 'New customer');
});
