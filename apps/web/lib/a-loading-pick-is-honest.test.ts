/**
 * a-loading-pick-is-honest.test.ts — STUDIO › LOOK: A PICK WHOSE FILE MUST LOAD
 * SAYS HOW MUCH IS IN, HOLDS ONLY ITS OWN STRIP, AND CAN BE STOPPED.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9, "Style card while a file
 * loads"): *"when pressed. show a loading screen 0-100 pie to know how long til
 * it uploads"* · *"when we are picking and the option is not yet done loading,
 * nothing can be pressed"* — and his *"yes"* to both of the controller's
 * limits: a pie ONLY where progress is really measured (a plain save shows its
 * words, never an invented percentage), and only that strip locks — never the
 * screen, the top bar or Exit.
 *
 * Held, each where it can be EXECUTED:
 *   (1) the figure is bytes over the server's own total — whole, never 100
 *       early, and NULL where there is no total to trust;
 *   (2) a picture's figure is read off the SAME response (a real streamed
 *       `Response` is driven chunk by chunk; `fetch` is never called);
 *   (3) a film's figure is `buffered` over `duration`, told by the element that
 *       plays it; a pick waits for "ready", a stop ends the wait, and an old
 *       "ready" never lets a new pick through;
 *   (4) the rule: the loading card wears the measured pie, the other cards of
 *       THAT strip are locked, a tap on the loading card cancels — and a save
 *       in flight, a failure, or another strip locks nothing;
 *   (5) rendered: the veil and pie, the locked cards, nothing under a blink,
 *       no percentage without a measure, and the line's words;
 *   (6) the wiring: loaded first, applied second (a cancel has written
 *       nothing), one request per picture, the 8-second stop asks instead of
 *       stopping, an upload shows `FileUpload`'s own figure.
 *
 * Lives in `lib/` because node's test glob does not descend into `[eventId]`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import {
  BACKGROUND_PICK_CANCELLED,
  BACKGROUND_PICK_CANCEL_HINT,
  BACKGROUND_PICK_CANVAS_WAIT_MS,
  BACKGROUND_PICK_STALLED,
  backgroundCardLoad,
  backgroundCardLooks,
  backgroundCardTap,
  backgroundPickHolds,
  backgroundPickStep,
  createLookGroundStore,
  type BackgroundPick,
  type LookGround,
} from './background-pick';
import { createFilmLoads, filmLoadPct, loadPct, readBlobWithProgress, responseTotal } from './pick-load';
import { centredScrollLeft } from './centre-in-row';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const E = 'app/dashboard/[eventId]/website/editor/_components';

const pick = (over: Partial<BackgroundPick> = {}): BackgroundPick => ({ seq: 7, card: null, reading: false, laid: false, shown: false, saved: false, failed: null, ...over });
/** A picture whose bytes are arriving: tapped on `scene:x`, in the Scene strip. */
const loading = (over: Partial<BackgroundPick> = {}) => pick({ card: 'scene:x', strip: 'scene', reading: true, file: true, pct: 45, ...over });

/* ── (1) the figure ───────────────────────────────────────────────────── */

test('(1) the figure is bytes over the total the server sent — whole, never 100 early, and null where there is no total', () => {
  assert.equal(loadPct(0, 1000), 0);
  assert.equal(loadPct(455, 1000), 45, 'the figure is rounded up — it would say more than has arrived');
  assert.equal(loadPct(999, 1000), 99, '100 is said before the last byte is in');
  assert.equal(loadPct(1000, 1000), 100);
  assert.equal(loadPct(1500, 1000), 100, 'more bytes than promised runs past 100');
  // No total → NO figure. Never a guess.
  for (const total of [null, undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(loadPct(500, total as number | null), null, `total ${String(total)}: a percentage was invented`);
  const headers = (h: Record<string, string>) => new Headers(h);
  assert.equal(responseTotal(headers({ 'content-length': '2048' })), 2048);
  assert.equal(responseTotal(headers({})), null, 'a response with no length is given a total');
  assert.equal(responseTotal(headers({ 'content-length': '0' })), null);
  assert.equal(responseTotal(headers({ 'content-length': 'abc' })), null);
  // A compressed body: its length counts the wire, the stream yields the unpacked bytes — not the same sum.
  assert.equal(responseTotal(headers({ 'content-length': '2048', 'content-encoding': 'gzip' })), null, 'a compressed length is measured against unpacked bytes');
  assert.equal(responseTotal(headers({ 'content-length': '2048', 'content-encoding': 'identity' })), 2048);
});

/* ── (2) a picture: the same response, read as it arrives ─────────────── */

function streamed(chunks: number[], init: { length?: boolean; encoding?: string } = {}) {
  const bytes = chunks.map((n, i) => new Uint8Array(n).fill(i + 1));
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      if (i < bytes.length) c.enqueue(bytes[i++]!);
      else c.close();
    },
  });
  const total = chunks.reduce((a, b) => a + b, 0);
  const headers: Record<string, string> = { 'content-type': 'image/webp' };
  if (init.length !== false) headers['content-length'] = String(total);
  if (init.encoding) headers['content-encoding'] = init.encoding;
  return { res: new Response(body, { headers }), total };
}

