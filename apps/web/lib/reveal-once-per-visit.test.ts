/**
 * lib/reveal-once-per-visit.test.ts — a guest meets the reveal once on the way
 * in, and the film still starts.
 *
 * Owner Q6 = B (2026-09-11): a guest who has just come through the invite doors
 * does not meet the Event Hub's reveal again on that visit; a later visit plays
 * it as usual.
 *
 * 🪤 THE TRAP THIS FILE IS REALLY FOR. On the Event Hub the first lift of the
 * veil is ALSO what starts the Save-the-Date film. "Stepping aside" therefore
 * has two ways to be wrong and they look nothing alike on screen:
 *   · the veil comes back down (the bug Q6 names), or
 *   · the veil is gone AND the film never starts — a guest handed a still frame
 *     of somebody's wedding, which is worse than the bug being fixed.
 * Both are asserted below, and the second is asserted against the FILM's own
 * source, because that is where the recovery lives.
 *
 * 🛡 MUTATION-CHECKED: each rule was broken on purpose and this file confirmed
 * RED before being trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  REVEAL_SEEN_PREFIX,
  markRevealSeen,
  revealAlreadySeen,
  revealSeenKey,
  type RevealSeenStore,
} from '@/lib/reveal-once-per-visit';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** A tab. `sessionStorage` in one object, with the throwing case available. */
function fakeStore(opts: { throws?: boolean } = {}): RevealSeenStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem(k) {
      if (opts.throws) throw new Error('site data blocked');
      return map.get(k) ?? null;
    },
    setItem(k, v) {
      if (opts.throws) throw new Error('site data blocked');
      map.set(k, v);
    },
  };
}

test('the door records, the hub reads it back — one event, one tab', () => {
  const tab = fakeStore();
  assert.equal(revealAlreadySeen(tab, 'evt_1'), false, 'nothing has played yet');
  markRevealSeen(tab, 'evt_1');
  assert.equal(revealAlreadySeen(tab, 'evt_1'), true);
  assert.equal(tab.map.get(revealSeenKey('evt_1')), '1');
  assert.ok(revealSeenKey('evt_1').startsWith(REVEAL_SEEN_PREFIX));
});

test('🔴 KEYED PER EVENT — one couple’s reveal never silences another’s', () => {
  // A guest can hold two invitations in one tab. A flag that only remembered
  // "a reveal was seen" would take the second couple's opening away on the
  // strength of the first couple's.
  const tab = fakeStore();
  markRevealSeen(tab, 'evt_1');
  assert.equal(revealAlreadySeen(tab, 'evt_2'), false, 'the second couple’s reveal was silenced');
  assert.equal(revealAlreadySeen(tab, 'evt_1'), true);
});

test('an unmeasured store is "not seen" — a refusal never suppresses a paid opening', () => {
  const blocked = fakeStore({ throws: true });
  assert.equal(revealAlreadySeen(blocked, 'evt_1'), false, 'a throwing store must not read as "seen"');
  assert.doesNotThrow(() => markRevealSeen(blocked, 'evt_1'), 'a store that refuses to write must not break the page');
  for (const store of [null, undefined]) {
    assert.equal(revealAlreadySeen(store, 'evt_1'), false);
    assert.doesNotThrow(() => markRevealSeen(store, 'evt_1'));
  }
  assert.equal(revealAlreadySeen(fakeStore(), null), false, 'no event id is not a reason to suppress');
  assert.equal(revealAlreadySeen(fakeStore(), ''), false);
});

test('SESSION, not LOCAL — "on that visit", not "once ever"', () => {
  /*
    The owner's answer is per-visit: "later visits play it as usual". localStorage
    would make a couple's reveal play for a given guest once in their lifetime,
    which is a much bigger decision and not the one that was made. The only place
    the choice is expressed is the overlay's call site, so that is where it is
    pinned.
  */
  const overlay = read('app/[slug]/_components/reveal/reveal-overlay.tsx');
  assert.match(overlay, /window\.sessionStorage/, 'the reveal mark no longer uses sessionStorage');
  assert.doesNotMatch(overlay, /localStorage/, 'the mark was moved to localStorage — that is "once ever", not "this visit"');
});

