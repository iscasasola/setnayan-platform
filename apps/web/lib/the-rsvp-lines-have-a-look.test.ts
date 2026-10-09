/**
 * the-rsvp-lines-have-a-look.test.ts — ON THE RSVP STAGE, STYLE IS THE PICKED LINE'S COLOUR AND SIZE, AND THE CARD IS
 * THE GROUP.
 *
 * Owner, on the live Maker's RSVP stage (2026-10-09, verbatim): "shouldn't it be per element?" · on the prototype:
 * "i like this idea. heading message then the whole group?" Controller's conditions for the stored look: absent =
 * today's look · every stored value from a fixed list, nothing typed ever reaches CSS · the same draft and Apply as
 * the words · no extra read for a guest · a save from an older panel must NOT drop it.
 *
 * Held here:
 *   1 · THE READER IS STRICT — only known lines, only listed values; a button line has no colour of its own.
 *   2 · THE RULES A PAGE DRAWS are built from the lists and the event's own colours, for the parts that page shows;
 *       a guest of an event with no look is served NOTHING (not an empty tag).
 *   3 · NO SAVE DROPS IT — the first-load sanitiser and every writer built on it carry `look` through, with keys
 *       this build does not know.
 *   4 · THE PANEL, rendered: Style on a text line is Colour (the event's five + the page's own) and Size; on a
 *       button, Size only; the group and Edit are untouched.
 *   5 · THE CEILING — a save that would not fit is refused in a sentence (words and looks alike), and an event
 *       already over it can still be made shorter.
 *   6 · THE CARD IS THE GROUP — a tap on the card's own paper picks the screen's group; the masthead's parts and
 *       the ground are as before; the group's frame goes round the card.
 *   7 · WIRING — the pages carry the one `<style>`, the canvas redraws it from the strict reader, the Maker sends it.
 *
 * Sabotages seen red (each restored): the sanitiser dropping `look` · the reader keeping a typed colour · the rules
 * written for a part the page does not show · a guest served an empty tag · a button given a colour · the ceiling
 * not asked · the card's paper letting go · the canvas trusting text it was sent.
 *
 * Lives in `lib/` because node's test glob does not descend into `[eventId]`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { sanitizeRsvpAskConfig } from './rsvp-ask';
import { rsvpAskConfigOnGoingPublic } from './going-public';
import { rsvpAskFreePart } from './hub-draft';
import { HUB_ELEMENT_SIZE_STEPS } from './element-style';
import { makerPartOfTap } from './maker-parts';
import { RSVP_STAGE_KEY, rsvpPreviewMessages, type RsvpStageScene } from './rsvp-stage';
import {
  RSVP_CONFIG_FULL,
  RSVP_CONFIG_ROOM,
  RSVP_LOOK_BUTTON_LINES,
  RSVP_LOOK_LINES,
  RSVP_LOOK_MESSAGE,
  RSVP_LOOK_SIZES,
  RSVP_LOOK_SLOTS,
  RSVP_LOOK_STYLE_ATTR,
  readRsvpLook,
  rsvpConfigBytes,
  rsvpConfigFits,
  RSVP_CARD_GROUNDS,
  RSVP_CARD_SELECTOR,
  RSVP_LOOK_CARDS,
  RSVP_LOOK_FEELS,
  rsvpLookCard,
  RSVP_INNER_CARD_SELECTOR,
  rsvpLookCss,
  rsvpLookLine,
  rsvpLookRules,
  rsvpLookWith,
} from './rsvp-look';
import { FEEL_SECONDS } from './animate-feel';
import { RSVP_OPEN_CARD_EVENT } from './rsvp-stage-shared';
import {
  RSVP_CANVAS_HERO,
  RSVP_CANVAS_SECTIONS,
  RSVP_CARD_ATTR,
  RSVP_CARD_GROUPS,
  RSVP_CARD_NAME,
  RSVP_SECTION_LINES,
  rsvpPartOfTap,
  stampRsvpCanvas,
} from '../app/[slug]/_components/rsvp-canvas-parts';

(globalThis as { React?: typeof React }).React = React;
/* The RSVP settings import the draft action, whose module is `server-only`: stubbed for this render, as
   `details-words-and-plans.test.ts` does. */
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const BOARD = ['#5b1a22', '#6B7A3A', '#e0a52b', '#8e2e3c', '#f2c8c2'];
/** Every rule the builder may ever write: a named line or the card, a checked colour, numbers, and its own fixed
 *  words (the Event Hub's motion frame, the app's glass). Nothing else — said as ONE pattern the output must fit. */
const MOVES = String.raw`(--rl-o:[01];--rl-t:translate3d\(-?\d+px, -?\d+px, 0\) scale\([0-9.]+\);--rl-f:(none|blur\(8px\));animation:rsvp-in [0-9.]+s cubic-bezier\(\.16,1,\.3,1\) both;)?`;
const GROUNDS = String.raw`(background:transparent!important;border-color:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;|background:var\(--sn-glass-bg\)!important;border-color:var\(--sn-glass-line\)!important;backdrop-filter:var\(--sn-glass-blur\)!important;-webkit-backdrop-filter:var\(--sn-glass-blur\)!important;)?`;
const TAIL = String.raw`(@keyframes rsvp-in\{from\{opacity:var\(--rl-o\);transform:var\(--rl-t\);filter:var\(--rl-f\)\}\}@media \(prefers-reduced-motion:reduce\)\{\[data-rsvp-line\],div:has\(>\[data-door-header\]\)\{animation:none!important\}\})?`;
const INNER = String.raw`(\[data-landing-missed\]\{background:transparent!important;border-color:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;\})?`;
const SAFE_CSS = new RegExp(String.raw`^(div:has\(>\[data-door-header\]\)\{${GROUNDS}${MOVES}\})?${INNER}(\[data-rsvp-line="[a-z]+"\]\[data-rsvp-line\]\{(color:#[0-9a-f]{6};)?(zoom:[0-9.]+;)?${MOVES}\})*${TAIL}$`);

