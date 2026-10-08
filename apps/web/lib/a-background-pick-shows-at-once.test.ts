/**
 * a-background-pick-shows-at-once.test.ts — STUDIO › LOOK › BACKGROUND: A PICK IS
 * ON THE CANVAS BEFORE ITS SAVE, AND SAYS WHAT IT IS WAITING FOR.
 *
 * Owner, 2026-10-08, after picking a video card: *"took 8 seconds before a
 * background shows"*; then: *"when i press, and it has a loading state, we want
 * to know something is pressed and loading files... applying to your Hub."*
 *
 * The 8 seconds were the PATH, not the files: the pick waited on its save, the
 * save owed a whole-Maker render, and that render reloaded the canvas page.
 * Held here, each where it can be EXECUTED:
 *   (1) the words and their order — "Loading files…", then "Applying to your Hub…";
 *   (2) the tapped card is ringed and marked FROM THE TAP — a pending pick does
 *       not wait on its save (rendered);
 *   (3) the line is not flashed for a pick that lands inside a blink, and a
 *       failure is said in place with Try again — never a success look (rendered);
 *   (4) every background the panel can pick has something honest to lay, and
 *       every message the Maker builds passes the canvas's own checks;
 *   (5) nothing hostile in a message reaches CSS;
 *   (6) the canvas lays the still first, the clip when it MOVES, keeps the last
 *       pick until the next is ready, lets a second tap win, takes a refused pick
 *       off, and steps aside for the page's own render — never before it;
 *   (7) a refused save draws the last LANDED background again; an older pick's
 *       refusal moves nothing;
 *   (8) the wiring: the Studio's pick is drawn and laid BEFORE its save, the save
 *       is held (no whole-Maker render), a newer pick outranks an older answer,
 *       and the bridge takes the preview away only when its own render is in.
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
  BACKGROUND_PICK_LINE,
  BACKGROUND_PICK_QUIET_MS,
  backgroundCardLooks,
  backgroundLayOf,
  backgroundPickAfter,
  backgroundPickStep,
  backgroundPictureKey,
  createLookGroundStore,
  mainGroundPreviewMessage,
  type BackgroundPick,
  type LookGround,
  type LookGroundPictures,
} from './background-pick';
import { HUB_MAIN_PATTERNS, hubMovingBackgroundIds, sanitizeHubMainGround, type HubMainGround } from './hub-canvas';
import { BACKGROUND_EFFECTS, encodeBackgroundChoice } from './ombre';
import { STD_REALISTIC_BACKGROUNDS } from './std-backgrounds';
import { createMainGroundPreviewer, sanitizeMainGroundPreview } from '../app/[slug]/_components/main-ground-preview';

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
const G = 'app/[slug]/_components';
const ORIGIN = 'https://setnayan.com';

const pick = (over: Partial<BackgroundPick> = {}): BackgroundPick => ({ seq: 7, card: null, reading: false, laid: true, shown: false, saved: false, failed: null, ...over });
const stored = (raw: unknown): HubMainGround => {
  const m = sanitizeHubMainGround(raw);
  assert.ok(m, `not a main background the app stores: ${JSON.stringify(raw)}`);
  return m;
};
const FRAME = ['#112233', '#445566'];

/* ── (1) the words, in order ──────────────────────────────────────────── */

test('(1) "Loading files…" while the files are fetched, then "Applying to your Hub…" while the draft write is in flight', () => {
  assert.deepEqual(BACKGROUND_PICK_LINE, { loading: 'Loading files…', applying: 'Applying to your Hub…' }, 'the owner’s own words');
  assert.equal(backgroundPickStep(null), null);
  // A card pick laid on the canvas: the still is on its way → the save is on its way → done.
  assert.equal(backgroundPickStep(pick()), 'loading');
  assert.equal(backgroundPickStep(pick({ saved: true })), 'loading', 'the line clears before the canvas shows the background');
  assert.equal(backgroundPickStep(pick({ shown: true })), 'applying');
  assert.equal(backgroundPickStep(pick({ shown: true, saved: true })), null);
  // A picture whose colours are still being read is loading, whatever the canvas already shows.
  assert.equal(backgroundPickStep(pick({ reading: true, shown: true })), 'loading');
  // A change with nothing to lay (a Shade, a Blur): it is applying until the page has redrawn WITH it.
  assert.equal(backgroundPickStep(pick({ laid: false })), 'applying');
  assert.equal(backgroundPickStep(pick({ laid: false, saved: true })), 'applying', 'the line clears before the canvas has redrawn');
  assert.equal(backgroundPickStep(pick({ laid: false, saved: true, shown: true })), null);
  // A failure outranks everything — never a wait that hides it, never a done.
  assert.equal(backgroundPickStep(pick({ failed: 'No.', shown: true, saved: true })), 'failed');
  // News for another pick changes nothing; the last piece of news ends the pick.
  const p = pick({ shown: true });
  assert.equal(backgroundPickAfter(p, 6, { saved: true }), p, 'an older pick’s answer moved the newer pick');
  assert.equal(backgroundPickAfter(p, 7, { saved: true }), null);
  assert.deepEqual(backgroundPickAfter(pick(), 7, { saved: true }), pick({ saved: true }));
  assert.ok(BACKGROUND_PICK_QUIET_MS >= 250 && BACKGROUND_PICK_QUIET_MS <= 400, 'about 300 ms');
});

/* ── (2) the ring does not wait on the save ───────────────────────────── */

