/**
 * 🕯 THE CLOSING ("SEE YOU SOON") IS ITS OWN SCENE IN THE MAKER — owner 2026-10-17, DECISION_LOG "THE CLOSING ('SEE YOU
 * SOON') IS ITS OWN SCENE IN THE MAKER, WITH STYLE › ACCENT ◆ ▾ (NONE · OVAL FRAME)", verbatim: *"Make the closing (See
 * you soon) its own scene in the Maker, with Style › Accent ◆ ▾: None · Oval frame. Black and white photo is fine."*
 *
 * #6590 drew the closing (the couple's photo in the filigree oval, "See you soon.", the Narra Brown band, Powered by)
 * with NO scene in the Maker — so its oval followed the look's default and could not be taken off. This holds:
 *   1 · the closing is SELECTABLE: a part (`closing`, canvas `f:closing`) on every page of the four stages the shell
 *       draws, a fixed row the selection knows, a marker right before the footer, and a tap on the footer reaches the
 *       canvas's binder as `f:closing`;
 *   2 · its Style is ONE Accent ◆ ▾ offering only None · Oval frame — the same row and the same `scene_accents` map;
 *   3 · None draws NO oval, and still draws "See you soon." and the band on a kit look; the oval's photo is grey;
 *   4 · it is Pro: turning the oval on is Pro (◆ on the pill, priced at Apply), turning it off is free, and a guest
 *       without Event Hub Pro is drawn no kit at all.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ACCENT_NONE, SCENE_ACCENTS, accentsTurnOn, artKitView, resolvedAccent } from './art-kits';
import { MAKER_PARTS, MAKER_STAGE_PAGES, makerPartOfTap, makerPartToolWorks, type MakerStageKey } from './maker-parts';
import { MAKER_FIXED_LABEL } from './maker-scene-list';
import { fixedOfKey, selectionForCanvasKey } from './maker-selection';
import { eventItemIsPro } from './hub-draft';
import { RSVP_STAGE_KEY } from './rsvp-stage-shared';
import { KitClosing } from '../app/[slug]/_components/kit-piece';
import { createSectionBinder } from '../app/[slug]/_components/canvas-section-binder';
import { stripComments } from './strip-comments';

/* The pieces are JSX: under `tsx --test` it compiles to React.createElement (the house idiom). */
(globalThis as unknown as { React: unknown }).React = React;
const h = React.createElement;
const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
/** Comments out — a docblock quoting the code must not satisfy an anchor. */
const code = (p: string) => stripComments(read(p));

/* ── 1 · selectable ─────────────────────────────────────────────────────────────────────────────────────────────── */