test('1 · the reader is strict: known lines, listed values, and no colour of its own for a button', () => {
  /* The lines are the stage's lines — said from the page's own list, not from the module under test. */
  const parts = (Object.keys(RSVP_CANVAS_SECTIONS) as RsvpStageScene[]).flatMap((screen) =>
    (RSVP_CANVAS_SECTIONS[screen] as readonly string[]).flatMap((section) => (RSVP_SECTION_LINES[section] ?? []).map((line) => `${makerPartOfTap(RSVP_STAGE_KEY, screen, section, null)}.${line}`)),
  );
  assert.deepEqual([...RSVP_LOOK_LINES].sort(), [...parts].sort(), 'a line has no look, or a look names no line');
  assert.deepEqual([...RSVP_LOOK_BUTTON_LINES], ['rsvp.yes', 'rsvp.no', 'pass.save']);
  for (const s of RSVP_LOOK_SIZES) assert.ok((HUB_ELEMENT_SIZE_STEPS as readonly number[]).includes(s), `${s}% is not one of the Event Hub’s sizes`);
  assert.deepEqual([...RSVP_LOOK_SLOTS], [1, 2, 3, 4, 5]);
  assert.equal(rsvpLookLine('rsvp', 'question'), 'rsvp.question');
  assert.equal(rsvpLookLine('rsvp', 'heading'), null);
  assert.equal(rsvpLookLine(null, 'question'), null);

  const read = readRsvpLook({
    look: {
      lines: {
        'rsvp.question': { c: 2, s: 120 },
        'rsvp.eyebrow': { c: '#ff0000', s: '120' } /* typed, not listed */,
        'rsvp.hint': { c: 9, s: 500 },
        'rsvp.yes': { c: 3, s: 110 } /* a button: size only */,
        'yesnote.heading': { s: 100 } /* its own size: nothing to keep */,
        'nonote.message': { c: 'red;}body{display:none', s: 85 },
        'rsvp.title': { c: 1 } /* no such line */,
        '__proto__': { c: 1 },
      },
    },
  });
  assert.deepEqual(read, { lines: { 'rsvp.question': { c: 2, s: 120 }, 'rsvp.yes': { s: 110 }, 'nonote.message': { s: 85 } } });
  /* Absent, wrong-shaped, or empty: no look at all. */
  for (const raw of [null, undefined, 'x', [], {}, { look: null }, { look: [] }, { look: { lines: [] } }, { look: { lines: { 'rsvp.question': 'big' } } }]) assert.deepEqual(readRsvpLook(raw), {});
});

test('2 · the rules a page draws: its own parts only, the event’s colours only, nothing for a guest with no look', async () => {
  const look = readRsvpLook({ look: { lines: { 'rsvp.question': { c: 2, s: 120 }, 'rsvp.yes': { s: 110 }, 'yesnote.heading': { c: 1 }, 'nonote.heading': { c: 5, s: 85 }, 'pass.save': { s: 92 } } } });
  assert.equal(rsvpLookCss(look, ['rsvp'], BOARD), '[data-rsvp-line="question"][data-rsvp-line]{color:#6b7a3a;zoom:1.2;}[data-rsvp-line="yes"][data-rsvp-line]{zoom:1.1;}');
  /* When yes and When no both have a "heading": each page writes only ITS parts' rules. */
  assert.equal(rsvpLookCss(look, ['yesnote', 'pass'], BOARD), '[data-rsvp-line="heading"][data-rsvp-line]{color:#5b1a22;}[data-rsvp-line="save"][data-rsvp-line]{zoom:0.92;}');
  assert.equal(rsvpLookCss(look, ['nonote'], BOARD), '[data-rsvp-line="heading"][data-rsvp-line]{color:#f2c8c2;zoom:0.85;}');
  /* A slot the event's colours do not hold, or a "colour" that is not one: no colour is written. */
  assert.equal(rsvpLookCss(look, ['nonote'], BOARD.slice(0, 2)), '[data-rsvp-line="heading"][data-rsvp-line]{zoom:0.85;}');
  assert.equal(rsvpLookCss(look, ['yesnote'], ['red;}body{display:none}', '#123']), '');
  for (const parts of [['rsvp'], ['yesnote', 'pass'], ['nonote'], []]) assert.match(rsvpLookCss(look, parts, BOARD), SAFE_CSS);
  assert.equal(rsvpLookCss({}, ['rsvp'], BOARD), '');

  /* THE TAG, rendered. A guest of an event with no look is served nothing at all; the Maker's canvas always has the
     tag (with the event's colours on it), so a look picked in the panel has somewhere to be drawn. */
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RsvpLookStyle } = await import('../app/[slug]/_components/rsvp-look-style');
  const tag = (config: unknown, canvas: boolean) => renderToStaticMarkup(React.createElement(RsvpLookStyle, { config, board: BOARD, parts: ['rsvp'], canvas }));
  assert.equal(tag({ words: { question: 'Coming?' } }, false), '');
  assert.equal(tag(null, false), '');
  assert.equal(tag({ look: { lines: { 'rsvp.question': { s: 120 } } } }, false), `<style ${RSVP_LOOK_STYLE_ATTR}="rsvp">[data-rsvp-line=&quot;question&quot;][data-rsvp-line]{zoom:1.2;}</style>`.replace(/&quot;/g, '"'));
  assert.match(tag(null, true), new RegExp(`^<style ${RSVP_LOOK_STYLE_ATTR}="rsvp" data-rsvp-board="#5b1a22 #6B7A3A #e0a52b #8e2e3c #f2c8c2"></style>$`));
});

