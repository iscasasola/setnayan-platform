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

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

// ── WHICH ROOMS CARRY THE WAY OUT — an exact-match bill ────────────────────

test('every room that should carry a way out does, and the exceptions are named', () => {
  // Mounting is what makes the resolver matter. A room that stops mounting it
  // silently becomes a dead end again — the exact defect this closes — so the
  // set is pinned in BOTH directions: a room that loses it fails, and a room on
  // the excluded list that gains it fails until its line is moved.
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const mounted = (dir: string) => {
    const p = join(ROOT, dir);
    if (!existsSync(p)) return false;
    // 🪤 THIS MATCHED THE IMPORT ON ITS FIRST RUN AND WAS DECORATION. Deleting
    // every `<RoomFooter …/>` from a room left `import { RoomFooter }` behind,
    // which still contains the name — so the guard stayed GREEN while the room
    // was a dead end again. Caught by mutation, not by reading. **Match the JSX
    // MOUNT, never the symbol**; an import proves nothing was rendered.
    return readdirSync(p).some(
      (f) => /\.tsx$/.test(f) && /<RoomFooter\b/.test(readFileSync(join(p, f), 'utf8')),
    );
  };

  for (const room of ['find-seat', 'find-my-table', 'pabuya', 'recap', 'seat', 'venue']) {
    assert.ok(mounted(room), `${room} lost its way out — it is a dead end again`);
  }

  // ⛔ THE THREE THAT ARE DELIBERATELY WITHOUT ONE, each for its own reason:
  //
  //  · venue — NO LONGER AN EXCEPTION. It was deferred on the grounds that the
  //    3D room is a dark surface (#0b0d12) and the strip is cream, so mounting
  //    it was "a design decision I cannot make blind". The owner asked what the
  //    problem was, and he was right to: **the page had already answered it** —
  //    its own chrome uses `bg-white/10` chips and `text-white/60` links. The
  //    strip gained a `tone="dark"` that matches, and there was nothing to
  //    invent. 🔑 Deferring was reasonable; deferring WITHOUT READING the page
  //    was not — it took thirty seconds and removed the whole objection.
  //  · welcome · invite — both wear the owner-locked DOOR register: one paper
  //    card, ONE terracotta action, the wordmark as the way out. A list of other
  //    rooms would break a design settled across thirteen pages, and both are
  //    mid-task screens where a side exit is a distraction, not a service.
  for (const room of ['welcome', 'invite']) {
    assert.ok(
      !mounted(room),
      `${room} gained a room strip. If that is intended, move it to the mounted ` +
        `list above and delete its reason — but read the reason first.`,
    );
  }
});