test('1 · the closing is a part of every page the shell draws, a fixed row, and a tap on it selects it', () => {
  assert.equal(MAKER_PARTS.closing.canvas, 'f:closing', 'the Closing names no section on the canvas');
  /* 🕯 Since 2026-10-17 its LINE is a part (`el` 'closing', "allow styles on the see you soon") — and a tap anywhere
     else on the footer (the oval, the band) is still the Closing (the loop below asks with no `el`). */
  assert.equal(MAKER_PARTS.closing.el, 'closing', 'the Closing’s line is not a part of its own');
  assert.ok(MAKER_FIXED_LABEL.closing, 'the Closing is not a fixed row the Maker knows');
  assert.equal(fixedOfKey('f:closing'), 'closing');
  assert.deepEqual(selectionForCanvasKey('f:closing', []), { kind: 'row', key: 'f:closing' }, 'a tap on the closing selects nothing');
  assert.ok(makerPartToolWorks('closing', 'style'), 'the Closing’s Style is grey');

  /* Every page of the four stages the shell's footer sits under answers a tap on it — and the RSVP stage's own reply
     routes (no shell, no closing) never list it. */
  const stages = Object.keys(MAKER_STAGE_PAGES) as MakerStageKey[];
  for (const stage of stages) {
    for (const [page, parts] of Object.entries(MAKER_STAGE_PAGES[stage])) {
      if (stage === RSVP_STAGE_KEY) {
        assert.equal(parts.includes('closing'), false, `${stage} › ${page} lists a closing it does not draw`);
        continue;
      }
      assert.equal(parts.at(-1), 'closing', `${stage} › ${page}: the Closing is not this page's last part`);
      assert.equal(makerPartOfTap(stage, page, 'f:closing', null), 'closing', `${stage} › ${page}: a tap on the closing picks nothing`);
    }
  }

  /* The marker: site-body hands the shell `makerMark('f:closing')` (drawn on the Maker's canvas only), and the shell
     sets it IMMEDIATELY before the footer — the binder listens to the marker's next element. */
  assert.match(code('app/[slug]/_components/site-body.tsx'), /closingMark=\{makerMark\('f:closing'\)\}/);
  assert.match(code('app/[slug]/_components/invitation-shell.tsx'), /\{closingMark\}\s*\{kitClosing \? \(\s*<footer/);
});

test('1b · a tap on the footer reaches the canvas binder as the Closing (the binder of #6582, driven)', () => {
  /* A stand-in page: [cover] · <span hidden data-maker-section="f:closing"> · <footer>. */
  type Node = {
    tag: string;
    attrs: Map<string, string>;
    nextElementSibling: Node | null;
    parentElement: Node | null;
    isConnected: boolean;
    offsetHeight: number;
    getAttribute: (k: string) => string | null;
    hasAttribute: (k: string) => boolean;
    setAttribute: (k: string, v: string) => void;
    removeAttribute: (k: string) => void;
  };
  const node = (tag: string, attrs: Record<string, string> = {}): Node => {
    const n: Node = {
      tag,
      attrs: new Map(Object.entries(attrs)),
      nextElementSibling: null,
      parentElement: null,
      isConnected: true,
      offsetHeight: 10,
      getAttribute: (k) => n.attrs.get(k) ?? null,
      hasAttribute: (k) => n.attrs.has(k),
      setAttribute: (k, v) => void n.attrs.set(k, v),
      removeAttribute: (k) => void n.attrs.delete(k),
    };
    return n;
  };
  const cover = node('section');
  const marker = node('span', { hidden: '', 'data-maker-section': 'f:closing' });
  const footer = node('footer');
  const sign = node('p', { 'data-shell-sign-off': '' });
  sign.parentElement = footer;
  cover.nextElementSibling = marker;
  marker.nextElementSibling = footer;
  const all = [cover, marker, footer];
  const doc = {
    querySelectorAll: (sel: string) => (sel === '[data-maker-section]' ? all.filter((n) => n.hasAttribute('data-maker-section')) : []),
    querySelector: () => null,
    getElementById: () => null,
  };
  const g = globalThis as { CSS?: { escape: (s: string) => string } };
  g.CSS ??= { escape: (s: string) => s };
  const heard: string[] = [];
  const binder = createSectionBinder(doc as unknown as Document, (el, key) => {
    heard.push(`${(el as unknown as Node).tag}:${key}`);
    return () => {};
  });
  binder.sweep();
  assert.deepEqual(heard, ['footer:f:closing'], 'the binder did not listen to the footer as the Closing');
  assert.ok(binder.holds(sign as unknown as EventTarget), 'a tap on "See you soon." is a stray tap');
});

/* ── 2 · Style › Accent ◆ ▾: None · Oval frame ──────────────────────────────────────────────────────────────────── */

test('2 · the Closing’s Style is ONE Accent ▾ offering only None · Oval frame, on the scenes’ one map', () => {
  assert.deepEqual(
    SCENE_ACCENTS['sign-off'].map((o) => [o.id, o.label, o.pieces]),
    [['oval', 'Oval frame', ['closing-frame']]],
    'the Closing’s Accent offers more (or other) than the Oval frame',
  );
  /* The work area hands the selected Closing the scenes' own Accent row, scene `sign-off` — nothing else. */
  const shell = code('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.match(shell, /if \(fixed === 'closing'\) return accentRowFor\('sign-off'\);/);
  /* …and that row is the one `accent-row.tsx` (None first, then the scene's own options), written to `scene_accents`. */
  const row = code('app/dashboard/[eventId]/website/editor/_components/accent-row.tsx');
  assert.match(row, /\{ key: ACCENT_NONE, label: 'None' \},\s*\.\.\.options\.map/);
  assert.match(row, /const options = SCENE_ACCENTS\[scene\];/);
  assert.match(row, /style_preferences: \{ \[SCENE_ACCENTS_PREF_KEY\]: next \}/);
  /* The Vintage look starts the Closing ON; every other look starts it at None. */
  assert.equal(resolvedAccent('sign-off', {}, 'vintage'), 'oval');
  assert.equal(resolvedAccent('sign-off', {}, 'house'), ACCENT_NONE);
});

/* ── 3 · None draws no oval ─────────────────────────────────────────────────────────────────────────────────────── */

test('3 · None draws no oval — "See you soon." and the band stay on a kit look; the oval’s photo is black and white', () => {
  const base = { names: 'Maria & Jose', date: 'December 12, 2026', photoUrl: '/std/backgrounds/ballroom.webp', mark: 'M & J', twoPeople: true, hideWatermark: false };
  const on = artKitView({ theme: 'vintage', accents: {}, ownsPro: true, tryOn: false })!;
  const off = artKitView({ theme: 'vintage', accents: { 'sign-off': ACCENT_NONE }, ownsPro: true, tryOn: false })!;
  assert.ok(on && off, 'a Vintage page with Pro draws no kit');
  assert.equal(off.pieces.closing, undefined, 'None still names the oval');
  const drawnOn = renderToStaticMarkup(h(KitClosing, { ...base, kit: on }));
  const drawnOff = renderToStaticMarkup(h(KitClosing, { ...base, kit: off }));
  assert.equal((drawnOn.match(/data-kit-oval=""/g) ?? []).length, 1, 'the Oval frame drew no oval');
  assert.match(drawnOn, /closing-frame/);
  assert.match(drawnOn, /filter:grayscale\(1\)/, 'the photo in the oval is not black and white');
  assert.equal(drawnOff.includes('data-kit-oval'), false, 'None drew the oval');
  assert.equal(drawnOff.includes('closing-frame'), false, 'None drew the frame');
  assert.equal(drawnOff.includes('/std/backgrounds/ballroom.webp'), false, 'None drew the photo without its oval');
  assert.match(drawnOff, /data-shell-sign-off=""[^>]*>See you soon\.</, 'None dropped "See you soon."');
  assert.match(drawnOff, /data-kit-band=""/, 'None dropped the band');
  /* The page mounts the kit's closing on a kit look even at None (the band), and on any look whose Closing is on. */
  assert.match(code('app/[slug]/_components/site-body.tsx'), /kitClosing=\{\s*artKit && \(artKit\.look \|\| artKit\.pieces\.closing\?\.length\)\s*\?/);
});

/* ── 4 · Pro ────────────────────────────────────────────────────────────────────────────────────────────────────── */

test('4 · the Oval frame is Pro — on is priced, off is free, and a guest without Pro is drawn no kit', () => {
  assert.deepEqual(accentsTurnOn({}, { 'sign-off': 'oval' }, true), ['sign-off'], 'turning the oval on is not Pro');
  assert.deepEqual(accentsTurnOn({ 'sign-off': 'oval' }, { 'sign-off': ACCENT_NONE }, true), [], 'turning the oval off is Pro');
  assert.equal(eventItemIsPro('style_preferences', { scene_accents: { 'sign-off': 'oval' } }, 'change', {}), true, 'the draft does not price the oval');
  assert.equal(eventItemIsPro('style_preferences', { scene_accents: { 'sign-off': ACCENT_NONE } }, 'change', { scene_accents: { 'sign-off': 'oval' } }), false, 'the draft prices None');
  assert.equal(artKitView({ theme: 'house', accents: { 'sign-off': 'oval' }, ownsPro: false, tryOn: false, isPro: true }), null, 'a guest without Pro is drawn the oval');
  assert.ok(artKitView({ theme: 'house', accents: { 'sign-off': 'oval' }, ownsPro: false, tryOn: true, isPro: true })?.pieces.closing, 'the Maker cannot try the oval on');
  /* The pill wears ◆ while the couple has not got Event Hub Pro. */
  assert.match(code('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx'), /tryPro=\{ART_KIT_IS_PRO && !ownsPro\}/);
});