test('3 · no save drops it: the sanitiser and every writer built on it carry `look`, unknown keys and all', () => {
  const look = { lines: { 'rsvp.question': { c: 2, s: 120 } }, groups: [['question', 'hint']], order: { form: ['hint', 'question'] } };
  const stored = { words: { attending: 'Count me in' }, meal: false, oneAtATime: true, look };
  /* The first-load sanitiser (the draft's save and its publish run every config through it). */
  assert.deepEqual(sanitizeRsvpAskConfig(stored).look, look);
  /* The public-listing switch rewrites the object from the sanitised one. */
  assert.deepEqual(rsvpAskConfigOnGoingPublic({ previousVisibility: 'unlisted', nextVisibility: 'public', rawConfig: stored })?.look, look);
  /* The Pro check splits the draft into its free part — the look is in it. */
  assert.deepEqual(rsvpAskFreePart({}, stored).look, look);
  /* A shape that is not an object is not carried. */
  for (const bad of ['x', 3, null, [1], true]) assert.equal(sanitizeRsvpAskConfig({ look: bad }).look, undefined);
  /* THE OTHER WRITERS build on the sanitised object and spread their own patch over it: the two panels' saves. */
  for (const file of [`${L}/maker-rsvp-ask.tsx`, 'app/dashboard/[eventId]/_components/guest-setup/guest-setup-rows.tsx']) {
    assert.match(src(file), /const next: RsvpAskConfig = \{ \.\.\.latest\.current, \.\.\.patch \};/, `${file} rebuilds the object some other way`);
  }
  /* The panel's own change keeps what it does not know, and an event back to its own look stores no `look`. */
  assert.deepEqual(rsvpLookWith(stored, 'rsvp.hint', { s: 85 }), { ...look, lines: { 'rsvp.question': { c: 2, s: 120 }, 'rsvp.hint': { s: 85 } } });
  assert.deepEqual(rsvpLookWith(stored, 'rsvp.question', { c: null }), { ...look, lines: { 'rsvp.question': { s: 120 } } });
  assert.deepEqual(rsvpLookWith(stored, 'rsvp.question', { c: null, s: 100 }), { groups: look.groups, order: look.order });
  assert.equal(rsvpLookWith({ look: { lines: { 'rsvp.question': { s: 120 } } } }, 'rsvp.question', { s: null }), undefined);
  assert.equal(rsvpLookWith({}, 'rsvp.question', { c: null }), undefined);
});

/** The stage's panel, drawn for a picked line and tool. */
async function panel(scene: RsvpStageScene, picked: { tool: string; part: string | null; line: string | null }, current: Record<string, unknown> = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerRsvpSettings } = await import(`../${L}/maker-rsvp-ask`);
  return renderToStaticMarkup(
    React.createElement(MakerRsvpSettings as React.FC<Record<string, unknown>>, {
      eventId: 'e-1',
      current,
      drafted: false,
      replyBy: { date: '2026-11-18', isDefault: false },
      replyByOwn: { deadline: '2026-11-18', pricingMode: 'final_only' },
      requests: { count: null, list: null },
      scene,
      picked,
      celebration: { ownsPro: false, storeShell: false, colours: BOARD },
    }),
  );
}

test('4 · the panel: Style on a text line is Colour (the event’s five + the page’s own) and Size; a button has Size only', async () => {
  const colours = (html: string) => [...html.matchAll(/data-rsvp-look-colour="(\w+)"/g)].map((m) => m[1]);
  const text = await panel('form', { tool: 'style', part: 'rsvp', line: 'question' }, { look: { lines: { 'rsvp.question': { c: 2, s: 120 } } } });
  assert.match(text, /data-rsvp-stage-line-style="rsvp\.question"/);
  assert.deepEqual(colours(text), ['own', '1', '2', '3', '4', '5']);
  assert.match(text, /<button type="button" aria-pressed="true"[^>]*data-rsvp-look-colour="2"/, 'the stored colour is not the one shown picked');
  assert.match(text, /<button type="button" aria-pressed="false"[^>]*data-rsvp-look-colour="own"/);
  assert.match(text, /data-rsvp-line-look-row="size"[\s\S]*120%/);
  assert.doesNotMatch(text, /data-rsvp-word-field|data-rsvp-setting=/, 'Style on a line draws the words or the settings too');
  /* No look yet: the page's own colour is the one picked, at 100%. */
  const fresh = await panel('thanks', { tool: 'style', part: 'yesnote', line: 'message' });
  assert.match(fresh, /aria-pressed="true"[^>]*data-rsvp-look-colour="own"/);
  assert.match(fresh, /100%/);
  /* A BUTTON — the two answers and the pass's Save: Size, and no colour of its own. */
  for (const [scene, part, line] of [['form', 'rsvp', 'yes'], ['form', 'rsvp', 'no'], ['thanks', 'pass', 'save']] as const) {
    const html = await panel(scene, { tool: 'style', part, line });
    assert.deepEqual(colours(html), [], `${line} offers a colour`);
    assert.match(html, /data-rsvp-line-look-row="size"/);
    assert.match(html, /data-rsvp-line-look-row="button-note"/);
  }
  /* Every line has a Style; the group and Edit are not this. */
  for (const id of RSVP_LOOK_LINES) {
    const [part, line] = id.split('.') as [string, string];
    const scene: RsvpStageScene = part === 'rsvp' ? 'form' : part === 'nonote' ? 'decline' : 'thanks';
    assert.match(await panel(scene, { tool: 'style', part, line }), new RegExp(`data-rsvp-line-look="${id.replace('.', '\\.')}"`), `${id} has no Style`);
  }
  assert.doesNotMatch(await panel('form', { tool: 'style', part: 'rsvp', line: null }), /data-rsvp-line-look/);
  assert.doesNotMatch(await panel('form', { tool: 'edit', part: 'rsvp', line: 'question' }), /data-rsvp-line-look/);
  /* The controls are the shipped ones (the cover line's row), not a new kit. */
  const ROWS = src(`${L}/rsvp-line-look.tsx`);
  assert.match(ROWS, /import \{ Swatch \} from '\.\/stage-panel\/kit';/);
  assert.match(ROWS, /import \{ SLIDER_VALUE, Slider \} from '@\/app\/_components\/slider';/);
  assert.doesNotMatch(ROWS, /ColourSheet|ColourWell|type="color"|<input/, 'a colour can be typed or picked freely');
});

