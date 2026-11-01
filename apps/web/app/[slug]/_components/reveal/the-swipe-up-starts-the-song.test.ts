/**
 * the-swipe-up-starts-the-song.test.ts — PR #7129 ("the Event Hub does not play in the app").
 *
 * WHAT WAS MEASURED (iOS 27 simulator, the app's "View Event Hub" sheet = SFSafariViewController, real injected
 * touches): a SWIPE UP's `pointerup` gets NO media credit — the song's `play()` there was refused with
 * `NotAllowedError`, 2 of 2 — while a TAP's `pointerup` is credited. The veil unveils on both (owner 2026-10-15,
 * *"Tap, swipe up to unveil"*; *"when they unveil, the music starts playing upon tap"*), so a guest who swiped
 * the veil up got a silent page. A `play()` + `pause()` on the veil's `pointerdown` unlocks the element, and the
 * swipe up's `play()` then plays (2 of 2). The app's own web view never showed the bug: it plays media with no
 * gesture at all (`mediaTypesRequiringUserActionForPlayback = []`), which is why it read as "works on my build".
 *
 * THE PROPERTY: the press that may become an unveil unlocks the song, in the press's own call stack, before
 * anything else the veil does; the unlock is silent and never starts or stops a song the guest chose.
 * `primeMedia` and the press registry are EXECUTED below; the veil itself needs WebGL, so its wiring is
 * source-level, on comment-stripped source (`lib/strip-comments.ts`). The browser half is the walk in the PR body.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { onUnveilPress, primeMedia, primeUnveilPress } from '@/lib/hub-veil';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const code = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const VEIL = code('app/[slug]/_components/reveal/veil-reveal.tsx');
const MUSIC = code('app/[slug]/_components/background-music.tsx');

/** A stand-in media element that records what was asked of it, in order. */
function media(paused: boolean, play: () => Promise<void> | undefined = () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' }))) {
  const calls: string[] = [];
  const el = {
    paused,
    play: () => {
      calls.push('play');
      return play() as Promise<void>;
    },
    pause: () => {
      calls.push('pause');
    },
  };
  return { el, calls };
}

test('🔓 primeMedia plays and pauses a paused song in one call — the unlock, silent', async () => {
  const { el, calls } = media(true);
  primeMedia(el);
  assert.deepEqual(calls, ['play', 'pause'], 'the press must play() then pause() at once — anything else is heard, or unlocks nothing');
  // The interrupted play rejects (AbortError); that must never surface as an unhandled rejection.
  await new Promise((r) => setImmediate(r));
});

test('🔓 primeMedia never touches a song that is already playing', () => {
  const { el, calls } = media(false);
  primeMedia(el);
  assert.deepEqual(calls, [], 'a press on the lifted veil would pause the song the guest is listening to');
});

test('🔓 primeMedia survives a browser whose play() throws or returns nothing', () => {
  const thrower = { paused: true, play: () => { throw new Error('nope'); }, pause: () => undefined };
  assert.doesNotThrow(() => primeMedia(thrower as never));
  const { el, calls } = media(true, () => undefined);
  assert.doesNotThrow(() => primeMedia(el));
  assert.deepEqual(calls, ['play', 'pause']);
});

test('👇 the press runs every registered primer, and one that throws stops none', () => {
  const ran: string[] = [];
  const offA = onUnveilPress(() => { ran.push('a'); throw new Error('boom'); });
  const offB = onUnveilPress(() => ran.push('b'));
  primeUnveilPress();
  assert.deepEqual(ran, ['a', 'b']);
  offA();
  offB();
  primeUnveilPress();
  assert.deepEqual(ran, ['a', 'b'], 'an unsubscribed primer still runs');
});

test('👇 the veil unlocks on its pointerdown, FIRST, synchronously', () => {
  const at = VEIL.indexOf('const onDown = (e: PointerEvent) => {');
  assert.ok(at > 0, 'the veil’s pointerdown handler (`onDown`) is gone — this guard would be vacuous');
  const body = VEIL.slice(at, VEIL.indexOf('\n    };', at));
  const prime = body.indexOf('primeUnveilPress();');
  assert.ok(prime > 0, 'the veil’s press no longer unlocks the song — a swipe up unveils in silence on iOS (PR #7129)');
  assert.ok(prime < body.indexOf('meshHit('), 'the unlock must run before the press does anything else');
  assert.equal(/setTimeout|requestAnimationFrame|await|\.then\(/.test(body.slice(0, prime)), false, 'a deferred unlock gets no credit');
  assert.match(VEIL, /grabEl\.addEventListener\('pointerdown', onDown\)/, 'onDown is no longer the veil’s pointerdown');
});

test('🎵 the song registers its unlock with the veil’s press', () => {
  assert.match(
    MUSIC,
    /onUnveilPress\(\(\) => \{\s*const el = audioRef\.current;\s*if \(el\) primeMedia\(el\);\s*\}\)/,
    'BackgroundMusic no longer unlocks its <audio> on the veil’s press — the swipe up’s play() is refused on iOS',
  );
  // …and the unveil still starts it (the half that already existed).
  assert.match(MUSIC, /return onUnveil\(startOnUnveil\);/);
});