test('(2) a picture’s figure is read off the response the pick already holds — every figure is bytes so far over the total, and nothing is fetched again', async () => {
  const realFetch = globalThis.fetch;
  let fetched = 0;
  globalThis.fetch = (() => {
    fetched += 1;
    throw new Error('a second request');
  }) as typeof fetch;
  try {
    const chunks = [100, 300, 250, 349, 1];
    const { res, total } = streamed(chunks);
    const said: Array<number | null> = [];
    const blob = await readBlobWithProgress(res, (p) => said.push(p));
    // EXACTLY the bytes that had arrived at each step — not a clock, not a curve.
    let sum = 0;
    const real = [0, ...chunks.map((n) => Math.min(sum + n >= total ? 100 : 99, Math.floor(((sum += n) / total) * 100)))];
    assert.deepEqual(said, real, 'a figure is not the bytes that had arrived');
    assert.deepEqual(said, [0, 10, 40, 65, 99, 100]);
    assert.equal(said.at(-1), 100);
    assert.ok(said.every((p, k) => k === 0 || (p as number) >= (said[k - 1] as number)), 'the figure goes backwards');
    // The picture itself is whole and typed — the colour read gets the same bytes it always did.
    assert.equal(blob.size, total);
    assert.equal(blob.type, 'image/webp');
    assert.deepEqual([...new Uint8Array(await blob.arrayBuffer()).slice(98, 102)], [1, 1, 2, 2]);

    // NO LENGTH: the body is read whole and the only thing said is "no measure".
    const bare = streamed([400, 600], { length: false });
    const saidBare: Array<number | null> = [];
    const whole = await readBlobWithProgress(bare.res, (p) => saidBare.push(p));
    assert.deepEqual(saidBare, [null], 'a file with no total is given a percentage');
    assert.equal(whole.size, 1000);
    // COMPRESSED: no figure either.
    const packed = streamed([400, 600], { encoding: 'br' });
    const saidPacked: Array<number | null> = [];
    await readBlobWithProgress(packed.res, (p) => saidPacked.push(p));
    assert.deepEqual(saidPacked, [null]);
    assert.equal(fetched, 0, 'the progress is learned with a request of its own');
  } finally {
    globalThis.fetch = realFetch;
  }
});

/* ── (3) a film: the element that plays it ────────────────────────────── */