test('5 · the ceiling: a save that would not fit is refused in a sentence — and what is already kept can still shrink', () => {
  assert.ok(RSVP_CONFIG_ROOM < 2048, 'the app’s limit is not under the database’s');
  const small = { words: { question: 'Coming?' } };
  const big = { words: { thanksMessage: '🎉'.repeat(240), declineMessage: '🎉'.repeat(240) } };
  assert.ok(rsvpConfigBytes(big) > RSVP_CONFIG_ROOM, 'the fixture does not pass the limit');
  assert.equal(rsvpConfigFits(small), true);
  assert.equal(rsvpConfigFits(big), false);
  assert.equal(rsvpConfigFits(big, small), false, 'a save that grows past the limit is taken');
  /* Already over (kept before the limit was asked): shorter or equal is always taken, longer is not. */
  const shorter = { words: { thanksMessage: '🎉'.repeat(240), declineMessage: '🎉'.repeat(239) } };
  assert.equal(rsvpConfigFits(shorter, big), true);
  assert.equal(rsvpConfigFits(big, big), true);
  assert.equal(rsvpConfigFits({ ...big, meal: false }, big), false);
  assert.match(RSVP_CONFIG_FULL, /too long/);
  /* THE SAVE asks before anything is shown or kept — one place, so the words and the looks both pass through it. */
  const PANEL = src(`${L}/maker-rsvp-ask.tsx`);
  assert.match(
    PANEL,
    /const next: RsvpAskConfig = \{ \.\.\.latest\.current, \.\.\.patch \};\s*if \(!rsvpConfigFits\(next, latest\.current\)\) \{\s*setError\(said \? null : RSVP_CONFIG_FULL\);\s*return Promise\.resolve\(\{ ok: false, error: RSVP_CONFIG_FULL \}\);\s*\}\s*latest\.current = next;/,
  );
  assert.match(PANEL, /void save\(\{ look: rsvpLookWith\(latest\.current, lookLine, patch\) \}, 'c' in patch \? '“Colour”' : '“Size”'\);/);
});

/* ── the fake page (the shapes `rsvp-canvas-parts.ts` asks for) ─────────────────────────────────────────────────── */
type Fake = {
  tagName: string;
  className: string;
  attrs: Record<string, string>;
  children: Fake[];
  parentElement: Fake | null;
  hidden: boolean;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  readonly previousElementSibling: Fake | null;
  querySelector(sel: string): Fake | null;
  insertBefore(child: Fake, before: Fake): Fake;
};
function el(tag: string, attrs: Record<string, string> = {}, children: Fake[] = []): Fake {
  const node: Fake = {
    tagName: tag.toUpperCase(),
    className: attrs.class ?? '',
    attrs: { ...attrs },
    children: [],
    parentElement: null,
    hidden: false,
    getAttribute: (name) => (name in node.attrs ? node.attrs[name]! : null),
    setAttribute: (name, value) => {
      node.attrs[name] = value;
    },
    get previousElementSibling() {
      const sibs = node.parentElement?.children ?? [];
      const i = sibs.indexOf(node);
      return i > 0 ? sibs[i - 1]! : null;
    },
    querySelector: (sel) => find(node, sel),
    insertBefore: (child, before) => {
      child.parentElement = node;
      node.children.splice(node.children.indexOf(before), 0, child);
      return child;
    },
  };
  for (const c of children) {
    c.parentElement = node;
    node.children.push(c);
  }
  return node;
}
function find(root: Fake, sel: string): Fake | null {
  const child = / > \*$/.test(sel);
  const m = /^\[([\w-]+)(?:="([^"]*)")?\]/.exec(sel);
  if (!m) throw new Error(`the fake page cannot answer ${sel}`);
  const walk = (n: Fake): Fake | null => {
    for (const c of n.children) {
      const v = c.getAttribute(m[1]!);
      if (v !== null && (m[2] === undefined || v === m[2])) return child ? (c.children[0] ?? null) : c;
      const deep = walk(c);
      if (deep) return deep;
    }
    return null;
  };
  return walk(root);
}
/** A reply door as `DoorShell` draws it, with one group of lines in its body — then stamped as the canvas does. */
function door(group: string) {
  const line = el('p', { 'data-rsvp-line': group === 'f:rsvp' ? 'question' : 'heading' });
  const section = el('div', {}, [line]);
  const open = el('a', { href: '/x' });
  const under = el('div', { 'data-landing': 'open' }, [open]);
  const body = el('div', {}, [el('span', { 'data-maker-section': group }), section, under]);
  const names = el('h1');
  const header = el('header', { 'data-door-header': '' }, [el('p'), names]);
  const card = el('div', {}, [el('div', { 'aria-hidden': 'true' }, [el('div', { 'data-door-mark': 'logo' }, [el('span')])]), header, body]);
  const ground = el('div', {}, [card, el('p', { 'data-door-made-with': '' })]);
  const doc = { root: el('main', {}, [ground]), querySelector: (sel: string) => find(doc.root, sel), createElement: (tag: string) => el(tag) };
  stampRsvpCanvas(doc as never);
  return { card, body, header, names, section, line, ground, under, open };
}

test('6 · the card is the group: its own paper picks the screen’s group; the masthead’s parts and the ground are as before', () => {
  assert.deepEqual([...RSVP_CARD_GROUPS], ['f:rsvp', 'f:yesnote', 'f:nonote']);
  for (const group of RSVP_CARD_GROUPS) {
    const s = door(group);
    assert.equal(s.card.getAttribute(RSVP_CARD_ATTR), '', 'the canvas does not name the card');
    /* The card's edge, the paper of its body, the masthead's own paper: the group, with no line. */
    for (const paper of [s.card, s.body, s.header]) assert.deepEqual(rsvpPartOfTap(paper), { key: group, el: null, word: null, line: null }, `${group}: the card’s paper lets go`);
    /* A part of the masthead is still itself, a line still its line, and the group's section still the group. */
    assert.deepEqual(rsvpPartOfTap(s.names), { key: RSVP_CANVAS_HERO, el: 'names', word: null, line: null });
    assert.equal(rsvpPartOfTap(s.line)?.line, group === 'f:rsvp' ? 'question' : 'heading');
    assert.deepEqual(rsvpPartOfTap(s.section), { key: group, el: null, word: null, line: null });
    /* Outside the card — the page's ground, the made-with line — nothing is picked: a tap there lets go. And a
       thing INSIDE the card that is no part (a button under the note) is still the ground, as before. */
    assert.equal(rsvpPartOfTap(s.ground), null);
    assert.equal(rsvpPartOfTap(s.under), null, 'a button under the lines picked the group');
    assert.equal(rsvpPartOfTap(s.open), null);
  }
  /* A card that holds no group (a door of another kind) picks nothing from its paper. */
  const bare = door('f:greeting');
  assert.equal(rsvpPartOfTap(bare.card), null);
  /* THE FRAME of a group goes round the card it sits in; a line's stays on the line. */
  const EDGES = src(`${L}/add-part-sheet.tsx`);
  assert.match(
    EDGES,
    /if \(node && el\) node = node\.querySelector\([\s\S]{0,120}?\) \?\? node;\s*else if \(node && \(RSVP_CARD_GROUPS as readonly string\[\]\)\.includes\(canvas\)\) node = node\.closest\(`\[\$\{RSVP_CARD_ATTR\}\]`\) \?\? node;/,
  );
});

