import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideOfferedServiceCard } from './offered-service-card-decide';
import type { Snapshot } from './service-card-snapshot';

/**
 * A service offered in a conversation arrives as the supplier's CARD.
 *
 * Owner 2026-09-09: *"the service card of each service still needs that
 * photo/image/video."* Offering a service used to record an interest row and
 * nothing else, so the couple's whole evidence of the pitch was one word in the
 * "Inquiring about" chip row.
 *
 * ── WHY THIS FILE EXECUTES INSTEAD OF GREPPING ─────────────────────────────
 * The resolver around this decision is `server-only` and cannot be imported by
 * `tsx --test`. The two failures that a person would actually feel were split
 * into `offered-service-card-decide.ts` so they could be RUN:
 *   1. a card resolving for a service that is not this conversation's supplier;
 *   2. a real service being announced as "Untitled service".
 * Both are asserted below against the values production actually holds.
 */

const SNAP: Snapshot = {
  name: 'Untitled service',
  priceText: 'from ₱35,000',
  discountBadge: null,
  includesLine: null,
  notIncluded: [],
  hasExclusive: false,
  hasCover: true,
};

function input(over: Partial<Parameters<typeof decideOfferedServiceCard>[0]> = {}) {
  return {
    threadVendorProfileId: 'vendor-A',
    serviceVendorProfileId: 'vendor-A',
    title: null as string | null,
    category: 'live_band' as string | null,
    snapshot: SNAP,
    coverUrl: 'https://r2.example/signed-cover?sig=1',
    clipUrl: null as string | null,
    serviceId: 'svc-1',
    ...over,
  };
}

test('a service belonging to another supplier is refused, not drawn', () => {
  // `authenticated` holds INSERT on chat_messages.offered_service_id, so a
  // COUPLE can post a message naming ANY service id. RLS is row-level and
  // cannot refuse a VALUE. If this ever returns a card, every thread is a
  // viewer for arbitrary suppliers' media and pricing.
  const out = decideOfferedServiceCard(
    input({ serviceVendorProfileId: 'vendor-B' }),
  );
  assert.equal(out.status, 'not_found');
  assert.ok(!('card' in out), 'a refusal must carry no card payload at all');
});

test('the same supplier resolves to a card', () => {
  const out = decideOfferedServiceCard(input());
  assert.equal(out.status, 'ok');
});

test('a service with no title is named by its category, never "Untitled service"', () => {
  // MEASURED ON PRODUCTION 2026-09-09: `title` is NULL on BOTH live services.
  // `readSnapshot` falls back to "Untitled service" — taking the snapshot's
  // name would print that on every card that ships today, where the chip row
  // this card replaces printed "Live band". That is a REGRESSION, not a
  // cosmetic difference, and this is the assertion that stops it.
  const out = decideOfferedServiceCard(input({ title: null, category: 'live_band' }));
  assert.equal(out.status, 'ok');
  if (out.status !== 'ok') return;
  assert.equal(out.card.name, 'Live Band');
  assert.notEqual(out.card.name, SNAP.name);
  assert.ok(
    !/untitled/i.test(out.card.name),
    'a real, published service must never be announced as untitled',
  );
});

test('a title the supplier set wins over the category', () => {
  const out = decideOfferedServiceCard(
    input({ title: '  Full Band · 5 hours  ', category: 'live_band' }),
  );
  assert.equal(out.status, 'ok');
  if (out.status !== 'ok') return;
  assert.equal(out.card.name, 'Full Band · 5 hours');
  assert.equal(out.card.categoryLabel, 'Live Band', 'the category becomes the subtitle');
});

test('the category is not printed twice when it IS the name', () => {
  const out = decideOfferedServiceCard(input({ title: null, category: 'live_band' }));
  assert.equal(out.status, 'ok');
  if (out.status !== 'ok') return;
  assert.equal(out.card.name, 'Live Band');
  assert.equal(out.card.categoryLabel, null);
});

test('a service with neither title nor category still names something', () => {
  const out = decideOfferedServiceCard(input({ title: null, category: null }));
  assert.equal(out.status, 'ok');
  if (out.status !== 'ok') return;
  assert.equal(out.card.name, 'Service');
  assert.ok(!/untitled/i.test(out.card.name));
});

test('the media the supplier built is what travels — both refs, resolved', () => {
  // The whole point of the change. A card carrying no cover is the chip row
  // with extra steps.
  const out = decideOfferedServiceCard(
    input({
      coverUrl: 'https://r2.example/signed-cover?sig=abc',
      clipUrl: 'https://r2.example/signed-clip?sig=def',
    }),
  );
  assert.equal(out.status, 'ok');
  if (out.status !== 'ok') return;
  assert.equal(out.card.coverUrl, 'https://r2.example/signed-cover?sig=abc');
  assert.equal(out.card.clipUrl, 'https://r2.example/signed-clip?sig=def');
});

test('a supplier with no cover still gets a card — a cover is NOT required to publish', () => {
  // `PUBLISH_REQUIREMENTS` is ['price','exclusive'] — the cover is not on it,
  // and measured on production one of the two live services HAS no cover. A
  // card that needs a photograph to exist would be blank for half of them.
  const out = decideOfferedServiceCard(input({ coverUrl: null, clipUrl: null }));
  assert.equal(out.status, 'ok');
  if (out.status !== 'ok') return;
  assert.equal(out.card.coverUrl, null);
  assert.equal(out.card.priceText, 'from ₱35,000', 'the price still reaches the couple');
});

test('the money is the snapshot"s, never recomputed here', () => {
  const snapshot: Snapshot = {
    ...SNAP,
    priceText: 'from ₱165,000 · ₱1,100/guest',
    discountBadge: 'Early booking −10%',
    includesLine: 'Includes lechon · ₱8,000 free',
    notIncluded: ['Crew meals', 'Transport'],
    hasExclusive: true,
  };
  const out = decideOfferedServiceCard(input({ snapshot }));
  assert.equal(out.status, 'ok');
  if (out.status !== 'ok') return;
  assert.equal(out.card.priceText, snapshot.priceText);
  assert.equal(out.card.discountBadge, snapshot.discountBadge);
  assert.equal(out.card.includesLine, snapshot.includesLine);
  assert.deepEqual(out.card.notIncluded, snapshot.notIncluded);
  assert.equal(out.card.hasExclusive, true);
});