test('the two halves are wired to the two pages, and to the right ones', () => {
  const door = read('app/[slug]/invite/page.tsx');
  const hub = read('app/[slug]/_components/site-body.tsx');
  assert.match(door, /oncePerVisit="record"/, 'the invite door no longer records that its reveal played');
  assert.match(hub, /oncePerVisit="defer"/, 'the Event Hub no longer steps aside');
  assert.doesNotMatch(door, /oncePerVisit="defer"/, 'the invite door is deferring — it is the FIRST reveal, not the second');
  assert.doesNotMatch(hub, /oncePerVisit="record"/, 'the Event Hub is recording — that would silence nothing and cost a write');

  // The key must be the event, carried from the id the server wrapper already
  // holds — never re-derived at a call site.
  const server = read('app/[slug]/_components/reveal/reveal-overlay-server.tsx');
  assert.match(server, /seenEventId=\{eventId \?\? null\}/, 'the event id is not forwarded, so the mark has nothing to key on');
});

test('a House invite records nothing — that guest’s first reveal is still the hub’s', () => {
  /*
    Owner's answer, verbatim: "A House invite plays no reveal, so that guest's
    first reveal is still the Event Hub's." That holds because the mark is
    written from `showing`, not from the mount: on House the door renders no
    overlay at all, and on a Pro theme whose reveal is out of phase the overlay
    mounts but never shows.
  */
  const door = read('app/[slug]/invite/page.tsx');
  assert.match(
    door,
    /look\.theme === 'house' \? null : \(/,
    'the House door must mount no reveal — if it mounted one, it would record a reveal nobody saw',
  );
  const overlay = read('app/[slug]/_components/reveal/reveal-overlay.tsx');
  const effect = /const showing = active && mounted && !gone;[\s\S]*?\n  \}, \[/.exec(overlay);
  assert.ok(effect, 'the `showing` effect is gone or reshaped — re-read this rule before changing it');
  assert.match(
    effect[0]!,
    /if \(showing && oncePerVisit === 'record'\) markRevealSeen\(/,
    'the mark is no longer written from `showing` — it must record what a guest SAW, ' +
      'not what happened to mount. Every reason the overlay stands down (reduced ' +
      'motion, No Reveal, the admin map, a lapsed unlock, the wrong phase) is folded ' +
      'into that one expression.',
  );
});

test('🪤 STANDING ASIDE STILL STARTS THE FILM — and through the shipped path, not a new one', () => {
  const overlay = read('app/[slug]/_components/reveal/reveal-overlay.tsx');

  // 1 · A deferred overlay is never `active`, so `showing` is false from the
  //     first render and `__stdRevealActive` is never set true.
  assert.match(
    overlay,
    /const active =\s*\n\s*enabled &&\s*\n\s*!reducedMotion &&\s*\n\s*!alreadySeen &&/,
    'the deferral is not folded into `active` — if it were bolted on at the render ' +
      'instead, `__stdRevealActive` would be set true and the film would wait for a ' +
      'lift that is never coming',
  );

  // 2 · The film starts itself when that flag is not set. This is the recovery,
  //     and it is the film's, not ours.
  const film = read('app/[slug]/_components/save-the-date-film.tsx');
  assert.match(
    film,
    /const revealActive = \(window as Window & \{ __stdRevealActive\?: boolean \}\)\.__stdRevealActive;\s*\n\s*if \(!revealActive\) start\(\);/,
    'the film’s no-reveal grace start is gone — that is the ONLY thing that starts ' +
      'the Save-the-Date film when the overlay steps aside',
  );

  // 3 · …and we must NOT fake the lift. `std-reveal-done` is the first-lift
  //     signal; dispatching it on mount would also tell the veil↔film handshake
  //     a lift happened that never did.
  const deferBlock = /oncePerVisit === 'defer'[\s\S]{0,400}/.exec(overlay);
  assert.ok(deferBlock, 'the defer branch is gone');
  assert.doesNotMatch(
    deferBlock[0]!,
    /std-reveal-done/,
    'the deferral is dispatching the first-lift event to "make sure" the film starts',
  );
});