test('7 · WIRING: the pages carry the one <style>, the canvas redraws it from the strict reader, the Maker sends it', () => {
  const REPLY = src('app/[slug]/invite/reply/page.tsx');
  const ENTER = src('app/[slug]/invite/enter/page.tsx');
  assert.match(REPLY, /const RSVP_FORM_PARTS = \['rsvp'\] as const;/);
  assert.match(ENTER, /const RSVP_YES_PARTS = \['yesnote', 'pass'\] as const;\s*const RSVP_NO_PARTS = \['nonote'\] as const;/);
  const mount = /<RsvpLookStyle\s+config=\{event\.rsvp_ask_config\}\s+board=\{celebrationColours\(boardSwatches\(\(event as \{ role_palette\?: unknown \}\)\.role_palette\)\)\}\s+parts=\{([^}]+)\}\s+canvas=\{canvas\}\s*\/>/;
  assert.equal(mount.exec(REPLY)?.[1], 'RSVP_FORM_PARTS');
  assert.equal(mount.exec(ENTER)?.[1], "reply === 'no' ? RSVP_NO_PARTS : RSVP_YES_PARTS");
  /* NO EXTRA READ: the colours ride the event row each page already selects. */
  assert.match(REPLY, /\.select\(\s*`[^`]*\brole_palette, rsvp_ask_config,[^`]*`/);
  assert.equal((REPLY.match(/\.from\('events'\)/g) ?? []).length, (src('app/[slug]/invite/reply/page.tsx').match(/\.from\('events'\)/g) ?? []).length);
  /* The Maker's swatches are the same list (`celebration.colours`, `launch/page.tsx`). */
  assert.match(src('app/dashboard/[eventId]/launch/page.tsx'), /colours: celebrationColours\(boardSwatches\(printEvent\.role_palette\)\)/);
  assert.match(src(`${L}/maker-rsvp-ask.tsx`), /board=\{celebration\?\.colours \?\? \[\]\}/);
  /* THE CANVAS: the tag is rebuilt by the strict reader from the colours the PAGE carries — never from sent text. */
  const BRIDGE = src('app/[slug]/_components/rsvp-canvas-bridge.tsx');
  assert.match(
    BRIDGE,
    /if \(d\.t === RSVP_LOOK_MESSAGE\) \{\s*const look = d\.look;\s*void import\('@\/lib\/rsvp-look'\)\.then\(\(\{ readRsvpLook, rsvpLookCss, rsvpLookRules \}\) => \{\s*document\.querySelectorAll<HTMLElement>\(`style\[\$\{RSVP_LOOK_STYLE_ATTR\}\]`\)\.forEach\(\(el\) => \{\s*const read = readRsvpLook\(\{ look \}\);\s*const parts = \(el\.getAttribute\(RSVP_LOOK_STYLE_ATTR\) \?\? ''\)\.split\(' '\);\s*const board = \(el\.dataset\.rsvpBoard \?\? ''\)\.split\(' '\);\s*const css = rsvpLookCss\(read, parts, board\);/,
  );
  /* …and a GUEST'S BUNDLE NEVER CARRIES THE READER: the bridge rides the reply card's own client code, so it reaches
     the reader only by the import above (on that message) — its static imports hold the two names alone. */
  assert.doesNotMatch(BRIDGE, /^import [^;]*from '@\/lib\/rsvp-look';/m, 'the reader is in every guest’s reply-page bundle');
  assert.match(BRIDGE, /import \{ RSVP_BRIDGE_SOURCE, RSVP_LOOK_MESSAGE, RSVP_LOOK_STYLE_ATTR, RSVP_SITE_SOURCE \} from '@\/lib\/rsvp-stage-shared';/);
  /* THE MAKER sends the look with every preview (and when a frame says it is ready). */
  const sent = rsvpPreviewMessages({ look: { lines: { 'rsvp.question': { s: 120 } } } }, false).filter((m) => m.t === RSVP_LOOK_MESSAGE);
  assert.deepEqual(sent, [{ source: 'setnayan-editor', t: 'rsvpLook', look: { lines: { 'rsvp.question': { s: 120 } } } }]);
  assert.deepEqual(rsvpPreviewMessages({}, false).filter((m) => m.t === RSVP_LOOK_MESSAGE), [{ source: 'setnayan-editor', t: 'rsvpLook', look: {} }], 'a look taken away is never told to the page');
});

/* ══ 8–10 · THE CARD IS A BLOCK, AND EVERYTHING ARRIVES ═══════════════════════════════════════════════════════════
   Owner (2026-10-09): "RSVP background not working." · "how come background not fixed and no animate?" — and his
   rule the same day: "there should always be animate and background?" → Animate for every element, Background for
   every block. The approved prototype (`public/review/rsvp-per-element.html`): the card's Background is None · Plain
   · Frosted; a line says "This sits on the RSVP card’s background." with "Open the card".
   Sabotages seen red (each restored): a made-up ground kept · a feel with no effect kept · the card's rule written
   on another screen's page · Plain storing a key · Action / Build out offered on a reply line · Background still
   grey on the card · "Open the card" unheard · the group still called by its part's name. */

test('8 · the card’s ground and every Build in are read strictly, and drawn with fixed words only', () => {
  assert.deepEqual([...RSVP_LOOK_CARDS], RSVP_CARD_GROUPS.map((k) => k.slice(2)), 'a card has no look, or a look names no card');
  assert.deepEqual([...RSVP_CARD_GROUNDS], ['none', 'frost']);
  assert.deepEqual([...RSVP_LOOK_FEELS], ['quick', 'cinematic']);
  assert.equal(rsvpLookCard('rsvp'), 'rsvp');
  assert.equal(rsvpLookCard('pass'), null);
  const read = readRsvpLook({
    look: {
      card: {
        rsvp: { g: 'frost', i: { fade: true, move: 'below' }, v: 'cinematic' },
        yesnote: { g: 'plain' } /* Plain is the absence of the key */,
        nonote: { g: 'url(x)', i: { fade: 'yes', move: 'sideways', size: 'huge' }, v: 'quick' } /* nothing listed: nothing kept — not even the feel */,
        pass: { g: 'none' } /* no such card */,
      },
      lines: { 'rsvp.hint': { i: { blur: true, size: 'grow', wobble: true }, v: 'slow' }, 'rsvp.yes': { v: 'quick' } },
    },
  });
  assert.deepEqual(read, { lines: { 'rsvp.hint': { i: { size: 'grow', blur: true } } }, card: { rsvp: { g: 'frost', i: { fade: true, move: 'below' }, v: 'cinematic' } } });

  /* DRAWN: the card by the block that holds the masthead (no attribute is served for it), each page its own card. */
  assert.equal(RSVP_CARD_SELECTOR, 'div:has(>[data-door-header])');
  const form = rsvpLookCss(read, ['rsvp'], BOARD);
  assert.match(form, /^div:has\(>\[data-door-header\]\)\{background:var\(--sn-glass-bg\)!important;[^}]*animation:rsvp-in 1\.8s cubic-bezier\(\.16,1,\.3,1\) both;\}/);
  assert.match(form, /--rl-o:0;--rl-t:translate3d\(0px, 24px, 0\) scale\(1\);--rl-f:none;/, 'Fade + Move from below is not the Event Hub’s own frame');
  assert.match(form, /\[data-rsvp-line="hint"\]\[data-rsvp-line\]\{--rl-o:1;--rl-t:translate3d\(0px, 0px, 0\) scale\(0\.85\);--rl-f:blur\(8px\);animation:rsvp-in 1\.1s /, 'Calm is not the feel a line arrives with');
  assert.equal(FEEL_SECONDS.calm, 1.1);
  /* ONE keyframe, and it stands still for a guest who asked for less motion. */
  assert.equal((form.match(/@keyframes rsvp-in/g) ?? []).length, 1);
  assert.match(form, /@media \(prefers-reduced-motion:reduce\)\{\[data-rsvp-line\],div:has\(>\[data-door-header\]\)\{animation:none!important\}\}$/);
  /* Another screen's page writes none of it; a look with no motion writes no keyframe. */
  assert.equal(rsvpLookCss(read, ['yesnote', 'pass'], BOARD), '');
  assert.doesNotMatch(rsvpLookCss(readRsvpLook({ look: { card: { nonote: { g: 'none' } } } }), ['nonote'], BOARD), /keyframes/);
  assert.match(rsvpLookCss(readRsvpLook({ look: { card: { nonote: { g: 'none' } } } }), ['nonote'], BOARD), /^div:has\(>\[data-door-header\]\)\{background:transparent!important;/);
  for (const parts of [['rsvp'], ['yesnote', 'pass'], ['nonote']]) assert.match(rsvpLookCss(read, parts, BOARD), SAFE_CSS);

  /* SAVED: Plain stores nothing; a feel is kept only with an effect; the other home is never touched. */
  const stored = { look: { lines: { 'rsvp.hint': { s: 85 } } } };
  assert.deepEqual(rsvpLookWith(stored, { card: 'rsvp' }, { g: 'frost' }), { lines: { 'rsvp.hint': { s: 85 } }, card: { rsvp: { g: 'frost' } } });
  assert.deepEqual(rsvpLookWith({ look: { card: { rsvp: { g: 'frost' } } } }, { card: 'rsvp' }, { g: null }), undefined);
  assert.deepEqual(rsvpLookWith(stored, 'rsvp.hint', { i: { fade: true }, v: 'quick' }), { lines: { 'rsvp.hint': { s: 85, i: { fade: true }, v: 'quick' } } });
  assert.deepEqual(rsvpLookWith({ look: { lines: { 'rsvp.hint': { i: { fade: true }, v: 'quick' } } } }, 'rsvp.hint', { i: null }), undefined, 'a feel is kept with nothing to time');
  assert.deepEqual(rsvpLookWith(stored, 'rsvp.hint', { v: 'quick' }), { lines: { 'rsvp.hint': { s: 85 } } });
});

test('9 · the panel: the card’s Background is None · Plain · Frosted; a line says whose it sits on; Animate is a Build in', async () => {
  const tiles = (html: string) => [...html.matchAll(/<button type="button" aria-pressed="(true|false)" aria-label="([^"]+)" data-rsvp-card-tile="(\w+)"/g)].map((m) => `${m[3]}:${m[2]}:${m[1]}`);
  for (const [scene, part] of [['form', 'rsvp'], ['thanks', 'yesnote'], ['decline', 'nonote']] as const) {
    const plain = await panel(scene, { tool: 'bg', part, line: null });
    assert.deepEqual(tiles(plain), ['none:None:false', 'plain:Plain:true', 'frost:Frosted:false'], `${scene}: the card’s three grounds`);
    assert.match(plain, /Behind the card is the Look’s background — the same one every page wears\./);
    assert.match(plain, new RegExp(`data-rsvp-stage-card-ground="${part}"`));
    const frost = await panel(scene, { tool: 'bg', part, line: null }, { look: { card: { [part]: { g: 'frost' } } } });
    assert.deepEqual(tiles(frost), ['none:None:false', 'plain:Plain:false', 'frost:Frosted:true']);
  }
  /* A LINE has no ground of its own — one line and the one button, never tiles (and the pass's Save button too). */
  for (const [scene, part, line] of [['form', 'rsvp', 'question'], ['form', 'rsvp', 'yes'], ['thanks', 'yesnote', 'heading'], ['thanks', 'pass', 'save'], ['decline', 'nonote', 'message']] as const) {
    const html = await panel(scene, { tool: 'bg', part, line });
    assert.deepEqual(tiles(html), [], `${line}: a line was given grounds`);
    assert.match(html, /This sits on the RSVP card’s background\./);
    assert.match(html, /data-rsvp-open-card=""[\s\S]*Open the card/);
  }
  /* ANIMATE — the toolbar's own Animate, on its Build in only: the four effects, and Movement. No Action, no Build
     out (a reply page is one screen with no exit) — not drawn dead, not drawn at all. */
  for (const [scene, part, line] of [['form', 'rsvp', 'question'], ['form', 'rsvp', null], ['thanks', 'pass', 'save'], ['decline', 'nonote', null]] as const) {
    const html = await panel(scene, { tool: 'animate', part, line }, { look: { lines: { 'rsvp.question': { i: { fade: true, move: 'below' }, v: 'quick' } } } });
    assert.match(html, /data-stage-animate-rows=""/, `${part}.${line}: not the toolbar’s Animate`);
    assert.deepEqual([...html.matchAll(/>(Fade|Blur|Move|Size)</g)].map((m) => m[1]), ['Fade', 'Blur', 'Move', 'Size']);
    assert.doesNotMatch(html, />Action<|>Build out</, 'a phase a reply page cannot play is offered');
    assert.doesNotMatch(html, />Build in</, 'row 1 is still drawn: a one-of-one choice');
    assert.match(html, /!grid-rows-\[0px_repeat\(3,var\(--sp-rh\)\)\]/, 'the rows do not start from the top');
    assert.match(html, /Movement/);
    assert.doesNotMatch(html, /data-rsvp-word-field|data-rsvp-setting=|data-rsvp-look-colour/);
  }
  const moving = await panel('form', { tool: 'animate', part: 'rsvp', line: 'question' }, { look: { lines: { 'rsvp.question': { i: { fade: true, move: 'below' }, v: 'quick' } } } });
  assert.match(moving, /data-stage-need="move"/, 'Move is on and its side is not offered');
  assert.match(moving, />Quick</);
});

test('10 · WIRING: Background and Animate are live on a reply card and its lines; the group is "Card"; "Open the card" is heard', () => {
  const TOOLS = src(`${L}/stage-tools.tsx`);
  assert.equal(RSVP_CARD_NAME, 'Card');
  assert.match(TOOLS, /const rsvpCard = rsvpOpen \? rsvpLookCard\(picked\) : null;/);
  assert.match(TOOLS, /const rsvpLineName = rsvpLine \? \(RSVP_LINE_NAME\[rsvpLine\] \?\? rsvpLine\) : rsvpCard \? RSVP_CARD_NAME : null;/);
  /* "RSVP › Form › Card" — in place of the part's name — and the frame's tab says the same. */
  assert.match(TOOLS, /if \(rsvpLineName && picked\) \{\s*if \(linePieces\[linePieces\.length - 1\] === makerPartLabelOn\(stageKey, picked\)\) linePieces\.pop\(\);\s*linePieces\.push\(rsvpLineName\);/);
  assert.match(TOOLS, /name: rsvpCard \? RSVP_CARD_NAME : undefined,/);
  assert.match(src(`${L}/add-part-sheet.tsx`), /\{line\?\.name \?\? name \?\? label\}/);
  /* The two tools that were grey on every reply part are live on a card and on a line — and only there. */
  assert.match(TOOLS, /const rsvpLooks = rsvpCard !== null \|\| \(rsvpOpen && rsvpLookLine\(picked, rsvpLine\) !== null\);/);
  assert.match(TOOLS, /const ownTool = \(t: MakerPartTool\) => \(rsvpLooks && \(t === 'bg' \|\| t === 'animate'\)\) \|\| /);
  assert.match(TOOLS, /const toolWorks = \(t: MakerPartTool\) => !picked \|\| ownTool\(t\) \|\| /);
  /* "Open the card": the line is let go; the pass's Save button sits on the When-yes card. */
  assert.equal(RSVP_OPEN_CARD_EVENT, 'setnayan:rsvp-open-card');
  assert.match(TOOLS, /const open = \(\) => \{\s*setLineAtPart\(null\);\s*if \(pickedRef\.current === 'pass'\) pickPartRef\.current\('yesnote'\);\s*\};\s*window\.addEventListener\(RSVP_OPEN_CARD_EVENT, open\);/);
  assert.match(src(`${L}/maker-rsvp-ask.tsx`), /<RsvpLineGroundRow onOpenCard=\{\(\) => window\.dispatchEvent\(new CustomEvent\(RSVP_OPEN_CARD_EVENT\)\)\} \/>/);
  /* The pass's Save line has its tools in the stage's panel too (the pass itself keeps its one door). */
  assert.match(src(`${L}/maker-rsvp-stage.tsx`), /\|\| \(picked === 'pass' && line !== null\);/);
  assert.match(src(`${L}/maker-rsvp-stage.tsx`), /\$\{rsvpToolPart\(pickedPart, pickedLine\) \? 'flex' : 'hidden'\}/);
  /* The toolbar's Animate has ONE new option and is otherwise as it was: every other caller draws its three phases. */
  const ANIMATE = src(`${L}/stage-panel/stage-animate.tsx`);
  assert.match(ANIMATE, /const at: AnimatePhase = only \?\? phase;\s*const end = at === 'act' \? null : at;/);
  assert.match(ANIMATE, /\{only \? null : \(\s*<div className=\{`\$\{SP_ROWS_ROW\} row-start-1`\}>\s*<Phases<AnimatePhase>/);
});

/* ══ 11 · WHAT IS REPLAYED IS ASKED OF THE READER — NEVER DUG OUT OF THE CSS ═══════════════════════════════════════
   Controller, on the review copy (2026-10-10): choosing Move on the Question threw
     "SyntaxError: Failed to execute 'querySelectorAll' on 'Document': '@media (prefers-reduced-motion:reduce)' is not
      a valid selector."
   The canvas split the finished CSS on "}" to find which rule had changed, and the reduced-motion block — which
   holds the word "animation" — came out as a "selector". The rules are data now (`rsvpLookRules`); the keyframe and
   the reduced-motion block are the text's own tail and are in no list a page is asked for.
   Sabotages seen red (each restored): the tail put among the rules · the canvas splitting the text again. */

/** Everything a page may be ASKED for: the card, the inner note card, a named line. Never an at-rule. */
const A_SELECTOR = /^(div:has\(>\[data-door-header\]\)|\[data-landing-missed\]|\[data-rsvp-line="[a-z]+"\]\[data-rsvp-line\])$/;

test('11 · a look with the reduced-motion block is never read as a selector; only a changed Build in is replayed', () => {
  const look = readRsvpLook({ look: { card: { rsvp: { g: 'frost', i: { fade: true } } }, lines: { 'rsvp.question': { c: 2, i: { move: 'below' }, v: 'quick' }, 'rsvp.hint': { s: 85 } } } });
  const css = rsvpLookCss(look, ['rsvp'], BOARD);
  /* The text DOES hold the block (the very thing that was mis-read)… */
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{/);
  assert.match(css, /@keyframes rsvp-in\{/);
  /* …and no rule a page is asked for is it, or the keyframe: every selector is one of the three plain kinds. */
  const rules = rsvpLookRules(look, ['rsvp'], BOARD);
  assert.equal(rules.length, 3);
  for (const r of rules) {
    assert.match(r.selector, A_SELECTOR, `${r.selector} would be handed to querySelectorAll`);
    assert.doesNotMatch(r.selector + r.rules, /[@{}]/, 'a rule carries a block of its own');
  }
  /* The text is exactly those rules and then the tail — nothing a reader of the text could find that the list lacks. */
  assert.ok(css.startsWith(rules.map((r) => `${r.selector}{${r.rules}}`).join('')));
  assert.deepEqual(rules.map((r) => r.moves), [true, true, false], 'what moves is not said by the reader');
  /* What the canvas replays, done here as it does it: the selectors of the rules that MOVE and CHANGED — all valid. */
  const played = new Map<string, string>();
  const replay = (next: ReturnType<typeof rsvpLookRules>) => {
    const out = next.filter((r) => r.moves && played.get(r.selector) !== r.rules).map((r) => r.selector);
    played.clear();
    for (const r of next) if (r.moves) played.set(r.selector, r.rules);
    return out;
  };
  assert.deepEqual(replay(rules), ['div:has(>[data-door-header])', '[data-rsvp-line="question"][data-rsvp-line]']);
  assert.deepEqual(replay(rules), [], 'an unchanged Build in plays again');
  /* A colour changed on a moving line changes its rule → it plays again; the card, untouched, does not. */
  const recoloured = rsvpLookRules(readRsvpLook({ look: { card: { rsvp: { g: 'frost', i: { fade: true } } }, lines: { 'rsvp.question': { c: 3, i: { move: 'below' }, v: 'quick' } } } }), ['rsvp'], BOARD);
  assert.deepEqual(replay(recoloured), ['[data-rsvp-line="question"][data-rsvp-line]']);
  /* THE CANVAS does exactly that — and never takes the text apart. */
  const BRIDGE = src('app/[slug]/_components/rsvp-canvas-bridge.tsx');
  assert.match(BRIDGE, /for \(const rule of rsvpLookRules\(read, parts, board\)\) \{\s*if \(!rule\.moves \|\| played\.get\(rule\.selector\) === rule\.rules\) continue;\s*document\.querySelectorAll<HTMLElement>\(rule\.selector\)\.forEach\(/);
  assert.doesNotMatch(BRIDGE, /\.split\('\}'\)|rule\.slice\(|includes\('animation:'\)/, 'the canvas reads selectors out of the CSS text again');
  /* The ONLY querySelectorAll calls with a built string are the tag's own and the reader's selectors. */
  assert.equal((BRIDGE.match(/querySelectorAll<HTMLElement>\(rule\.selector\)/g) ?? []).length, 1);
});

test('11 · When no shows ONE card: with a ground chosen for the door’s card, the note’s own card gives up its paper', () => {
  assert.equal(RSVP_INNER_CARD_SELECTOR, '[data-landing-missed]');
  const inner = (raw: unknown, parts: string[]) => rsvpLookRules(readRsvpLook(raw), parts, BOARD).filter((r) => r.selector === RSVP_INNER_CARD_SELECTOR);
  /* Nothing set — or only a Build in — is today's look exactly: both cards, untouched. */
  assert.deepEqual(inner({}, ['nonote']), []);
  assert.deepEqual(inner({ look: { card: { nonote: { i: { fade: true } } } } }, ['nonote']), []);
  /* None or Frosted: the inner card's paper, border and shadow go. */
  for (const g of ['none', 'frost']) {
    const got = inner({ look: { card: { nonote: { g } } } }, ['nonote']);
    assert.equal(got.length, 1, `${g}: two cards still show`);
    assert.match(got[0]!.rules, /^background:transparent!important;border-color:transparent!important;box-shadow:none!important;/);
    assert.equal(got[0]!.moves, false);
  }
  /* Only When no has a card inside its card: the form's and When yes's grounds touch no inner card. */
  assert.deepEqual(inner({ look: { card: { rsvp: { g: 'none' }, yesnote: { g: 'frost' } } } }, ['rsvp']), []);
  assert.deepEqual(inner({ look: { card: { rsvp: { g: 'none' }, yesnote: { g: 'frost' } } } }, ['yesnote', 'pass']), []);
  assert.match(rsvpLookCss(readRsvpLook({ look: { card: { nonote: { g: 'frost' } } } }), ['nonote'], BOARD), SAFE_CSS);
  /* The real note card is the one addressed (and the lab's stand-in draws the same one). */
  assert.match(src('app/[slug]/invite/enter/page.tsx'), /<div className="sn-glass-bare rounded-2xl bg-cream\/95 px-5 py-7 text-center shadow-sm" data-landing-missed="">/);
  assert.match(src('app/dev/maker-lab/guest/page.tsx'), /<div className="sn-glass-bare mt-6 rounded-2xl bg-cream\/95 px-5 py-7 text-center shadow-sm" data-landing-missed="">/);
});