test('(3) a film’s figure is buffered over duration; a pick waits for "ready", a stop ends the wait, an old "ready" lets nothing through', async () => {
  const ranges = (...r: Array<[number, number]>) => ({ length: r.length, end: (i: number) => r[i]![1] });
  assert.equal(filmLoadPct(ranges([0, 2.5]), 10), 25);
  assert.equal(filmLoadPct(ranges([0, 1], [4, 7.99]), 8), 99, 'the furthest second buffered is not the one read');
  assert.equal(filmLoadPct(ranges([0, 8]), 8), 100);
  assert.equal(filmLoadPct(ranges(), 8), 0);
  // The length is not known yet (metadata still on its way): NO figure.
  for (const d of [Number.NaN, 0, Number.POSITIVE_INFINITY]) assert.equal(filmLoadPct(ranges([0, 3]), d), null, `duration ${d}: a percentage was invented`);
  assert.equal(filmLoadPct(null, 8), 0);

  const SRC = 'https://pub.example.test/themes/a/loop.mp4';
  // Told as it arrives; resolved TRUE at "ready".
  let films = createFilmLoads();
  let heard: Array<number | null> = [];
  let stop = new AbortController();
  let done = films.wait(SRC, (p) => heard.push(p), stop.signal);
  assert.equal(films.waiting(SRC), 1);
  films.tell(SRC, { pct: null, ready: false });
  films.tell(SRC, { pct: 20, ready: false });
  films.tell('https://pub.example.test/other.mp4', { pct: 100, ready: true });
  films.tell(SRC, { pct: 60, ready: true });
  assert.equal(await done, true);
  assert.deepEqual(heard, [null, 20, 60], 'another film’s news moved this pick');
  assert.equal(films.waiting(SRC), 0, 'the pick still listens after it was answered');

  // STOPPED: the wait ends FALSE, at once, and hears nothing more.
  films = createFilmLoads();
  heard = [];
  stop = new AbortController();
  done = films.wait(SRC, (p) => heard.push(p), stop.signal);
  films.tell(SRC, { pct: 10, ready: false });
  stop.abort('cancel');
  assert.equal(await done, false, 'a cancelled film is treated as arrived — its save would be sent');
  films.tell(SRC, { pct: 100, ready: true });
  assert.deepEqual(heard, [10]);
  assert.equal(films.waiting(SRC), 0);
  // Already stopped before the wait began.
  stop = new AbortController();
  stop.abort('newer');
  assert.equal(await films.wait(SRC, () => {}, stop.signal), false);

  // A film worn before is "ready" in the book; a NEW pick begins it afresh and waits for this load, not that one.
  films = createFilmLoads();
  films.tell(SRC, { pct: 100, ready: true });
  assert.equal(await films.wait(SRC, () => {}, new AbortController().signal), true, 'anti-vacuity: a known "ready" is not heard');
  films.begin(SRC);
  let settled = false;
  const again = films.wait(SRC, () => {}, new AbortController().signal).then((v) => ((settled = true), v));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(settled, false, 'an old "ready" let a new pick through before its film had loaded');
  films.tell(SRC, { pct: null, ready: true });
  assert.equal(await again, true, 'a film that will not move here (reduced motion, a refused play) is never waited on for ever');
});

/* ── (4) the rule ─────────────────────────────────────────────────────── */

