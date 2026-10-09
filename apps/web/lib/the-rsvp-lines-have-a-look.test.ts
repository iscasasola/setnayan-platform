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
import { rsvpAskConfigOnGoingPublic, sanitizeRsvpAskConfig } from './rsvp-ask';
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
  rsvpLookCss,
  rsvpLookLine,
  rsvpLookWith,
} from './rsvp-look';
import {
  RSVP_CANVAS_HERO,
  RSVP_CANVAS_SECTIONS,
  RSVP_CARD_ATTR,
  RSVP_CARD_GROUPS,
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
/** Every rule the builder may ever write: a named line, a checked colour, a number. Nothing else. */
const SAFE_CSS = /^(\[data-rsvp-line="[a-z]+"\]\[data-rsvp-line\]\{(color:#[0-9a-f]{6};)?(zoom:[0-9.]+;)?\})*$/;

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
  const look = { lines: { 'rsvp.question': { c: 2, s: 120 } }, card: 'f', order: { form: ['hint', 'question'] } };
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
  assert.deepEqual(rsvpLookWith(stored, 'rsvp.question', { c: null, s: 100 }), { card: 'f', order: look.order });
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
    /if \(d\.t === RSVP_LOOK_MESSAGE\) \{\s*document\.querySelectorAll<HTMLElement>\(`style\[\$\{RSVP_LOOK_STYLE_ATTR\}\]`\)\.forEach\(\(el\) => \{\s*const css = rsvpLookCss\(readRsvpLook\(\{ look: d\.look \}\), \(el\.getAttribute\(RSVP_LOOK_STYLE_ATTR\) \?\? ''\)\.split\(' '\), \(el\.dataset\.rsvpBoard \?\? ''\)\.split\(' '\)\);/,
  );
  /* THE MAKER sends the look with every preview (and when a frame says it is ready). */
  const sent = rsvpPreviewMessages({ look: { lines: { 'rsvp.question': { s: 120 } } } }, false).filter((m) => m.t === RSVP_LOOK_MESSAGE);
  assert.deepEqual(sent, [{ source: 'setnayan-editor', t: 'rsvpLook', look: { lines: { 'rsvp.question': { s: 120 } } } }]);
  assert.deepEqual(rsvpPreviewMessages({}, false).filter((m) => m.t === RSVP_LOOK_MESSAGE), [{ source: 'setnayan-editor', t: 'rsvpLook', look: {} }], 'a look taken away is never told to the page');
});