test('(2) the tapped card is ringed and wears the progress mark from the tap — a pending pick does not wait on its save', async () => {
  // The rule.
  assert.deepEqual(backgroundCardLooks('loop:a', true, null), { on: true, busy: false });
  assert.deepEqual(backgroundCardLooks('loop:b', false, null), { on: false, busy: false });
  // A pick that names its card (its picture is still being read): the ring is THERE, off the stored one.
  const reading = pick({ card: 'scene:x', reading: true });
  assert.deepEqual(backgroundCardLooks('scene:x', false, reading), { on: true, busy: true });
  assert.deepEqual(backgroundCardLooks('loop:a', true, reading), { on: false, busy: false }, 'the old card is still ringed while the new one loads');
  // A pick already drawn in the panel: the ringed card is the one on its way.
  assert.deepEqual(backgroundCardLooks('loop:b', true, pick()), { on: true, busy: true });
  assert.deepEqual(backgroundCardLooks('loop:a', false, pick()), { on: false, busy: false });
  // Done or failed: no mark; a failed pick leaves the ring where the stored background is.
  assert.deepEqual(backgroundCardLooks('scene:x', false, pick({ card: 'scene:x', failed: 'No.' })), { on: false, busy: false }, 'a failed pick still looks picked');
  assert.deepEqual(backgroundCardLooks('loop:a', true, pick({ card: 'scene:x', failed: 'No.' })), { on: true, busy: false });

  // RENDERED: the save has NOT answered (`saved: false`) — the ring is on the new card, the old card has none,
  // the new card wears the mark, and the line reads "Applying to your Hub…".
  const { renderToStaticMarkup } = await import('react-dom/server');
  const C = await import(`../${E}/background-cards`);
  const pending = pick({ card: 'loop:new', shown: true, saved: false });
  const html = renderToStaticMarkup(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(
        C.BgCards,
        { label: 'Video', source: 'video', pick: pending },
        React.createElement(C.BgCard, { key: 'a', name: 'Old', data: 'loop:old', on: true, onPick: () => {}, swatch: '#000' }),
        React.createElement(C.BgCard, { key: 'b', name: 'New', data: 'loop:new', on: false, onPick: () => {}, swatch: '#fff' }),
      ),
      React.createElement(C.BgPickLine, { step: backgroundPickStep(pending), error: null, onRetry: () => {}, quietMs: 0 }),
    ),
  );
  const cardOf = (data: string) => new RegExp(`<button[^>]*data-bg-card="${data}"[^>]*>[\\s\\S]*?</button>`).exec(html)?.[0] ?? '';
  const fresh = cardOf('loop:new');
  const old = cardOf('loop:old');
  assert.match(fresh, /aria-pressed="true"/, 'the tapped card is not pressed until the save answers');
  assert.match(fresh, /data-bg-card-picture=""[^>]*class="sn-phone-card ring-2 ring-terracotta-700"/, 'the ring is not on the tapped card');
  assert.match(fresh, /data-bg-card-busy=""/, 'the tapped card wears no progress mark');
  assert.match(fresh, /aria-busy="true"/);
  assert.match(old, /aria-pressed="false"/, 'the old card is still pressed');
  assert.match(old, /class="sn-phone-card ring-1 ring-ink\/10"/);
  assert.doesNotMatch(old, /data-bg-card-busy/);
  assert.match(html, /<p[^>]*data-bg-pick-line="applying"[^>]*>[\s\S]*?Applying to your Hub…<\/p>/, 'the line does not say the draft write is in flight');
  // The other cards stay tappable: nothing is disabled while a pick is on its way.
  // (the attribute itself — `disabled:opacity-50` in the class list is not it)
  assert.doesNotMatch(html, /<button[^>]*\sdisabled=""/, 'a card is locked while a pick is on its way — a second tap could not win');
  const locked = renderToStaticMarkup(React.createElement(C.BgCard, { name: 'Locked', data: 'x', on: false, disabled: true, onPick: () => {}, swatch: '#000' }));
  assert.match(locked, /<button[^>]*\sdisabled=""/, 'anti-vacuity: a disabled card does not render the attribute this looks for');
  // No pick: no mark anywhere, the ring where `on` says.
  const rest = renderToStaticMarkup(
    React.createElement(C.BgCards, { label: 'Video', source: 'video', pick: null }, React.createElement(C.BgCard, { name: 'Old', data: 'loop:old', on: true, onPick: () => {}, swatch: '#000' })),
  );
  assert.match(rest, /aria-pressed="true"/);
  assert.doesNotMatch(rest, /data-bg-card-busy|aria-busy="true"/);
});

/* ── (3) the line ─────────────────────────────────────────────────────── */

test('(3) the line is polite, never flashed inside a blink, and a failure is said in place with Try again', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const C = await import(`../${E}/background-cards`);
  const line = (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(C.BgPickLine, { error: null, onRetry: () => {}, ...props }));
  // Both steps, in the owner's words, once the wait has outlasted the blink.
  assert.match(line({ step: 'loading', quietMs: 0 }), /Loading files…/);
  assert.match(line({ step: 'applying', quietMs: 0 }), /Applying to your Hub…/);
  for (const step of ['loading', 'applying']) {
    const html = line({ step, quietMs: 0 });
    assert.match(html, /^<p[^>]*aria-live="polite"/, 'the line is not announced politely');
    assert.match(html, /role="status"/);
    assert.doesNotMatch(html, /role="alert"|Try again/, 'a wait looks like a failure');
  }
  // AT THE TAP (before the blink is over) nothing is said — the first paint of a pending pick has no words.
  for (const step of ['loading', 'applying']) {
    const html = line({ step });
    assert.doesNotMatch(html, /Loading files|Applying to your Hub/, `${step}: the line flashes for a pick that lands at once`);
    assert.match(html, /aria-live="polite"/, 'the live region is not there before its words are');
  }
  // Nothing on its way: the region stays (so the next words are announced) and says nothing.
  assert.doesNotMatch(line({ step: null, quietMs: 0 }), /Loading|Applying|Try again/);
  // A failure: its words, at once (no blink to wait out), with Try again — and none of the waiting words.
  const failed = line({ step: 'failed', error: 'Your background could not be changed. Please try again.' });
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Your background could not be changed\. Please try again\./);
  assert.match(failed, /<button[^>]*data-bg-pick-retry=""[^>]*>Try again<\/button>/);
  assert.doesNotMatch(failed, /Loading files|Applying to your Hub|animate-spin/, 'a failure still looks like it is working');
  // A failure with no words of its own still says one — never an empty alert.
  assert.match(line({ step: 'failed', error: null }), /could not/i);
  // Not a toast, not a blocker: in the flow of the panel, no fixed layer.
  for (const html of [line({ step: 'applying', quietMs: 0 }), failed]) assert.doesNotMatch(html, /\bfixed\b|inset-0|z-\d|backdrop/, 'the line is a layer over the panel');
});

