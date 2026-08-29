/**
 * THE BAND THE OWNER TICKS IS THE BAND THAT CHARGES.
 *
 * 🔴 THE DEFECT THESE PIN, measured against production 2026-08-29.
 * `/admin/pricing?tab=setnayan-ai` writes `event_type_vocab.ai_price_tier`. That
 * column had THREE readers: the screen that draws it, the action that writes it,
 * and a database function called by nothing but tests. Every charge resolved the
 * band from a hardcoded TypeScript map, so moving a kind of celebration into a
 * different band moved the admin screen and not one peso.
 *
 * Nobody was mispriced — the column and the map happened to agree on all 17
 * kinds, having never been used. It would have fired on first use.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAiBandForEventType } from './setnayan-ai-band-source';
import { AI_TIER_BY_EVENT_TYPE, AI_TIER_DEFAULT } from './setnayan-ai-type-pricing';

/** The narrowest stand-in for the one call the resolver makes. */
function client(result: { data: unknown; error: { message: string } | null }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => result,
        }),
      }),
    }),
  } as never;
}

test("the owner's stored band wins over the hardcoded map", async () => {
  // `wedding` is 'A' in the map. If the owner moves it to 'D', the charge must
  // follow HIM. Before this shipped, it followed the map and ignored him.
  assert.equal(AI_TIER_BY_EVENT_TYPE.wedding, 'A', 'fixture assumption');

  const r = await resolveAiBandForEventType(
    client({ data: { ai_price_tier: 'D' }, error: null }),
    'wedding',
  );

  assert.equal(r.status, 'resolved');
  if (r.status !== 'resolved') return;
  assert.equal(r.band, 'D', "the screen's answer must beat the map");
  assert.equal(r.source, 'owner');
});

test('a kind with no band chosen falls back to the locked map', async () => {
  const r = await resolveAiBandForEventType(
    client({ data: { ai_price_tier: null }, error: null }),
    'wedding',
  );

  assert.equal(r.status, 'resolved');
  if (r.status !== 'resolved') return;
  assert.equal(r.band, 'A', 'an unbanded kind still prices off the locked ladder');
  assert.equal(r.source, 'fallback');
});

test('a kind nobody has ever heard of lands on the middle band, not on nothing', async () => {
  const r = await resolveAiBandForEventType(
    client({ data: null, error: null }),
    'a_kind_nobody_has_added_yet',
  );

  assert.equal(r.status, 'resolved');
  if (r.status !== 'resolved') return;
  assert.equal(r.band, AI_TIER_DEFAULT);
});

test('A FAILED READ REFUSES — it must never be mistaken for "no band chosen"', async () => {
  /*
    🔑 THE ONE THAT MATTERS MOST. Supabase RESOLVES with `{ error }`. Discarding
    it turns "the database would not answer" into "this kind has no band", which
    quietly resolves to the middle band and charges a price nobody chose. That is
    the exact collapse SEC-7 removed from the price read one layer down; this
    stops it being reintroduced one layer up.
  */
  const r = await resolveAiBandForEventType(
    client({ data: null, error: { message: 'connection reset' } }),
    'wedding',
  );

  assert.equal(r.status, 'read_error', 'a refused read must not resolve to a band');
  if (r.status !== 'read_error') return;
  assert.match(r.message, /event_type_vocab/, 'the message must name what could not be read');
});

test('a nonsense value in the column cannot invent a band', async () => {
  // A typo, or a band that was removed. Casting it through would reach
  // AI_TIER_SKU[<garbage>] and resolve undefined — a price of nothing.
  const r = await resolveAiBandForEventType(
    client({ data: { ai_price_tier: 'Z' }, error: null }),
    'wedding',
  );

  assert.equal(r.status, 'resolved');
  if (r.status !== 'resolved') return;
  assert.equal(r.band, 'A', 'it degrades to the locked ladder');
  assert.equal(r.source, 'fallback', 'and it is honest about not being the owner\'s choice');
});

test('no event type at all is a product fact, not a failed read', async () => {
  const r = await resolveAiBandForEventType(client({ data: null, error: null }), null);
  assert.equal(r.status, 'resolved');
  if (r.status !== 'resolved') return;
  assert.equal(r.band, AI_TIER_DEFAULT);
});