test('(4) the loading card wears the measured pie, the other cards of THAT strip are locked, a tap on it cancels — and a save in flight locks nothing', () => {
  const p = loading();
  assert.equal(backgroundPickHolds(p), true);
  assert.equal(backgroundPickStep(p), 'loading');
  // The card on its way: the pie is the measure; a tap cancels.
  assert.deepEqual(backgroundCardLoad('scene:x', false, p, 'scene'), { loading: true, pie: 45, locked: false });
  assert.equal(backgroundCardTap(backgroundCardLooks('scene:x', false, p), backgroundCardLoad('scene:x', false, p, 'scene')), 'cancel');
  // Every other card of that strip: locked — a tap does nothing.
  for (const other of ['scene:y', 'scene:z']) {
    assert.deepEqual(backgroundCardLoad(other, other === 'scene:y', p, 'scene'), { loading: false, pie: null, locked: true }, `${other} can be pressed while another card loads`);
    assert.equal(backgroundCardTap(backgroundCardLooks(other, false, p), backgroundCardLoad(other, false, p, 'scene')), null);
  }
  // ONLY THAT STRIP: the cards of another source are as they were.
  assert.deepEqual(backgroundCardLoad('loop:a', true, p, 'video'), { loading: false, pie: null, locked: false }, 'a strip the pick was not tapped in is locked');
  assert.equal(backgroundCardTap({ on: false }, backgroundCardLoad('loop:b', false, p, 'video')), 'pick');
  // NOTHING MEASURED → NO PIE (the card still holds the strip, and can still be cancelled).
  for (const none of [loading({ pct: null }), loading({ pct: undefined }), loading({ pct: Number.NaN }), loading({ file: false, pct: 45 })]) {
    assert.deepEqual(backgroundCardLoad('scene:x', false, none, 'scene'), { loading: true, pie: null, locked: false }, 'a pie is drawn with nothing measured');
  }
  assert.deepEqual(backgroundCardLoad('scene:x', false, loading({ pct: 250 }), 'scene').pie, 100);
  assert.deepEqual(backgroundCardLoad('scene:x', false, loading({ pct: 45.9 }), 'scene').pie, 45);
  // A film drawn in the panel at the tap (`card: null`): the loading card is the ringed one.
  const film = pick({ strip: 'video', reading: true, file: true, pct: 30 });
  assert.deepEqual(backgroundCardLoad('loop:new', true, film, 'video'), { loading: true, pie: 30, locked: false });
  assert.deepEqual(backgroundCardLoad('loop:old', false, film, 'video'), { loading: false, pie: null, locked: true });
  // The pie replaces the small mark — never both on one card.
  assert.deepEqual(backgroundCardLooks('scene:x', false, p), { on: true, busy: false }, 'the pie and the small mark are both drawn');
  assert.deepEqual(backgroundCardLooks('scene:x', false, loading({ file: false })), { on: true, busy: true }, 'a load with no measure shows nothing at all on its card');

  // A PLAIN SAVE (no file): nothing holds, nothing is locked, no pie — whatever `pct` says.
  for (const saving of [pick({ shown: true }), pick({ shown: true, pct: 80, file: true }), pick({ laid: true }), pick({ laid: true, shown: false, saved: true })]) {
    assert.equal(backgroundPickHolds(saving), false);
    assert.deepEqual(backgroundCardLoad('loop:a', true, saving, 'video'), { loading: false, pie: null, locked: false }, 'a save in flight locks the strip — a later pick could not win');
    assert.deepEqual(backgroundCardLoad('loop:b', false, saving, 'video'), { loading: false, pie: null, locked: false });
  }
  // A failure, or nothing on its way: nothing held.
  assert.equal(backgroundPickHolds(loading({ failed: 'No.' })), false, 'a failed load keeps the strip locked');
  assert.deepEqual(backgroundCardLoad('scene:y', false, loading({ failed: 'No.' }), 'scene'), { loading: false, pie: null, locked: false });
  assert.equal(backgroundPickHolds(null), false);
  // The card already on, at rest: a tap does nothing; any other picks.
  assert.equal(backgroundCardTap({ on: true }, { loading: false, locked: false }), null);
  assert.equal(backgroundCardTap({ on: false }, { loading: false, locked: false }), 'pick');

  // CANCELLED = NOTHING CHANGED: the panel's own copy goes back to what the draft holds (the ring with it).
  const A: LookGround = { main: { ground: 'none' }, bg: '#5b1a22', art: null };
  const B: LookGround = { main: { ground: 'theme' }, bg: '#5b1a22', art: null };
  const s = createLookGroundStore();
  s.draw('look:E1', B, A);
  s.sent();
  assert.deepEqual(s.read('look:E1', A), B, 'anti-vacuity: the pick was never drawn');
  s.answered('look:E1', { ok: false, latest: true, value: B }, A);
  assert.deepEqual(s.read('look:E1', A), A, 'a cancelled pick is still ringed');
  assert.equal(s.flying(), 0);
  assert.equal(BACKGROUND_PICK_CANCELLED, 'Cancelled — nothing changed', 'the owner’s gallery words');
});

/* ── (5) rendered ─────────────────────────────────────────────────────── */