/* ── (4) every pick has something honest to lay ───────────────────────── */

const PICTURES: LookGroundPictures = {
  loop: (id) => ({ still: `https://pub.example.test/themes/${id}/poster.jpg`, clip: `https://pub.example.test/themes/${id}/loop.mp4` }),
  media: (ref) => (ref.startsWith('/std/') ? ref : `https://media.example.test/${encodeURIComponent(ref)}?X-Amz-Signature=abc&X-Amz-Expires=3600`),
  cover: 'https://media.example.test/cover.jpg?sig=1',
  themeId: hubMovingBackgroundIds()[0]!,
};

test('(4) every background the panel can pick lays something the canvas accepts — still first, clip beside it', () => {
  const lays: Array<[string, LookGround]> = [
    ...hubMovingBackgroundIds().map((id): [string, LookGround] => [`loop ${id}`, { main: stored({ ground: 'loop', loop: id }), bg: null, art: null }]),
    ['the page’s own loop', { main: stored({ ground: 'theme' }), bg: null, art: null }],
    ...STD_REALISTIC_BACKGROUNDS.map((b): [string, LookGround] => [`scene ${b.id}`, { main: stored({ kind: 'photo', media: b.src, tint: { match: true, frame: FRAME } }), bg: null, art: null }]),
    ['their photo', { main: stored({ kind: 'photo', media: 'r2://setnayan-media/events/E1/main-background/a.jpg', tint: { match: true, frame: FRAME } }), bg: null, art: null }],
    ['their photo, held at the top', { main: stored({ kind: 'photo', media: 'r2://setnayan-media/events/E1/main-background/a.jpg', tint: { match: true, frame: FRAME }, focus: 'top' }), bg: null, art: null }],
    ['their clip', { main: stored({ kind: 'snippet', media: 'r2://setnayan-media/events/E1/main-background/a.mp4', poster: 'r2://setnayan-media/events/E1/main-background/a.jpg', tint: { match: true, frame: FRAME } }), bg: null, art: null }],
    ['the cover photo', { main: stored({ follow: 'hero', of: 'r2://setnayan-media/events/E1/landing-page-hero/h.jpg', tint: { match: true, frame: FRAME } }), bg: null, art: null }],
    ...BACKGROUND_EFFECTS.map((e): [string, LookGround] => [`colour ${e}`, { main: stored({ ground: 'none' }), bg: encodeBackgroundChoice('#5b1a22', e) || null, art: null }]),
    ['the Mood Board’s colour', { main: stored({ ground: 'none' }), bg: null, art: null }],
    ...HUB_MAIN_PATTERNS.flatMap((k): Array<[string, LookGround]> => [
      [`pattern ${k}`, { main: stored({ ground: 'pattern', pattern: k }), bg: null, art: null }],
      [`pattern ${k} on a blend`, { main: stored({ ground: 'pattern', pattern: k }), bg: encodeBackgroundChoice('#5b1a22', BACKGROUND_EFFECTS[1]!) || null, art: null }],
    ]),
  ];
  assert.ok(lays.length >= 9 + 10 + 4 + 4 + 8, `anti-vacuity: only ${lays.length} backgrounds tried`);
  let seq = 0;
  for (const [what, ground] of lays) {
    const lay = backgroundLayOf(ground, PICTURES);
    assert.ok(lay, `${what}: nothing is laid on the canvas`);
    const message = mainGroundPreviewMessage(++seq, lay);
    assert.equal(message.source, 'setnayan-editor');
    assert.equal(message.t, 'mainGround');
    // The canvas's OWN checks take it, unchanged — a message it refuses would be a pick that never shows.
    assert.deepEqual(sanitizeMainGroundPreview(JSON.parse(JSON.stringify(message)), ORIGIN), { seq, lay }, `${what}: the canvas refuses what the Maker built`);
    const picture = ground.main && !('ground' in ground.main && ground.main.ground !== 'loop' && ground.main.ground !== 'theme');
    if (picture) {
      assert.ok(lay.still, `${what}: a picture with no still — nothing paints until the film arrives`);
      assert.equal(lay.color, null);
    } else {
      assert.equal(lay.still, null, `${what}: a colour lays a picture`);
      assert.equal(lay.clip, null);
    }
  }
  // A moving background: its loop rides beside its still. Their clip: its poster first, then the clip.
  const loop = backgroundLayOf({ main: stored({ ground: 'loop', loop: hubMovingBackgroundIds()[1] }), bg: null }, PICTURES)!;
  assert.match(loop.still!, /poster\.jpg$/);
  assert.match(loop.clip!, /loop\.mp4$/);
  const clip = backgroundLayOf(lays.find((l) => l[0] === 'their clip')![1], PICTURES)!;
  assert.match(clip.still!, /a\.jpg/);
  assert.match(clip.clip!, /a\.mp4/);
  // Cropped where the page crops (the guest page's one rule).
  assert.equal(backgroundLayOf(lays.find((l) => l[0] === 'their photo, held at the top')![1], PICTURES)!.position, 'center top');
  // A colour: its hex; a blend: its gradient over the hex; a pattern: the guest page's own pattern (the page's ink).
  assert.deepEqual(backgroundLayOf({ main: stored({ ground: 'none' }), bg: '#5b1a22' }, PICTURES), { still: null, clip: null, position: 'center', color: '#5b1a22', image: null, size: null });
  const blend = backgroundLayOf({ main: stored({ ground: 'none' }), bg: encodeBackgroundChoice('#5b1a22', BACKGROUND_EFFECTS[1]!) }, PICTURES)!;
  assert.match(blend.image!, /gradient\(/);
  assert.equal(blend.color, '#5b1a22');
  const dots = backgroundLayOf({ main: stored({ ground: 'pattern', pattern: 'dots' }), bg: null }, PICTURES)!;
  assert.match(dots.image!, /rgb\(var\(--color-ink\) \/ 0?\.\d+\)/, 'the pattern is not drawn in the page’s own ink');
  assert.ok(dots.size);
  // A picture whose address is not known here lays NOTHING (never a guess): the canvas waits for its own render.
  assert.equal(backgroundLayOf({ main: stored({ ground: 'loop', loop: hubMovingBackgroundIds()[0] }), bg: null }, { ...PICTURES, loop: () => null }), null);
  assert.equal(backgroundLayOf({ main: lays.find((l) => l[0] === 'their photo')![1].main, bg: null }, { ...PICTURES, media: () => null }), null);
  assert.equal(backgroundLayOf({ main: null, bg: null }, PICTURES), null, 'nothing stored is drawn as something');
  // WHICH picture: a Shade, a Blur, a Focus keep it (nothing new to lay); another card changes it.
  const photo = lays.find((l) => l[0] === 'their photo')![1];
  const shaded = { ...photo, main: stored({ ...(photo.main as object), shade: 'dark', blur: 'soft', focus: 'top' }) };
  assert.equal(backgroundPictureKey(shaded), backgroundPictureKey(photo), 'a Shade is laid as a new picture — its veil would be lost');
  assert.equal(backgroundPictureKey({ ...photo, bg: '#000000' }), backgroundPictureKey(photo), 'a page colour under a photo is a new picture');
  assert.equal(new Set(lays.map((l) => backgroundPictureKey(l[1]))).size, lays.length - 1, 'two different cards are the same picture (only the held photo repeats one)');
});

/* ── (5) nothing hostile reaches CSS ──────────────────────────────────── */

test('(5) the canvas refuses any message that is not the Maker’s own shape — nothing reaches CSS unchecked', () => {
  const good = { still: 'https://pub.example.test/a.jpg', clip: null, position: 'center', color: null, image: null, size: null };
  const msg = (lay: unknown, seq: unknown = 3) => ({ source: 'setnayan-editor', t: 'mainGround', seq, lay });
  assert.deepEqual(sanitizeMainGroundPreview(msg(good), ORIGIN), { seq: 3, lay: good });
  assert.deepEqual(sanitizeMainGroundPreview(msg(null), ORIGIN), { seq: 3, lay: null }, 'a refused pick cannot be taken off');
  assert.deepEqual(sanitizeMainGroundPreview(msg({ ...good, still: '/std/backgrounds/golden-hour.webp' }), ORIGIN)?.lay?.still, '/std/backgrounds/golden-hour.webp');
  assert.ok(sanitizeMainGroundPreview(msg({ ...good, still: `${ORIGIN}/api/media/x.jpg` }), ORIGIN));
  const bad: Array<[string, unknown, unknown?]> = [
    ['no number', good, undefined],
    ['a number below one', good, 0],
    ['a fraction', good, 1.5],
    ['a string number', good, '3'],
    ['not an object', 'x'],
    ['a quote in the address', { ...good, still: 'https://x.test/a.jpg")' }],
    ['a bracket in the address', { ...good, still: 'https://x.test/a.jpg);background:url(//evil' }],
    ['a space in the address', { ...good, still: 'https://x.test/a b.jpg' }],
    ['a script address', { ...good, still: 'javascript:alert(1)' }],
    ['a data address', { ...good, still: 'data:image/svg+xml,<svg/>' }],
    ['plain http elsewhere', { ...good, still: 'http://x.test/a.jpg' }],
    ['a protocol-relative address', { ...good, still: '//evil.test/a.jpg' }],
    ['a clip with a quote', { ...good, clip: 'https://x.test/a.mp4"' }],
    ['a position of its own', { ...good, position: 'center; position: fixed' }],
    ['no position', { ...good, position: undefined }],
    ['a named colour', { ...good, color: 'red' }],
    ['a colour with a tail', { ...good, color: '#fff;' }],
    ['a picture inside the blend', { ...good, still: null, image: 'url(https://evil.test/x.png)' }],
    ['an image-set', { ...good, still: null, image: 'image-set(x)' }],
    ['a semicolon in the blend', { ...good, still: null, image: 'linear-gradient(#000, #fff); position: fixed' }],
    ['a brace in the blend', { ...good, still: null, image: 'linear-gradient(#000, #fff)}body{display:none' }],
    ['a quote in the size', { ...good, still: null, size: '"12px"' }],
    ['a very long blend', { ...good, still: null, image: 'linear-gradient(' + '#000, '.repeat(400) + '#fff)' }],
  ];
  for (const [what, lay, seq] of bad) {
    const data = what === 'no number' ? { source: 'setnayan-editor', t: 'mainGround', lay } : msg(lay, seq ?? 3);
    assert.equal(sanitizeMainGroundPreview(data, ORIGIN), null, `${what}: taken`);
  }
  for (const junk of [null, undefined, 3, 'x', []]) assert.equal(sanitizeMainGroundPreview(junk, ORIGIN), null);
  // The module ships in the guest page's bundle: it imports nothing at run time.
  const src = read(`${G}/main-ground-preview.ts`);
  assert.doesNotMatch(src, /^\s*import (?!type\b)/m, 'the preview pulls a module into the guest page');
});

/* ── (6) what the canvas does ─────────────────────────────────────────── */

/** A tiny DOM: exactly what `createMainGroundPreviewer` touches. */
function fakeCanvas(opts: { reducedMotion?: boolean } = {}) {
  type Listener = () => void;
  class El {
    className = '';
    hidden = false;
    children: El[] = [];
    parent: El | null = null;
    attrs: Record<string, string> = {};
    style: Record<string, string> = {};
    listeners: Record<string, Listener[]> = {};
    muted = false; loop = false; playsInline = false; preload = ''; src = ''; paused = true; currentTime = 0;
    constructor(public tagName: string, public ownerDocument: unknown) {}
    setAttribute(k: string, v: string) { this.attrs[k] = v; }
    removeAttribute(k: string) { if (k === 'style') this.style = {}; else delete this.attrs[k]; }
    replaceChildren(...kids: El[]) { this.children = kids; for (const k of kids) k.parent = this; }
    append(k: El) { this.children.push(k); k.parent = this; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); }
    contains(o: El): boolean { return this.children.includes(o) || this.children.some((c): boolean => c.contains(o)); }
    querySelector(sel: string) { return this.children.find((c) => c.tagName === sel.toUpperCase()) ?? null; }
    addEventListener(t: string, fn: Listener) { (this.listeners[t] ??= []).push(fn); }
    fire(t: string) { const l = this.listeners[t] ?? []; this.listeners[t] = []; for (const fn of l) fn(); }
    play() { return Promise.resolve(); }
  }
  const images: Array<{ src: string; onload: null | (() => void); onerror: null | (() => void) }> = [];
  const timers: Array<() => void> = [];
  const pageVideos: El[] = [];
  const win = {
    Image: class { src = ''; onload: null | (() => void) = null; onerror: null | (() => void) = null; constructor() { images.push(this); } },
    requestAnimationFrame: (f: () => void) => { f(); return 0; },
    matchMedia: () => ({ matches: Boolean(opts.reducedMotion) }),
    setTimeout: (f: () => void) => { timers.push(f); return 0; },
    navigator: {},
  };
  const doc = { defaultView: win, createElement: (tag: string): El => new El(tag.toUpperCase(), doc), querySelectorAll: () => pageVideos };
  const layer = new El('DIV', doc);
  layer.hidden = true;
  const told: unknown[] = [];
  const p = createMainGroundPreviewer(layer as unknown as HTMLElement, (m) => told.push(m));
  return { p, layer, images, told, timers, pageVideos, El, doc };
}
const PHOTO = { still: 'https://x.test/a.jpg', clip: null, position: 'center top', color: null, image: null, size: null };
const FILM = { still: 'https://x.test/b.jpg', clip: 'https://x.test/b.mp4', position: 'center', color: null, image: null, size: null };

