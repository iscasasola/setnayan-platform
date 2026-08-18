/**
 * THE ROOMS FINALLY LINK TO EACH OTHER — and only to the ones that would open.
 *
 * Measured 2026-08-17: the Event Hub was thirteen addresses and NOT ONE of them
 * linked to any other. Six could only go back to the event page; four had no
 * outbound links at all. The owner suspected it, asked for it to be verified
 * rather than assumed, and it turned out to be true and worse than he put it.
 *
 * 🔒 The rules here are INHERITED, not invented — the same two `site-nav.ts`
 * already encodes for the bottom bar and the doorway cards:
 *   · announce features, hide content — never draw a room greyed
 *   · a doorway is gated on what the DESTINATION demands, not on whether the
 *     route exists
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveRoomLinks, type RoomLinksInput } from './room-links';

/** Everything open, nothing current. */
function open(over: Partial<RoomLinksInput> = {}): RoomLinksInput {
  return {
    slug: 'mateo-turns-seven',
    current: null,
    guestToken: null,
    seatingSurfaceEnabled: true,
    seatingPublished: true,
    pabuyaRouteEnabled: true,
    enabledEgiftCount: 2,
    pabuyaViewerAllowed: true,
    recapPublished: true,
    liveHubOpen: true,
    ...over,
  };
}
const keys = (i: RoomLinksInput) => resolveRoomLinks(i).map((r) => r.key);

test('with everything open, every room is offered', () => {
  assert.deepEqual(keys(open()), ['home', 'seat', 'venue', 'gifts', 'hub', 'album']);
});

test('a room is never offered to itself — the one link guaranteed to do nothing', () => {
  assert.ok(!keys(open({ current: 'gifts' })).includes('gifts'));
  assert.ok(!keys(open({ current: 'seat' })).includes('seat'));
  // and the others survive
  assert.ok(keys(open({ current: 'gifts' })).includes('album'));
});

test('the event page is ALWAYS offered — a room must never be a dead end', () => {
  const bare = open({
    seatingSurfaceEnabled: false,
    seatingPublished: false,
    pabuyaRouteEnabled: false,
    enabledEgiftCount: 0,
    recapPublished: false,
    liveHubOpen: false,
  });
  assert.deepEqual(keys(bare), ['home']);
});

test('no slug means no links at all, rather than links to nowhere', () => {
  assert.deepEqual(resolveRoomLinks(open({ slug: null })), []);
  assert.deepEqual(resolveRoomLinks(open({ slug: '   ' })), []);
});

// ── the destination's own gates, restated ───────────────────────────────────

test('the seat rooms need seating to exist AND be published', () => {
  assert.ok(!keys(open({ seatingSurfaceEnabled: false })).includes('seat'));
  assert.ok(!keys(open({ seatingPublished: false })).includes('seat'));
  // the 3D room rides the same two conditions — it is the same floor plan
  assert.ok(!keys(open({ seatingPublished: false })).includes('venue'));
});

test('the gift page needs its flag, a destination, AND this viewer', () => {
  assert.ok(!keys(open({ pabuyaRouteEnabled: false })).includes('gifts'));
  assert.ok(!keys(open({ enabledEgiftCount: 0 })).includes('gifts'));
  // 🔑 the one that bit the doorway cards: the page applies the RAW visibility
  // column, not the effective one the event page renders under.
  assert.ok(!keys(open({ pabuyaViewerAllowed: false })).includes('gifts'));
});

test('the album appears only once the story is published', () => {
  assert.ok(!keys(open({ recapPublished: false })).includes('album'));
});

test('the live hub appears only while the event is running or just finished', () => {
  assert.ok(!keys(open({ liveHubOpen: false })).includes('hub'));
});

// ── the shape of what is returned ───────────────────────────────────────────

test('a guest token reaches the 3D room, so it shows THEIR seat', () => {
  const withToken = resolveRoomLinks(open({ guestToken: 'abc123' }));
  const venue = withToken.find((r) => r.key === 'venue');
  assert.ok(venue?.href.includes('?t=abc123'), 'the personal token was dropped');
  // and without one it still opens, just anonymised
  const anon = resolveRoomLinks(open()).find((r) => r.key === 'venue');
  assert.ok(anon && !anon.href.includes('?t='));
});

test('the slug is encoded, never interpolated raw', () => {
  const odd = resolveRoomLinks(open({ slug: 'a b&c' }));
  for (const l of odd) assert.ok(!/[ &]/.test(l.href), `raw slug in ${l.href}`);
});

test('the order is fixed — a list that reorders itself is a list nobody learns', () => {
  // Same inputs, twice, and with an unrelated fact flipped.
  assert.deepEqual(keys(open()), keys(open()));
  assert.deepEqual(
    keys(open({ recapPublished: false })),
    ['home', 'seat', 'venue', 'gifts', 'hub'],
  );
});

test('nothing is ever returned in a "locked" or greyed shape', () => {
  // Announce features, hide content: a greyed Album would announce that
  // photographs exist and are being withheld, which is the host's to disclose.
  const closed = resolveRoomLinks(open({ recapPublished: false, enabledEgiftCount: 0 }));
  for (const l of closed) {
    assert.ok(l.href && !l.href.startsWith('#'), `${l.key} points nowhere`);
    assert.ok(!('locked' in l), `${l.key} is drawn locked — that leaks its existence`);
  }
});