test('(5) rendered: a veil and the pie on the loading card, the others dimmed and not pressable, nothing under a blink, no figure without a measure', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const C = await import(`../${E}/background-cards`);
  const strip = (p: BackgroundPick | null, props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      React.createElement(
        C.BgCards,
        { label: 'Scene', source: 'scene', pick: p, onCancel: () => {}, quietMs: 0, ...props },
        React.createElement(C.BgCard, { key: 'o', name: 'Old', data: 'scene:old', on: true, onPick: () => {}, swatch: '#000' }),
        React.createElement(C.BgCard, { key: 'x', name: 'New', data: 'scene:x', on: false, onPick: () => {}, swatch: '#fff' }),
        React.createElement(C.BgCard, { key: 'y', name: 'Third', data: 'scene:y', on: false, onPick: () => {}, swatch: '#888' }),
      ),
    );
  const cardOf = (html: string, data: string) => new RegExp(`<button[^>]*data-bg-card="${data}"[^>]*>[\\s\\S]*?</button>`).exec(html)?.[0] ?? '';
  const open = (card: string) => /^<button[^>]*>/.exec(card)?.[0] ?? '';

  const html = strip(loading());
  const mine = cardOf(html, 'scene:x');
  // THE LOADING CARD: ringed, a veil, the pie at the measured 45 — and still pressable (a tap cancels).
  assert.match(open(mine), /aria-pressed="true"/);
  assert.match(open(mine), /aria-busy="true"/);
  assert.match(open(mine), /data-bg-card-loading=""/);
  assert.doesNotMatch(open(mine), /\sdisabled=""/, 'the loading card cannot be tapped — it could not be cancelled');
  assert.match(mine, /<span data-bg-card-load="loading" aria-hidden="true" class="[^"]*absolute inset-0[^"]*bg-ink\/40[^"]*">/, 'no dim veil over the loading card');
  assert.match(mine, /data-bg-card-pie="45"[^>]*style="background:conic-gradient\(rgb\(255 255 255\) 45%, rgb\(255 255 255 \/ 0\.28\) 0\)"/, 'the pie is not filled to the measured figure');
  assert.match(mine, />45%<\/span>/);
  assert.doesNotMatch(mine, /data-bg-card-busy/, 'the small mark is drawn beside the pie');
  // The accent and the ink on it are the selector template's own — one setting, never written on the card.
  const { PILL_ON_CLASS } = await import('../app/_components/pill-selector');
  assert.ok(mine.includes(`tabular-nums ${PILL_ON_CLASS}">45%</span>`), 'the pie’s centre wears a colour of its own, not the template’s');
  // THE OTHERS: dimmed and NOT pressable — the stored one too.
  for (const other of ['scene:old', 'scene:y']) {
    const o = open(cardOf(html, other));
    assert.match(o, /\sdisabled=""/, `${other} can be pressed while a card loads`);
    assert.match(o, /data-bg-card-locked=""/);
    assert.match(o, /data-\[bg-card-locked\]:opacity-40/, `${other} is not dimmed`);
    assert.doesNotMatch(cardOf(html, other), /data-bg-card-load=|data-bg-card-pie/, 'a waiting card wears a pie');
  }
  assert.match(html, /^<div[^>]*data-bg-cards="scene"[^>]*data-bg-cards-loading=""/);
  // Only the strip: no layer over the panel, nothing fixed.
  assert.doesNotMatch(html, /\bfixed\b|backdrop|\binert\b/, 'more than the strip is locked');

  // NOTHING UNDER A BLINK: at the tap (the default quiet time not yet outlasted) there is no veil, no pie, no figure —
  // the ring and the lock are there from the tap.
  const atTap = strip(loading(), { quietMs: undefined });
  assert.doesNotMatch(atTap, /data-bg-card-load=|data-bg-card-pie|%<\/span>/, 'a pie flashes for a file that arrives at once');
  assert.match(open(cardOf(atTap, 'scene:x')), /aria-pressed="true"/);
  assert.match(open(cardOf(atTap, 'scene:y')), /\sdisabled=""/, 'the strip is not held from the tap');

  // NOTHING MEASURED: no pie, no percentage anywhere — the small mark says it is working.
  const blind = strip(loading({ file: false, pct: null }));
  assert.doesNotMatch(blind, /data-bg-card-pie|conic-gradient|\d%/, 'a percentage is shown with nothing measured');
  assert.match(cardOf(blind, 'scene:x'), /data-bg-card-busy=""/);
  assert.match(open(cardOf(blind, 'scene:y')), /\sdisabled=""/);

  // A PLAIN SAVE: its card has the small mark, never a pie or a figure; no card is locked.
  const saving = strip(pick({ card: 'scene:x', strip: 'scene', shown: true, pct: 80 }));
  assert.doesNotMatch(saving, /data-bg-card-pie|conic-gradient|\d%|data-bg-card-locked|\sdisabled=""|data-bg-cards-loading/, 'a plain save shows a percentage or locks the strip');
  assert.match(cardOf(saving, 'scene:x'), /data-bg-card-busy=""/);
  // ANOTHER STRIP on screen while that file loads: untouched.
  const elsewhere = strip(loading({ strip: 'own' }));
  assert.doesNotMatch(elsewhere, /data-bg-card-locked|\sdisabled=""|data-bg-card-pie|data-bg-cards-loading/, 'a strip the pick was not tapped in is held');
  // At rest: nothing.
  assert.doesNotMatch(strip(null), /data-bg-card-locked|\sdisabled=""|data-bg-card-pie|aria-busy/);

  // THE LINE. Loading with a measure: the owner's words, the figure (not read out again and again), how to stop it.
  const line = (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(C.BgPickLine, { error: null, onRetry: null, quietMs: 0, ...props }));
  const said = line({ step: 'loading', pct: 45, cancellable: true });
  assert.match(said, /role="status"/);
  assert.match(said, /Loading files…/);
  assert.match(said, /<span aria-hidden="true" data-bg-pick-pct="" class="tabular-nums">45%<\/span>/);
  assert.ok(said.includes(BACKGROUND_PICK_CANCEL_HINT) && BACKGROUND_PICK_CANCEL_HINT === 'tap the card to cancel');
  // No measure: the words only. A save: the words only — even if a figure were handed in.
  assert.doesNotMatch(line({ step: 'loading', pct: null, cancellable: true }), /\d%/);
  const applying = line({ step: 'applying', pct: 80, cancellable: true });
  assert.match(applying, /Applying to your Hub…/);
  assert.doesNotMatch(applying, /\d%|cancel/i, 'a plain save shows a percentage');
  // THE 8-SECOND STOP: a question with both answers — not a failure, and not the waiting words.
  let retried = 0;
  const stalled = line({ step: 'loading', pct: 45, cancellable: true, stalled: true, onRetry: () => (retried += 1), onCancel: () => {} });
  assert.match(stalled, /data-bg-pick-line="stalled"/);
  assert.ok(stalled.includes(BACKGROUND_PICK_STALLED));
  assert.match(stalled, /<button[^>]*data-bg-pick-retry=""[^>]*>Try again<\/button>/);
  assert.match(stalled, /<button[^>]*data-bg-pick-cancel=""[^>]*>Cancel<\/button>/);
  assert.doesNotMatch(stalled, /role="alert"|Loading files|animate-spin/, 'a slow file looks like a failure, or like it is fine');
  assert.equal(retried, 0);
  // A stalled flag on a pick that is no longer loading says nothing of the kind.
  assert.doesNotMatch(line({ step: 'applying', stalled: true, onCancel: () => {} }), /Try again|Cancel|longer/);
  assert.equal(BACKGROUND_PICK_CANVAS_WAIT_MS, 8000, 'the 8-second stop');
});