test('(6) the canvas lays the still first, the clip when it moves, lets a second tap win, and steps aside only for its own render', () => {
  // A picture: nothing changes until its still has LOADED — then it is on screen, and the Maker is told.
  let c = fakeCanvas();
  c.p.lay({ seq: 1, lay: PHOTO });
  assert.equal(c.layer.hidden, true, 'an empty layer covered the page before the still arrived');
  assert.deepEqual(c.told, []);
  assert.equal(c.images[0]!.src, PHOTO.still);
  c.images[0]!.onload!();
  assert.equal(c.layer.hidden, false);
  assert.equal(c.layer.children.length, 1);
  assert.equal(c.layer.children[0]!.style.backgroundImage, 'url("https://x.test/a.jpg")');
  assert.equal(c.layer.children[0]!.style.backgroundPosition, 'center top', 'the still is not cropped where the page crops it');
  assert.deepEqual(c.told, [{ seq: 1, shown: true }]);

  // A SECOND TAP WINS: the first pick stays on screen until the second is ready; the first pick's late still is dropped.
  c = fakeCanvas();
  c.p.lay({ seq: 1, lay: PHOTO });
  c.p.lay({ seq: 2, lay: FILM });
  c.images[0]!.onload!();
  assert.equal(c.layer.hidden, true, 'the older pick was laid after a newer one was tapped');
  assert.deepEqual(c.told, []);
  c.images[1]!.onload!();
  assert.equal(c.layer.children[0]!.style.backgroundImage, 'url("https://x.test/b.jpg")');
  assert.deepEqual(c.told, [{ seq: 2, shown: true }]);
  c.p.lay({ seq: 1, lay: PHOTO });
  assert.equal(c.images.length, 2, 'an older pick’s message, arriving late, was laid');
  // …and while a third loads, the second stays (never a flash back to the saved background).
  c.p.lay({ seq: 3, lay: PHOTO });
  assert.equal(c.layer.hidden, false);
  assert.equal(c.layer.children[0]!.style.backgroundImage, 'url("https://x.test/b.jpg")');

  // The clip: beside the still, INVISIBLE until it moves; muted, looping, inline; no autoplay attribute.
  c = fakeCanvas();
  c.p.lay({ seq: 1, lay: FILM });
  c.images[0]!.onload!();
  const video = c.layer.children.find((k) => k.tagName === 'VIDEO')!;
  assert.ok(video, 'the loop never swaps in');
  assert.equal(video.src, FILM.clip);
  assert.equal(video.style.opacity, '0', 'the clip covers the still before it moves');
  assert.deepEqual([video.muted, video.loop, video.playsInline], [true, true, true]);
  assert.equal(video.attrs.autoplay, undefined);
  video.fire('playing');
  assert.equal(video.style.opacity, '1');
  // …and the Maker's stopwatch hears that it moves (`bg-pick:loop-playing`).
  assert.deepEqual(c.told.at(-1), { seq: 1, playing: true });
  // A clip that cannot play removes itself — the still stays.
  c = fakeCanvas();
  c.p.lay({ seq: 1, lay: FILM });
  c.images[0]!.onload!();
  c.layer.children.find((k) => k.tagName === 'VIDEO')!.fire('error');
  assert.deepEqual(c.layer.children.map((k) => k.tagName), ['DIV']);
  // Reduced motion: no clip at all.
  c = fakeCanvas({ reducedMotion: true });
  c.p.lay({ seq: 1, lay: FILM });
  c.images[0]!.onload!();
  assert.deepEqual(c.layer.children.map((k) => k.tagName), ['DIV'], 'a clip plays under "reduce motion"');

  // A colour, a blend, a pattern: at once (nothing to fetch), over whatever picture was there.
  c = fakeCanvas();
  c.p.lay({ seq: 1, lay: PHOTO });
  c.images[0]!.onload!();
  c.p.lay({ seq: 2, lay: { still: null, clip: null, position: 'center', color: '#5b1a22', image: 'linear-gradient(#000, #fff)', size: 'auto' } });
  assert.equal(c.layer.hidden, false);
  assert.deepEqual(c.layer.children, [], 'the old picture shows through the colour');
  assert.deepEqual([c.layer.style.backgroundColor, c.layer.style.backgroundImage, c.layer.style.backgroundSize], ['#5b1a22', 'linear-gradient(#000, #fff)', 'auto']);
  assert.deepEqual(c.told.at(-1), { seq: 2, shown: true });
  // …and with no colour of its own it is the page's paper — never see-through over an old picture.
  c.p.lay({ seq: 3, lay: { still: null, clip: null, position: 'center', color: null, image: null, size: null } });
  assert.equal(c.layer.style.backgroundColor, 'rgb(var(--color-cream))');

  // A still that cannot load: said (the Maker stops waiting for it), and nothing is laid.
  c = fakeCanvas();
  c.p.lay({ seq: 1, lay: PHOTO });
  c.images[0]!.onerror!();
  assert.equal(c.layer.hidden, true);
  assert.deepEqual(c.told, [{ seq: 1, shown: false }]);

  // A REFUSED pick is taken off: the page's own (old) ground is what shows.
  c = fakeCanvas();
  c.p.lay({ seq: 1, lay: PHOTO });
  c.images[0]!.onload!();
  c.p.lay({ seq: 1, lay: null });
  assert.equal(c.layer.hidden, true, 'a refused pick is still on the canvas');
  assert.deepEqual(c.layer.children, []);

  // THE PAGE'S OWN RENDER takes over — and only the render that could hold this pick.
  c = fakeCanvas();
  c.p.lay({ seq: 1, lay: PHOTO });
  c.images[0]!.onload!();
  c.p.redrawStarted();
  c.p.redrawDone();
  assert.equal(c.layer.hidden, true, 'the preview outlives the server’s own render');
  assert.deepEqual(c.told.at(-1), { redrawn: true });
  // A pick tapped WHILE a redraw was on its way outlives it (that render is older than the pick)…
  c = fakeCanvas();
  c.p.lay({ seq: 1, lay: PHOTO });
  c.images[0]!.onload!();
  c.p.redrawStarted();
  c.p.lay({ seq: 2, lay: FILM });
  c.images[1]!.onload!();
  c.p.redrawDone();
  assert.equal(c.layer.hidden, false, 'an older render took the newer pick off the canvas — it would flash back');
  // …and goes with the next one.
  c.p.redrawStarted();
  c.p.redrawDone();
  // (a moving preview waits for the page's own clip to move — here there is none, so it goes at once)
  assert.equal(c.layer.hidden, true);
  // A moving preview does not hand over to a clip that is not moving yet.
  c = fakeCanvas();
  c.p.lay({ seq: 1, lay: FILM });
  c.images[0]!.onload!();
  const mine = c.layer.children.find((k) => k.tagName === 'VIDEO')!;
  mine.paused = false;
  const theirs = new c.El('VIDEO', c.doc);
  c.pageVideos.push(theirs);
  c.p.redrawStarted();
  c.p.redrawDone();
  assert.equal(c.layer.hidden, false, 'the swap shows a still frame between two films');
  theirs.fire('playing');
  assert.equal(c.layer.hidden, true);
  // …but never waits for ever.
  c = fakeCanvas();
  c.p.lay({ seq: 1, lay: FILM });
  c.images[0]!.onload!();
  c.layer.children.find((k) => k.tagName === 'VIDEO')!.paused = false;
  c.pageVideos.push(new c.El('VIDEO', c.doc));
  c.p.redrawStarted();
  c.p.redrawDone();
  assert.equal(c.timers.length, 1);
  c.timers[0]!();
  assert.equal(c.layer.hidden, true);
});