/* ── (6) the wiring ───────────────────────────────────────────────────── */

test('(6) loaded first, applied second — a cancel has written nothing; one request per picture; the stop asks, it does not stop; an upload shows its own figure', () => {
  const panel = read(`${E}/main-background-panel.tsx`);
  const cards = read(`${E}/background-cards.tsx`);
  const fn = (name: string, until: string) => {
    const at = panel.indexOf(`const ${name} = (`);
    const end = panel.indexOf(until, at);
    assert.ok(at > 0 && end > at, `anti-vacuity: \`${name}\` was not found`);
    return panel.slice(at, end);
  };
  const pickLook = fn('pickLook', 'const pickMeasured = (');
  const pickMeasured = fn('pickMeasured', 'const save = (');

  // A PICTURE: ONE request — the colour read's own — stoppable, and read as it arrives.
  assert.equal((pickMeasured.match(/\bfetch\(/g) ?? []).length, 1, 'a picture pick makes a request of its own to learn its progress');
  assert.match(pickMeasured, /const res = await fetch\(stillUrl, \{ mode: 'cors', signal: stop\.signal \}\);/, 'the picture’s fetch cannot be stopped');
  assert.match(pickMeasured, /const blob = await readBlobWithProgress\(res, \(pct\) => setPick\(\(p\) => \(p && p\.seq === seq \? \{ \.\.\.p, pct, file: pct !== null \} : p\)\)\);\s*frame = await readFrame\(blob\);/, 'the figure is not read off the response the colour read uses');
  // …and stopped BEFORE anything is sent: the stop is checked ahead of the one call that saves.
  const stopped = pickMeasured.indexOf('if (stop.signal.aborted) {');
  const saves = pickMeasured.indexOf('pickLook({ main: build(frame) }');
  assert.ok(stopped > 0 && saves > stopped, 'a cancelled picture can still reach its save');
  assert.match(pickMeasured.slice(stopped, saves), /return loadStopped\(seq, stop\.signal\);\s*\}/, 'a stopped read does not end there');
  assert.equal((pickMeasured.match(/pickLook\(/g) ?? []).length, 1, 'the picture reaches its save by a second path the stop does not guard');

  // A FILM: waited for BEFORE its save is sent; not arrived = return (nothing written), the old background drawn again.
  const waits = pickLook.indexOf('await waitFilmLoad(film,');
  const sent = pickLook.indexOf("pickMark('write-sent');");
  const firstSave = pickLook.indexOf('await makerSave(');
  assert.ok(waits > 0 && sent > waits && firstSave > waits, 'a film’s save is sent before the film has loaded — a cancel would have changed something');
  const gate = pickLook.slice(waits, sent);
  assert.match(gate, /if \(!arrived\) \{[\s\S]*?lookGround\.answered\(lookKey, \{ ok: false, latest: mine, value: next \}, serverRef\.current\);\s*if \(mine\) tellLookSample\(eventId, lookGround\.read\(lookKey, serverRef\.current\)\);\s*return loadStopped\(seq, stop\.signal\);\s*\}/, 'a stopped film does not put the old background back and end');
  assert.doesNotMatch(gate, /saveLookWrite|makerSave|makerRedrawSave/, 'something is written while the film is still loading');
  assert.match(pickLook, /const film = opts\.render \? null : opts\.film !== undefined \? opts\.film : filmOf\(next\);\s*if \(film && fresh\) beginFilmLoad\(film\);/, 'a film worn before can let a new pick through');
  // The figure is the SAMPLE'S OWN `<video>`: told by the element that draws the film, measured off that element.
  const sample = read('app/dashboard/[eventId]/launch/_components/look-sample.tsx');
  assert.match(sample, /<LoopPicture src=\{picture\.clip\} onLoad=\{\(load\) => tellFilmLoad\(picture\.clip, load\)\}>/, 'the film’s figure is not told by the element that plays it');
  assert.match(cards, /tell\.current\?\.\(\{ pct: v \? filmLoadPct\(v\.buffered, v\.duration\) : null, ready \}\);/);
  assert.match(cards, /const v = ref\.current;/);
  assert.equal((cards.match(/<video\b/g) ?? []).length, 1, 'a second <video> is made to measure the film');
  assert.doesNotMatch(cards + read('lib/pick-load.ts'), /\bfetch\(|new Audio|createElement\('video'\)|XMLHttpRequest|setInterval/, 'the progress is learned with a request or a poll of its own');
  // A film that will never move here is said to be ready — a pick never waits on it for ever.
  assert.match(cards, /if \(!shown \|\| !video \|\| typeof IntersectionObserver === 'undefined'\) return tell\.current\?\.\(\{ pct: null, ready: true \}\);/);
  assert.match(cards, /void video\.play\(\)\.catch\(\(\) => told\(true\)\);/);

  // CANCEL: the strip's own stop; a newer pick lets an older load go; only the couple's cancel says so.
  assert.match(panel, /const cancelPick = \(\) => \{[\s\S]*?if \(backgroundPickHolds\(pick\)\) stopLoad\('cancel'\);\s*\};/);
  assert.match(panel, /const loadStopped = \(seq: number, signal: AbortSignal\) => \{\s*if \(signal\.reason !== 'cancel'\) return;\s*setPick\(\(p\) => \(p && p\.seq === seq \? null : p\)\);\s*setNote\(BACKGROUND_PICK_CANCELLED\);\s*\};/);
  assert.match(pickLook, /if \(fresh\) stopLoad\('newer'\);/);
  assert.match(pickMeasured, /stopLoad\('newer'\);\s*const stop = new AbortController\(\);/);
  assert.match(cards, /const does = backgroundCardTap\(looks, load\);\s*if \(does === 'cancel'\) return strip\.onCancel\?\.\(\);\s*if \(does !== 'pick'\) return;/, 'a card decides its tap some other way');
  assert.match(cards, /disabled=\{disabled \|\| load\.locked\}/);

  // THE 8-SECOND STOP: one one-shot timeout that ASKS (`stalled`) — the load is not stopped by it.
  const stall = panel.slice(panel.indexOf('const heldSeq ='), panel.indexOf('const stopLoad ='));
  assert.match(stall, /const t = window\.setTimeout\(\(\) => setPick\(\(p\) => \(p && p\.seq === heldSeq && backgroundPickHolds\(p\) \? \{ \.\.\.p, stalled: true \} : p\)\), BACKGROUND_PICK_CANVAS_WAIT_MS\);/);
  assert.doesNotMatch(stall, /abort|stopLoad|setInterval/, 'the 8-second stop ends the load by itself');
  assert.doesNotMatch(panel, /setInterval/);
  // ONLY THE STRIP: the Source ▾ above it is never disabled by a load.
  const source = panel.slice(panel.indexOf('<BgRow label="Source"'), panel.indexOf('<BgCards '));
  assert.ok(source.includes('<PickMenu'), 'anti-vacuity: Source ▾ was not found');
  assert.doesNotMatch(source, /disabled|holding|stripPick/, 'the Source ▾ is locked while a card loads');

  // AN UPLOAD: `FileUpload`'s own printed figure, handed up — and its own stop.
  const upload = read('app/_components/file-upload.tsx');
  assert.match(upload, /const flyingPct = inFlight\.length > 0 \? inFlight\[0\]!\.progress : null;/, 'the upload’s figure is not the one the uploader prints');
  assert.match(upload, /width: `\$\{item\.progress\}%`/, 'anti-vacuity: the uploader prints some other figure now');
  assert.match(upload, /tellProgress\.current\?\.\(flyingPct\);/);
  assert.match(upload, /cancelRef\.current = \(\) => \{\s*for \(const item of inFlight\) cancelInFlight\(item\.id\);\s*\};/);
  assert.match(panel, /onProgress=\{setUploadPct\}\s*cancelRef=\{uploadStop\}/);
  assert.match(panel, /pick \?\? \(uploadPct !== null \? \{ seq: 0, card: 'upload', strip: 'own', file: true, pct: uploadPct, upload: true, reading: true,/);
  // …an upload may take minutes: it is never called stalled at 8 seconds.
  assert.match(stall, /const heldSeq = backgroundPickHolds\(pick\) && !pick!\.stalled \? pick!\.seq : null;/, 'the stop watches something other than the pick (an upload has none)');
});

/* ── (7) the picked card centres itself ───────────────────────────────── */

test('(7) a picked card sits in the middle of its strip, as far as the ends allow — at once on opening, travelling on a pick', () => {
  // 375-px phone, 16-px inset, 112-px cards 8 px apart, nine cards: content = 16 + 9·112 + 8·8 + 16.
  const row = { width: 375, scrollWidth: 16 + 9 * 112 + 8 * 8 + 16 };
  const card = (i: number) => ({ left: 16 + i * 120, width: 112 });
  const centreOf = (i: number, scrollLeft: number) => card(i).left + 56 - scrollLeft;
  // A card in the middle of the row: its centre is the strip's centre.
  for (const i of [2, 3, 4, 5, 6]) {
    const at = centredScrollLeft(card(i), row);
    assert.ok(Math.abs(centreOf(i, at) - 187.5) <= 0.5, `card ${i} is ${centreOf(i, at)} px in — not in the middle`);
  }
  // The first and the last stop at their edge — the row is never scrolled past an end.
  assert.equal(centredScrollLeft(card(0), row), 0);
  assert.equal(centredScrollLeft(card(8), row), row.scrollWidth - row.width);
  assert.ok(centredScrollLeft(card(1), row) >= 0 && centredScrollLeft(card(1), row) <= 5);
  // A row that does not scroll is left alone.
  assert.equal(centredScrollLeft(card(1), { width: 375, scrollWidth: 300 }), 0);

  const cards = read(`${E}/background-cards.tsx`);
  // Read off the ringed card after a render; instant when the strip was just opened, travelling on a pick.
  assert.match(cards, /const on = el\.querySelector<HTMLElement>\('\[data-bg-card\]\[aria-pressed="true"\]'\);/);
  assert.match(cards, /if \(was && was\.source === source && was\.card === card\) return;\s*centred\.current = \{ source, card \};\s*if \(on\) centreInRow\(el, on, Boolean\(was && was\.source === source\)\);/, 'the strip is not centred on its pick');
  const centre = read('lib/centre-in-row.ts');
  assert.match(centre, /row\.scrollTo\(\{ left, behavior: travel && !still \? 'smooth' : 'auto' \}\);/, 'the strip travels under "reduce motion", or on opening');
  assert.match(centre, /window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
  // Nothing snaps the strip back off its centre (the approved gallery scrolls freely).
  const strip = cards.slice(cards.indexOf('export function BgCards('), cards.indexOf('export function BgPickLine('));
  assert.doesNotMatch(strip + cards.slice(cards.indexOf('export function BgCard(')), /snap-mandatory|snap-start|snap-x/, 'scroll snapping pulls the picked card back off the middle');
  assert.doesNotMatch(strip, /setInterval|requestAnimationFrame/);
});