/* ── (7) a refusal draws the last landed background again ─────────────── */

test('(7) a refused save puts the last LANDED background back; an older pick’s refusal moves nothing', () => {
  const A: LookGround = { main: stored({ ground: 'loop', loop: hubMovingBackgroundIds()[0] }), bg: null, art: null };
  const B: LookGround = { main: stored({ ground: 'loop', loop: hubMovingBackgroundIds()[1] }), bg: null, art: null };
  const C: LookGround = { main: stored({ ground: 'pattern', pattern: 'dots' }), bg: '#5b1a22', art: null };
  const KEY = 'look:E1';
  // Drawn at the tap — before any answer.
  let s = createLookGroundStore();
  assert.deepEqual(s.read(KEY, A), A);
  s.draw(KEY, B, A);
  s.sent();
  assert.deepEqual(s.read(KEY, A), B, 'the pick is not drawn until its save answers');
  // Taken: it stays, though the server's props are still the old ones (a held save owes no Maker render).
  s.answered(KEY, { ok: true, latest: true, value: B }, A);
  assert.equal(s.flying(), 0);
  assert.deepEqual(s.read(KEY, A), B, 'the ring went back to the old card after the save landed');
  // The next pick is refused: what the last landed save left (B) is drawn again — not the stale prop (A).
  s.draw(KEY, C, A);
  s.sent();
  assert.deepEqual(s.read(KEY, A), C);
  s.answered(KEY, { ok: false, latest: true, value: C }, A);
  assert.deepEqual(s.read(KEY, A), B, 'a refused pick went back to a background older than the one the draft holds');
  // A first pick refused: the server's own.
  s = createLookGroundStore();
  s.draw(KEY, B, A);
  s.sent();
  s.answered(KEY, { ok: false, latest: true, value: B }, A);
  assert.deepEqual(s.read(KEY, A), A, 'a refused pick still looks picked');
  // Two quick picks; the OLDER one is refused after the newer was tapped: the newer stays on screen.
  s = createLookGroundStore();
  s.draw(KEY, B, A);
  s.sent();
  s.draw(KEY, C, A);
  s.sent();
  s.answered(KEY, { ok: false, latest: false, value: B }, A);
  assert.deepEqual(s.read(KEY, A), C, 'an older pick’s refusal overwrote the newer pick');
  s.answered(KEY, { ok: true, latest: true, value: C }, A);
  assert.deepEqual(s.read(KEY, A), C);
  // …and the newer refused after the older landed: the older is what the draft holds.
  s = createLookGroundStore();
  s.draw(KEY, B, A);
  s.sent();
  s.draw(KEY, C, A);
  s.sent();
  s.answered(KEY, { ok: true, latest: false, value: B }, A);
  s.answered(KEY, { ok: false, latest: true, value: C }, A);
  assert.deepEqual(s.read(KEY, A), B);
  // The server catches up (a Maker render brings the same value): ours is dropped; then an Undo is believed.
  assert.deepEqual(s.read(KEY, B), B);
  assert.deepEqual(s.read(KEY, A), A, 'an Undo on the server was hidden by the Maker’s own copy');
});

/* ── (8) the wiring ───────────────────────────────────────────────────── */

test('(8) the Studio draws and lays a pick BEFORE its save, holds the save, lets a later pick outrank an older answer — and the bridge steps aside only for its own render', () => {
  const panel = read(`${E}/main-background-panel.tsx`);
  const fn = (name: string, until: string) => {
    const at = panel.indexOf(`const ${name} = (`);
    const end = panel.indexOf(until, at);
    assert.ok(at > 0 && end > at, `anti-vacuity: \`${name}\` was not found`);
    return panel.slice(at, end);
  };
  const pickLook = fn('pickLook', 'const pickMeasured = (');
  const pickMeasured = fn('pickMeasured', 'const save = (');
  // ORDER, in the one pick: the canvas is told, the panel draws it (the ring), the line starts — THEN the save is sent.
  const order = ['tellLookCanvas(mainGroundPreviewMessage(seq, lay))', 'lookDrawnSeq = seq;', 'lookGround.draw(lookKey, next, serverRef.current);', 'setPick((was) => ({', 'await makerRedrawSave('].map((s) => pickLook.indexOf(s));
  assert.ok(order.every((i) => i > 0), `a step of the pick is missing: ${order.join(', ')}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the pick is not laid and drawn before its save is sent');
  // HELD: the save owes no whole-Maker render (the canvas page redraws itself in place) and answers with the Apply bar.
  assert.match(pickLook, /await makerRedrawSave\(\(\) => saveLookWrite\(eventId, write, draftAction, true\), \(\) => router\.refresh\(\)\)/, 'the Studio pick’s save is not the held redraw save');
  assert.match(panel, /if \(bar\) fd\.set\(HUB_DRAFT_BAR_FIELD, '1'\);/, 'a held pick does not ask for the Apply bar — its count would wait for a render that never comes');
  // …only a file just uploaded (no address to lay) keeps the whole-Maker render.
  assert.match(pickLook, /opts\.render\s*\? await makerSave\(\(\) => saveLookWrite\(eventId, write, draftAction\), \(\) => router\.refresh\(\)\)/);
  assert.equal((panel.match(/\{ render: true \}/g) ?? []).length, 2, 'a pick other than an upload (and its retry) asks for a whole-Maker render');
  // The Studio never waits inside a transition, and a card is never locked by a save in flight.
  assert.doesNotMatch(pickLook + pickMeasured, /\bstart\(|startTransition\(/, 'the Studio pick runs inside a transition — React would hold its ring until the save answers');
  assert.match(fn('save', 'const onFilePicked = ('), /^const save = \(.*\) => \{\s*if \(studio\) return pickLook\(\{ main \}, failure\);/, 'a Studio save still waits on the server');
  // A LATER PICK WINS: every pick takes a new number; an answer is "latest" only for the newest; a stale read is dropped.
  assert.match(pickLook, /const seq = opts\.began \?\? \+\+lookPickSeq;/);
  // "Latest" = the last pick DRAWN — a newer tap still reading its picture has drawn nothing, so an older refusal must still put the landed background back.
  assert.match(pickLook, /const latest = seq === lookDrawnSeq;\s*lookGround\.answered\(lookKey, \{ ok, latest, value: next \}, serverRef\.current\);/);
  assert.match(pickLook, /if \(ok\) setPick\(\(p\) => backgroundPickAfter\(p, seq, \{ saved: true \}\)\);/);
  assert.match(pickMeasured, /if \(seq !== lookPickSeq\) return;/, 'a slow read of an older tap can overwrite the newer pick');
  // A REFUSAL: the preview comes off the canvas, the failure is said — and only for the latest pick.
  assert.match(pickLook, /else if \(latest\) \{\s*tellLookCanvas\(mainGroundPreviewMessage\(seq, null\)\);\s*setPick\(\(p\) => \(p && p\.seq === seq \? \{ \.\.\.p, reading: false, failed: said \} : p\)\);/, 'a refused pick is not taken off the canvas and said');
  assert.match(pickMeasured, /if \(frame\.length === 0\) \{\s*tellLookCanvas\(mainGroundPreviewMessage\(seq, null\)\);\s*setPick\(\(p\) => \(p && p\.seq === seq \? \{ \.\.\.p, reading: false, failed: COULD_NOT_READ \} : p\)\);/, 'a picture that could not be read still looks picked');
  assert.doesNotMatch(pickLook + pickMeasured, /setPick\(null\)/, 'a failure clears the line as if it were done');
  // The panel READS its background through the store (a held save brings no props), and draws the line and the pick.
  assert.match(panel, /const ground = studio \? lookGround\.read\(lookKey, server\) : server;/);
  assert.match(panel, /<BgCards label=\{BACKGROUND_SOURCE_LABEL\[view\]\} source=\{view\} pick=\{pick\} onTap=\{\(data\) => \(tapped\.current = data\)\}>/);
  assert.match(panel, /<BgPickLine step=\{backgroundPickStep\(pick\)\} error=\{pick\?\.failed \?\? null\} onRetry=\{pick\?\.failed \? \(\) => retry\.current\?\.\(\) : null\} \/>/);
  assert.equal((panel.match(/<BgPickLine/g) ?? []).length, 1, 'ONE line');
  // The canvas's news is believed only from this origin, and a redraw counts only for a pick whose save had landed.
  const ear = panel.slice(panel.indexOf('const onCanvas = ('), panel.indexOf("window.addEventListener('message', onCanvas);"));
  assert.match(ear, /if \(e\.origin !== window\.location\.origin\) return;/);
  // …and only from the page the couple is looking at; the preview is laid there alone (never on a stage kept warm behind).
  assert.match(panel, /const LOOK_FRAMES = 'iframe\[data-maker-page-frame\], iframe\[data-maker-canvas-frame="shown"\]';/, 'a preview is laid on frames nobody sees — each would fetch a still and decode a film');
  assert.match(ear, /if \(!\[\.\.\.document\.querySelectorAll<HTMLIFrameElement>\(LOOK_FRAMES\)\]\.some\(\(f\) => f\.contentWindow === e\.source\)\) return;/, 'a warm stage’s redraw ends the pick before the shown page has it');
  assert.match(ear, /setPick\(\(p\) => \(p && p\.saved \? backgroundPickAfter\(p, p\.seq, \{ shown: true \}\) : p\)\);/, 'an older redraw ends a pick whose save has not landed');
  assert.match(ear, /d\.shown === true \? \{ shown: true \} : \{ laid: false \}/, 'a still that could not be laid is treated as shown');
  // The Maker never imports the guest page's module (the message shape is a type on each side).
  assert.doesNotMatch(panel + read('lib/background-pick.ts'), /main-ground-preview'|editor-bridge'/);

  // THE BRIDGE: its own layer, hidden at rest; every message checked; the refresh inside a transition whose end
  // (the render committed) is the ONLY thing that takes the preview away.
  const bridge = read(`${G}/editor-bridge.tsx`);
  assert.match(bridge, /return <div ref=\{groundLayer\} data-main-ground-preview="" aria-hidden hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" \/>;/);
  const refresh = bridge.slice(bridge.indexOf("data.t === 'refresh'"), bridge.indexOf("data.t === 'mainGround'"));
  assert.match(refresh, /groundPreview\.current\?\.redrawStarted\(\);\s*startRedrawRef\.current\(\(\) => \{\s*routerRef\.current\.refresh\(\);\s*\}\);/, 'the page’s refresh is not the transition the preview waits on');
  const lay = bridge.slice(bridge.indexOf("data.t === 'mainGround'"), bridge.indexOf("data.t === 'sceneBg'"));
  assert.match(lay, /const preview = sanitizeMainGroundPreview\(data, origin\);\s*if \(preview\) groundPreview\.current\?\.lay\(preview\);/, 'a message is laid unchecked');
  assert.match(bridge, /if \(wasRedrawing\.current && !redrawing\) groundPreview\.current\?\.redrawDone\(\);/);
  assert.equal((bridge.match(/redrawDone\(\)/g) ?? []).length, 1, 'the preview is taken away somewhere other than at the end of the page’s own render');
  assert.match(bridge, /if \(event\.origin !== origin\) return;/);
  // The preview layer is the bridge's alone: the page's own grounds never carry its mark.
  for (const f of ['main-ground.tsx', 'guest-look-scope.tsx']) assert.doesNotMatch(read(`${G}/${f}`), /data-main-ground-preview/);
});
