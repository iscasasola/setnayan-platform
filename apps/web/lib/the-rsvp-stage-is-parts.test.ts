/**
 * 🧩 THE RSVP STAGE IS PARTS — Form · When yes · When no, each pickable, never live.
 *
 * Owner, on the Maker's Stages › RSVP (preview checks 2026-10-07/08, verbatim): *"RSVP cannot select anything"* ·
 * *"it is the actual RSVP not an editing way"* · *"no way to access yes and no response"* · *"yes and no page for
 * the rsvp is to show what the rsvp looks like after the reply yes or no"*.
 *
 * Measured before this (preview c4d3fc1, 375 px): the stage drew the real reply form with its fields inert
 * (345e598f8) — and nothing on it could be picked: no frame, no name tab, no tools.
 *
 * What holds now, each EXECUTED on the real functions (a source read only where the rule is a wiring):
 *   1 · every marker, every masthead part and every word on the three screens IS a part of its own screen;
 *   2 · a tap picks the part under it — never navigates, never reaches a form control, never the work area's `edit`;
 *   3 · nothing sends: the submit stop, the inert fields and the sample-guest refusal all stand;
 *   4 · typing is a SECOND tap, through the Event Hub canvas's own gate (`makerStageMayType`), into the panel's save;
 *   5 · a tab opens its screen from the top, the label follows the screen on show, nothing scrolls it afterwards;
 *   6 · the frame, its name tab and ↑ ↓ ✕ are drawn on the RSVP screen's own frame;
 *   7 · a guest's reply pages are untouched: every marker and the bridge are behind the host-verified `canvas`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  RSVP_CANVAS_CONTROLS,
  RSVP_CANVAS_HERO,
  RSVP_CANVAS_SECTIONS,
  RSVP_LINE_ATTR,
  RSVP_LINE_NAME,
  RSVP_SECTION_LINES,
  rsvpLineOf,
  RSVP_STAGE_BAR_SLOT,
  RSVP_WORD_SECTION,
  createRsvpCanvasTop,
  rsvpPartOfTap,
  rsvpStageFrameSelector,
  rsvpTypedText,
  rsvpWordIsTyped,
  stampRsvpCanvas,
} from '../app/[slug]/_components/rsvp-canvas-parts';
import { HUB_TAB_HOLD_MS } from '../app/[slug]/_components/hub-tab-dom';
import { MAKER_PARTS, MAKER_STAGE_KEYS, makerPartOfTap, makerPartsOnPage, makerPartsTappable, makerStageIsFixedPages, makerStagePickedAttr, type MakerPartKey } from './maker-parts';
import { makerStageMayType } from './maker-stage-type';
import { RSVP_WORD_KEYS } from './rsvp-ask';
import { RSVP_SCENE_WORDS, RSVP_STAGE_SCENES, type RsvpStageScene } from './rsvp-stage';
import { RSVP_STAGE_KEY, rsvpWordBridgeKey } from './rsvp-stage-shared';
import { RSVP_LINE_WORD } from './rsvp-form-words';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const REPLY = src('app/[slug]/invite/reply/page.tsx');
const ENTER = src('app/[slug]/invite/enter/page.tsx');
const BRIDGE = src('app/[slug]/_components/rsvp-canvas-bridge.tsx');
const TOOLS = src(`${L}/stage-tools.tsx`);
const STAGE = src(`${L}/maker-rsvp-stage.tsx`);
const EDGES = src(`${L}/add-part-sheet.tsx`);
const PANEL = src(`${L}/maker-rsvp-ask.tsx`);

const SCREENS: readonly RsvpStageScene[] = ['form', 'thanks', 'decline'];
/** The masthead parts each screen's door draws (`DoorShell`): the form has the eyebrow and the date · place line;
 *  the after-screens have the couple's invitation line instead. */
const HERO_ELS: Record<RsvpStageScene, readonly string[]> = {
  form: ['mark', 'eyebrow', 'names', 'date', 'venue'],
  thanks: ['mark', 'names', 'line'],
  decline: ['mark', 'names', 'line'],
};

/* ── a small structural page, for the functions that walk one ─────────────── */

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
  insertBefore(node: Fake, before: Fake): Fake;
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
/** `[attr]`, `[attr="v"]` and `[attr] > *` — all this file's subjects ask a page for. */
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
const marker = (key: string) => el('span', { 'data-maker-section': key });

/** A reply door as `DoorShell` draws it, BEFORE the canvas names its masthead. */
function door(body: Fake[], header: Fake[]) {
  const logo = el('span');
  const card = el('div', {}, [
    el('div', { 'aria-hidden': 'true' }, [el('div', { 'data-door-mark': 'logo' }, [logo])]),
    el('header', { 'data-door-header': '' }, header),
    el('div', {}, body),
  ]);
  const made = el('a', { href: '/' });
  const frame = el('div', {}, [card, el('p', { 'data-door-made-with': '' }, [made])]);
  const doc = {
    root: el('main', {}, [frame]),
    querySelector: (sel: string) => find(doc.root, sel),
    createElement: (tag: string) => el(tag),
  };
  return { doc, card, logo, made, frame };
}

/* ══ 1 · EVERY PIECE IS A PART OF ITS OWN SCREEN ═════════════════════════════ */

test('1 · every marked section of the three screens is a part of that screen — the two notes included', () => {
  for (const screen of SCREENS) {
    for (const key of RSVP_CANVAS_SECTIONS[screen]) {
      const part = makerPartOfTap(RSVP_STAGE_KEY, screen, key, null);
      assert.ok(part, `${screen} › ${key}: a tap there picks nothing`);
      assert.equal(MAKER_PARTS[part!].canvas, key, `${screen} › ${key} picked ${part}, which is drawn elsewhere`);
      assert.ok(makerPartsOnPage(RSVP_STAGE_KEY, screen).includes(part!), `${part} is not a part of ${screen}`);
    }
  }
  assert.equal(MAKER_PARTS.yesnote.canvas, 'f:yesnote', 'the When-yes note is drawn nowhere');
  assert.equal(MAKER_PARTS.nonote.canvas, 'f:nonote', 'the When-no note is drawn nowhere');
});

test('1 · every masthead part the door draws is its own part — never the whole card', () => {
  const picked: Record<string, MakerPartKey[]> = {};
  for (const screen of SCREENS) {
    picked[screen] = HERO_ELS[screen].map((part) => {
      const k = makerPartOfTap(RSVP_STAGE_KEY, screen, RSVP_CANVAS_HERO, part);
      assert.ok(k, `${screen} › ${part}: a tap there picks nothing`);
      assert.equal(MAKER_PARTS[k!].el, part, `${screen} › ${part} picked ${k}, another part of the masthead`);
      return k!;
    });
  }
  assert.deepEqual(picked.form, ['logo', 'ename', 'names', 'date', 'place']);
  assert.deepEqual(picked.thanks, ['logo', 'names', 'heroline']);
  assert.deepEqual(picked.decline, ['logo', 'names', 'heroline']);
});

test('1 · every word on the canvas is in a marked section of the screen that edits it', () => {
  const words = [...RSVP_WORD_KEYS, 'reply-by'] as const;
  for (const word of words) {
    const section = RSVP_WORD_SECTION[word];
    assert.ok(section, `${word} is in no section — a tap on it would pick nothing`);
    /* 🔁 RE-AIMED 2026-10-09: a word is edited on the screen whose LIST holds it — or, since every line is its own
       part, on the form as one of its lines (the eyebrow, the question, the hint: `RSVP_LINE_WORD`). */
    const screen =
      word === 'reply-by' || (Object.values(RSVP_LINE_WORD.rsvp ?? {}) as string[]).includes(word) ? 'form' : SCREENS.find((s) => (RSVP_SCENE_WORDS[s] as readonly string[]).includes(word));
    assert.ok(screen, `${word} is edited on no screen`);
    assert.ok((RSVP_CANVAS_SECTIONS[screen!] as readonly string[]).includes(section!), `${word}: ${section} is not marked on ${screen}`);
    assert.ok(makerPartOfTap(RSVP_STAGE_KEY, screen, section!, null), `${word}: its section is no part`);
  }
  /* …and nothing else is named a word (a new one must be filed here to be tappable). */
  assert.deepEqual(Object.keys(RSVP_WORD_SECTION).sort(), [...words].sort());
});

test('1 · WIRING: the pages mark exactly those sections, and every word sits inside one', () => {
  const marks = (page: string) => [...page.matchAll(/data-maker-section=(?:"([^"]+)"|\{([^}]+)\})/g)].flatMap((m) => m[1] ?? [...m[2]!.matchAll(/'(\w:[^']+)'/g)].map((x) => x[1]!));
  assert.deepEqual(marks(REPLY), [...RSVP_CANVAS_SECTIONS.form]);
  assert.deepEqual(marks(ENTER).sort(), [...RSVP_CANVAS_SECTIONS.thanks, ...RSVP_CANVAS_SECTIONS.decline].sort());
  /* The form: its marker stands before ONE element holding the reply-by line and the form itself. */
  const rsvpAt = REPLY.indexOf('data-maker-section="f:rsvp"');
  const open = REPLY.indexOf('<CanvasSection on={canvas}>', rsvpAt);
  const close = REPLY.indexOf('</CanvasSection>');
  assert.ok(rsvpAt > 0 && open > rsvpAt && close > open);
  assert.equal(REPLY.slice(rsvpAt, open).replace(/[^<]*\/> : null\}\s*/, ''), '', 'something stands between the RSVP marker and its section');
  const inside = REPLY.slice(open, close);
  assert.match(inside, /rsvpWordBridgeKey\('reply-by'\)/, 'the reply-by line is outside the RSVP part');
  assert.match(inside, /<RsvpWidget\b/, 'the form is outside the RSVP part');
  assert.match(src('app/[slug]/_components/rsvp-widget.tsx'), /<form[^>]*>[\s\S]*data-rsvp-word=\{rsvpWordBridgeKey\(option\.key\)\}/, 'the answers are drawn inside the form');
  /* The greeting is the guest's own name line. */
  assert.match(REPLY, /data-maker-section="f:greeting" \/> : null\}\s*(?:\{\s*\}\s*)?<FirstScreenOnly on=\{oneQuestionFrame\}>\s*<div[^>]*>\s*<p[^>]*data-reply-for=""/);
  /* The notes: every word of the after-screens sits in the block the note's marker stands before. */
  const noteAt = ENTER.indexOf("data-maker-section={reply === 'no' ? 'f:nonote' : 'f:yesnote'}");
  const block = ENTER.indexOf('<div data-landing="message"', noteAt);
  const blockEnd = ENTER.indexOf('data-landing="reply"');
  assert.ok(noteAt > 0 && block > noteAt && blockEnd > block);
  assert.equal(ENTER.slice(noteAt, block).replace(/[^<]*\/> : null\}\s*/, ''), '', 'something stands between the note’s marker and its block');
  const all = [...ENTER.matchAll(/rsvpWordBridgeKey\(wordKeys\.\w+\)/g)];
  assert.ok(all.length >= 4, 'the notes’ words are gone');
  for (const m of all) assert.ok(m.index! > block && m.index! < blockEnd, 'a word of the after-screens is outside its note');
  /* The ticket's marker stands straight before the ticket — and a "no" has none. */
  assert.match(ENTER, /\{canvas && !noTicketSample && ticket !== 'none' \? <span hidden data-maker-section="f:pass" \/> : null\}\s*\{ticket === 'full' \? \(/);
  /* …the sample has no row to read "cannot come" from, so the canvas says it — false for every guest. */
  assert.match(ENTER, /const noTicketSample = canvas && reply === 'no';/);
  assert.match(ENTER, /\) : ticket === 'none' \? null : noTicketSample \? null : passCard === 'awaiting' \? \(/, 'the When-no sample draws a ticket a real “no” never has');
});

test('1 · the masthead is named on the canvas: mark · eyebrow · names · line, and the card is the hero’s section — once', () => {
  const eyebrow = el('p');
  const names = el('h1');
  const line = el('p', { class: 'text-sm leading-relaxed' });
  const meta = el('p', { class: 'font-mono text-xs uppercase' }, [el('span', { 'data-el': 'date' }), el('span', { 'data-el': 'venue' })]);
  const { doc, card, logo, frame } = door([], [eyebrow, names, line, meta]);
  assert.equal(stampRsvpCanvas(doc as never), true);
  assert.equal(logo.getAttribute('data-el'), 'mark');
  assert.equal(eyebrow.getAttribute('data-el'), 'eyebrow');
  assert.equal(names.getAttribute('data-el'), 'names');
  assert.equal(line.getAttribute('data-el'), 'line', 'the couple’s invitation line is not a part');
  assert.equal(meta.getAttribute('data-el'), null, 'the date · place line is two parts (the page names them), never one');
  assert.equal(card.previousElementSibling?.getAttribute('data-maker-section'), RSVP_CANVAS_HERO, 'the card is not the hero’s section');
  assert.equal(card.previousElementSibling?.hidden, true, 'the marker draws');
  stampRsvpCanvas(doc as never);
  assert.equal(frame.children.filter((c) => c.getAttribute('data-maker-section')).length, 1, 'a second call marked the card twice');
  /* A page with no door is left alone. */
  assert.equal(stampRsvpCanvas({ querySelector: () => null, createElement: () => el('span') } as never), false);
  /* …and the page names the date and the place apart, for the canvas only. */
  assert.match(REPLY, /meta=\{canvas \? canvasWhenWhere\(event\) : joinDoorMeta\(\{/);
  assert.match(REPLY, /<span data-el="date">\{when\}<\/span>/);
  assert.match(REPLY, /<span data-el="venue">\{place\}<\/span>/);
});

/* ══ 2 · A TAP PICKS ═════════════════════════════════════════════════════════ */

/** The form screen as the canvas draws it, masthead named. */
function formScreen() {
  const eyebrow = el('p');
  const names = el('h1');
  const date = el('span', { 'data-el': 'date' });
  const venue = el('span', { 'data-el': 'venue' });
  const header = [eyebrow, names, el('p', { class: 'font-mono' }, [date, el('span'), venue])];
  const replyFor = el('p', { 'data-reply-for': '' });
  const replyBy = el('p', { 'data-rsvp-word': 'rsvp:reply-by' });
  const yes = el('span', { 'data-rsvp-word': 'rsvp:attending' });
  const radio = el('input', { type: 'radio' });
  const send = el('button', { type: 'submit' });
  const meal = el('select');
  const form = el('form', {}, [el('fieldset', {}, [el('label', { 'data-rsvp-answer': '' }, [radio, yes])]), el('div', {}, [meal]), send]);
  const body = [
    marker('f:greeting'),
    el('div', { 'data-rsvp-context': '' }, [el('div', {}, [replyFor])]),
    marker('f:rsvp'),
    el('div', {}, [el('div', { 'data-rsvp-context': '' }, [replyBy]), form]),
  ];
  const page = door(body, header);
  stampRsvpCanvas(page.doc as never);
  return { ...page, eyebrow, names, date, venue, replyFor, replyBy, yes, radio, send, meal, form };
}

test('2 · a tap on ANY piece of the form screen picks its part — a field, the Send button and a word included', () => {
  const s = formScreen();
  const part = (target: Fake) => {
    const hit = rsvpPartOfTap(target);
    return hit ? makerPartOfTap(RSVP_STAGE_KEY, 'form', hit.key, hit.el) : null;
  };
  assert.equal(part(s.logo), 'logo');
  assert.equal(part(s.eyebrow), 'ename');
  assert.equal(part(s.names), 'names');
  assert.equal(part(s.date), 'date');
  assert.equal(part(s.venue), 'place');
  assert.equal(part(s.replyFor), 'greeting');
  for (const piece of [s.replyBy, s.yes, s.radio, s.meal, s.send, s.form]) assert.equal(part(piece), 'rsvp', 'a piece of the form is not the RSVP part');
  /* The word under the finger is named — the form's, never the masthead's. */
  assert.equal(rsvpPartOfTap(s.yes)?.word, 'rsvp:attending');
  assert.equal(rsvpPartOfTap(s.replyBy)?.word, 'rsvp:reply-by');
  assert.equal(rsvpPartOfTap(s.send)?.word, null);
  assert.deepEqual(rsvpPartOfTap(s.names), { key: 'f:hero', el: 'names', word: null, line: null });
});

/* 🔁 RE-AIMED 2026-10-10 (owner on the prototype: "heading message then the whole group?" — the card is picked as
   the group from its EDGE): the card's own paper used to let go. It now picks the group of lines the card holds —
   never "the whole masthead", which is still what this test forbids. The ground outside the card still lets go
   (`the-rsvp-lines-have-a-look.test.ts` §6 holds the rule in full). */
test('2 · the card’s own paper is the group — never the whole masthead; "Made with Setnayan" and the ground pick nothing', () => {
  const s = formScreen();
  assert.deepEqual(rsvpPartOfTap(s.card), { key: 'f:rsvp', el: null, word: null, line: null }, 'a tap on the card’s paper picked the whole masthead, or nothing');
  assert.deepEqual(rsvpPartOfTap(s.card.children[1]!), { key: 'f:rsvp', el: null, word: null, line: null }, 'the gap between the masthead’s parts picked a masthead part');
  assert.equal(rsvpPartOfTap(s.made), null);
  assert.equal(rsvpPartOfTap(null), null);
});

test('2 · the after-screens: the note and the ticket are parts; a button under them is the ground', () => {
  for (const [screen, note, noteKey] of [['thanks', 'yesnote', 'f:yesnote'], ['decline', 'nonote', 'f:nonote']] as const) {
    const heading = el('span', { 'data-rsvp-word': rsvpWordBridgeKey(screen === 'thanks' ? 'thanksHeading' : 'declineHeading') });
    const qr = el('svg');
    const save = el('button');
    const open = el('a', { href: '/x' });
    const body = [marker(noteKey), el('div', { 'data-landing': 'message' }, [el('p', {}, [heading])])];
    if (screen === 'thanks') body.push(marker('f:pass'), el('div', { 'data-landing': 'ticket' }, [qr, save]));
    body.push(el('div', { 'data-landing': 'open' }, [open]));
    const page = door(body, [el('h1'), el('p', { class: 'text-sm' })]);
    stampRsvpCanvas(page.doc as never);
    const hit = rsvpPartOfTap(heading)!;
    assert.equal(makerPartOfTap(RSVP_STAGE_KEY, screen, hit.key, hit.el), note);
    assert.equal(hit.word, heading.getAttribute('data-rsvp-word'));
    if (screen === 'thanks') {
      for (const piece of [qr, save]) assert.equal(makerPartOfTap(RSVP_STAGE_KEY, screen, rsvpPartOfTap(piece)!.key, null), 'pass');
    }
    assert.equal(rsvpPartOfTap(open), null, '"Open the invitation" is no part — a tap there lets the part go, and goes nowhere');
  }
});

test('2 · WIRING: the tap is never the page’s — stopped before React, then told as a pick', () => {
  const click = BRIDGE.slice(BRIDGE.indexOf('const onClick = (e: MouseEvent) => {'), BRIDGE.indexOf('const onDown = '));
  /* Past the caret's own taps, the very first thing is the stop — under no condition. */
  assert.match(
    click,
    /if \(inTyping\(target\)\) \{\s*e\.preventDefault\(\);\s*return;\s*\}\s*e\.preventDefault\(\);\s*e\.stopPropagation\(\);\s*const part = rsvpPartOfTap\(target\);/,
    'a tap can reach the page: a link would navigate, a button would act',
  );
  assert.match(click, /if \(!part\) \{\s*stopTyping\(\);\s*toMaker\(\{ t: RSVP_GROUND_MESSAGE \}\);\s*return;\s*\}/);
  assert.match(click, /toMaker\(\{ t: RSVP_PICK_MESSAGE, key: part\.key,/);
  assert.match(BRIDGE, /document\.addEventListener\('click', onClick, true\)/, 'the stop is not in the capture phase');
  /* ⚠ Never the Event Hub canvas's own messages: the work area stays mounted under the RSVP stage and answers
     them — an `edit` for the hero moves the Maker's selection and closes this stage. */
  assert.doesNotMatch(BRIDGE, /t: 'edit'|t: 'tapOutside'|t: 'type'\b/, 'the RSVP canvas speaks as the Event Hub canvas');
  /* The press that would focus a field, and the keystroke that would fill it, are still refused. */
  assert.match(BRIDGE, /const onDown = \(e: Event\) => \{[\s\S]*?if \(inTyping\(target\)\) return;\s*if \(target\?\.closest\(INERT_FIELDS\)\) e\.preventDefault\(\);\s*\};/);
  assert.match(BRIDGE, /const onKey = \(e: Event\) => \{[\s\S]*?if \(inTyping\(target\)\) return;\s*if \(target\?\.closest\(INERT_FIELDS\)\) e\.preventDefault\(\);\s*\};/);
  for (const ev of ['pointerdown', 'mousedown']) assert.match(BRIDGE, new RegExp(`document\\.addEventListener\\('${ev}', onDown, true\\)`));
  for (const ev of ['keydown', 'beforeinput']) assert.match(BRIDGE, new RegExp(`document\\.addEventListener\\('${ev}', onKey, true\\)`));
});

test('2 · WIRING: the Stages panel reads the pick with the map every stage uses, and opens the part’s tools — without the work area', () => {
  /* 🔁 RE-AIMED 2026-10-09 (every line is its own part): between reading the pick and picking the part, the LINE under
     the finger is now kept WITH that part (`lineAtPart`). The claim is unchanged — the part is found by the one map
     every stage uses, and a tap that is no part lets go. */
  assert.match(TOOLS, /else if \(d\.t === RSVP_PICK_MESSAGE && typeof d\.key === 'string'\) \{\s*const k = makerPartOfTap\(RSVP_STAGE_KEY, where\.current\.shownPage, d\.key, typeof d\.el === 'string' \? d\.el : null\);\s*const tappedLine = k \? rsvpLineOf\(d\.key, typeof d\.line === 'string' \? d\.line : null\) : null;\s*setLineAtPart\(k && tappedLine \? \{ part: k, line: tappedLine \} : null\);\s*if \(k\) pickPartRef\.current\(k\);\s*else deselectRef\.current\(\);/);
  assert.match(TOOLS, /else if \(d\.t === RSVP_GROUND_MESSAGE\) deselectRef\.current\(\);/);
  /* Picking on the RSVP stage asks the stage for its tools and returns BEFORE the work area's `edit`. */
  const pick = TOOLS.slice(TOOLS.indexOf('const pickPart = useCallback('), TOOLS.indexOf('const pickPartRef'));
  assert.match(pick, /if \(rsvpOpen\) \{\s*askRsvpStage\(\{ controls: true \}\);\s*return;\s*\}[\s\S]*t: 'edit'/, 'a pick on the RSVP stage reaches the work area');
  assert.match(STAGE, /if \(typeof d\?\.controls === 'boolean'\) setControlsOpen\(d\.controls\);/);
  /* The tiles are the parts the screen DREW — never one for a piece it did not. */
  assert.match(TOOLS, /rsvpOpen \? makerPartsTappable\(RSVP_STAGE_KEY, screen, present\) : tappableOn\(shownPage\)/);
  const drew = new Set(['f:hero', 'f:hero|mark', 'f:hero|names', 'f:yesnote']);
  assert.deepEqual(makerPartsTappable(RSVP_STAGE_KEY, 'thanks', drew), ['logo', 'names', 'yesnote'], 'a tile for a line or a ticket the page did not draw');
  /* The tools are the picked part's: the form's and the notes' are the stage's controls; any other part has its door. */
  /* 🔁 RE-AIMED 2026-10-10: the panel is also the picked LINE's — the pass's Save button has its size, its Build in
     and its ground row here — so the line is asked too (`rsvpToolPart(part, line)`). The pass itself still has none. */
  assert.match(STAGE, /className=\{`flex-col gap-3 pb-4 \$\{rsvpToolPart\(pickedPart, pickedLine\) \? 'flex' : 'hidden'\}`\} data-rsvp-stage-look=""/);
  assert.match(STAGE, /return picked === null \|\| picked === 'rsvp' \|\| picked === 'yesnote' \|\| picked === 'nonote' \|\| \(picked === 'pass' && line !== null\);/);
  assert.match(TOOLS, /const q = rsvpOpen \? rsvpQuietRow\(picked\) :/);
});

/* ══ 3 · NOTHING SENDS ═══════════════════════════════════════════════════════ */

test('3 · the sample still sends nothing: the submit stop, the inert fields and the refusal all stand', () => {
  assert.match(BRIDGE, /const INERT_FIELDS = 'input, textarea, select, label,/);
  assert.match(BRIDGE, /const onSubmit = \(e: Event\) => \{\s*e\.preventDefault\(\);\s*e\.stopPropagation\(\);/);
  assert.match(BRIDGE, /window\.addEventListener\('submit', onSubmit, true\)/);
  assert.match(src('app/[slug]/invite/actions.ts'), /if \(guestId === SIMULATED_GUEST_ID\) \{/);
  /* No button is left live on any screen (the one-question walker's Next checks its fields — and would focus one). */
  assert.doesNotMatch(BRIDGE, /inertButtons|RSVP_WALKER/);
});

test('3 · no control of a sample page can take focus — by a tap, the Tab key or a script: each is `inert`', () => {
  const controls = RSVP_CANVAS_CONTROLS.split(',').map((c) => c.trim());
  for (const c of ['input', 'textarea', 'select', 'button', 'a[href]', 'summary']) assert.ok(controls.includes(c), `${c} can still be focused`);
  /* The couple's words sit inside the answers' labels — a label is never inert, or its words could not be picked. */
  assert.ok(!controls.includes('label'));
  assert.match(BRIDGE, /const lock = \(\) => document\.querySelectorAll\(RSVP_CANVAS_CONTROLS\)\.forEach\(\(c\) => c\.setAttribute\('inert', ''\)\);\s*lock\(\);/);
  /* …and one drawn later (the walker's own buttons) is locked as it appears. */
  assert.match(BRIDGE, /const locker = new MutationObserver\(lock\);\s*locker\.observe\(document\.body, \{ childList: true, subtree: true \}\);/);
});

/* ══ 4 · TYPING IS A SECOND TAP ══════════════════════════════════════════════ */

test('4 · a tap only picks — the first, and one on the part already picked — by the Event Hub canvas’s own gate', () => {
  /* 🔁 RE-AIMED 2026-10-09 (owner: *"on preview screen, you only select. You can change the content there via edit"*):
     the gate answered yes for the part already picked; it answers no for every part now (`lib/maker-stage-type.ts`).
     The reply pages still ask the SAME gate with the SAME picked part — the wiring test below is unchanged. */
  for (const [part, key] of [['yesnote', 'f:yesnote'], ['nonote', 'f:nonote'], ['rsvp', 'f:rsvp']] as const) {
    const picked = makerStagePickedAttr(part);
    assert.equal(makerStageMayType(null, key, null), false, `${part}: a first tap typed`);
    assert.equal(makerStageMayType(makerStagePickedAttr('logo'), key, null), false, `${part}: typed while another part was picked`);
    assert.equal(makerStageMayType(picked, key, null), false, `${part}: a tap on the picked part types on the reply page again`);
  }
  /* The words typed are the couple's; the reply-by line is a date, set in the form's tools. */
  for (const word of RSVP_WORD_KEYS) assert.equal(rsvpWordIsTyped(rsvpWordBridgeKey(word)), true, word);
  assert.equal(rsvpWordIsTyped(rsvpWordBridgeKey('reply-by')), false);
  assert.equal(rsvpWordIsTyped('rsvp:something-else'), false);
  assert.equal(rsvpWordIsTyped(null), false);
  assert.equal(rsvpTypedText('  See you\n there,\t{name}!  '), 'See you there, {name}!');
});

test('4 · WIRING: the gate is asked on the page, the pick is the Maker’s to say, and the words go into the panel’s own save', () => {
  assert.match(
    BRIDGE,
    /if \(wordEl && part\.word && rsvpWordIsTyped\(part\.word\) && makerStageMayType\(picked, part\.key, part\.el\)\) \{\s*beginTyping\(wordEl, part\.word, part\);\s*return;\s*\}/,
    'a tap types without the gate',
  );
  /* `picked` is only ever what the Maker said. */
  assert.deepEqual([...BRIDGE.matchAll(/\bpicked = /g)].length, 1);
  assert.match(BRIDGE, /if \(d\.t === RSVP_PICKED_MESSAGE\) \{\s*picked = typeof d\.picked === 'string' && d\.picked \? d\.picked : null;/);
  assert.match(TOOLS, /getAttribute\('data-stage-picked'\) \?\? null;\s*document\.querySelectorAll<HTMLIFrameElement>\('iframe\[data-rsvp-stage-frame\]'\)\.forEach\(\(f\) => \{\s*f\.contentWindow\?\.postMessage\(\{ source: 'setnayan-editor', t: RSVP_PICKED_MESSAGE, picked: now \}/);
  /* Each keystroke is told, never redrawn under the caret, and saved by the panel — one value, two doors. */
  assert.match(BRIDGE, /toMaker\(\{ t: RSVP_TYPED_MESSAGE, key: word, text: session\.sent \}\)/);
  assert.match(BRIDGE, /if \(typing\?\.el === el\) return;\s*draw\(el, text\);/);
  assert.match(STAGE, /new CustomEvent\(RSVP_WORD_TYPED_EVENT, \{ detail: \{ key: d\.key\.replace\(\/\^rsvp:\/, ''\), text \} \}\)/);
  assert.match(PANEL, /window\.addEventListener\(RSVP_WORD_TYPED_EVENT, onTyped\)/);
  assert.match(PANEL, /saveWordRef\.current\(d\.key as RsvpWordKey, d\.text\);/);
  /* In the new Maker a tapped word no longer opens a field elsewhere; everywhere else it still does. */
  assert.match(STAGE, /if \(d\.t === RSVP_PICK_MESSAGE && !stagesNow\.current\) \{/);
  assert.doesNotMatch(BRIDGE + STAGE, /rsvpEdit/);
  /* The panel steps aside while the words are typed, and the one bar brings it back. */
  assert.match(TOOLS, /else if \(d\.t === RSVP_TYPING_MESSAGE && d\.phase === 'start'\) setTyping\(true\);/);
  assert.match(STAGE, /data-type-bar="rsvp"/);
  assert.match(STAGE, /t: RSVP_TYPE_STOP_MESSAGE \}/);
});

/* ══ 5 · A TAB OPENS ITS SCREEN FROM THE TOP ═════════════════════════════════ */

function fakeWindow(at: number) {
  const win = {
    scrollY: at,
    scrollTo(to: { top: number }) {
      win.scrollY = to.top;
    },
  };
  return win;
}

test('5 · 🔝 a tab tap ENDS at the top — a screen left scrolled is put back, and held there', () => {
  let clock = 1_000;
  const win = fakeWindow(640);
  const top = createRsvpCanvasTop(win, () => clock);
  top.open();
  assert.equal(win.scrollY, 0, 'the screen opened where it was left');
  /* Something else moves it (a layout settling, a late scroll): it is put back. */
  win.scrollY = 300;
  assert.equal(top.onScroll(), true);
  assert.equal(win.scrollY, 0, 'the screen was taken away from its top');
  /* …for a moment only: after it, the page is nobody's to hold. */
  clock += HUB_TAB_HOLD_MS + 1;
  win.scrollY = 300;
  assert.equal(top.onScroll(), false);
  assert.equal(win.scrollY, 300);
});

test('5 · 🔝 only the COUPLE moves it: their touch, or picking a part, ends the hold at once', () => {
  for (const release of ['touch', 'pick'] as const) {
    const win = fakeWindow(500);
    const top = createRsvpCanvasTop(win, () => 0);
    top.open();
    if (release === 'touch') top.onTouch();
    else top.onPicked('f:rsvp|');
    win.scrollY = 220;
    top.onScroll();
    assert.equal(win.scrollY, 220, `after the couple’s ${release} the page was still pulled back`);
  }
  /* Letting a part go is not a reason to move the page. */
  const win = fakeWindow(500);
  const top = createRsvpCanvasTop(win, () => 0);
  top.open();
  top.onPicked(null);
  win.scrollY = 220;
  top.onScroll();
  assert.equal(win.scrollY, 0);
});

test('5 · WIRING: the tab lets the part go, the stage opens the screen from its top, and the label is the stage’s to say', () => {
  /* The tab: the picked part is let go FIRST (nothing is left to bring into view), then the screen is asked for. */
  const bar = TOOLS.slice(TOOLS.indexOf('data-stage-guest-tab={p.key}'));
  assert.match(bar, /if \(here\) return;\s*if \(rsvpOpen\) \{\s*deselect\(\);\s*goToScreen\(p\.key as RsvpStageScene\);\s*\} else \{/);
  assert.match(TOOLS, /const goToScreen = useCallback\(\(s: RsvpStageScene\) => \{\s*wanted\.current = s;\s*setScreen\(s\);\s*askRsvpStage\(\{ scene: s \}\);\s*\}, \[\]\);/);
  assert.doesNotMatch(TOOLS.slice(TOOLS.indexOf('const goToScreen'), TOOLS.indexOf('const goToScreen') + 260), /scrollTo|centrePart/, 'a tab tap scrolls the screen');
  /* The stage: the screen on show is said, and its frame is told to start at the top. */
  assert.match(
    STAGE,
    /useEffect\(\(\) => \{\s*window\.dispatchEvent\(new CustomEvent\(RSVP_STAGE_SCENE_EVENT, \{ detail: scene \}\)\);\s*frames\.current\[scene\]\?\.contentWindow\?\.postMessage\(\{ source: RSVP_BRIDGE_SOURCE, t: RSVP_TOP_MESSAGE \}, window\.location\.origin\);\s*\}, \[scene\]\);/,
  );
  assert.match(BRIDGE, /if \(d\.t === RSVP_TOP_MESSAGE\) \{\s*stopTyping\(\);\s*pageTop\.open\(\);\s*return;\s*\}/);
  assert.match(BRIDGE, /const onScroll = \(\) => \{\s*pageTop\.onScroll\(\);\s*\};/);
  assert.match(BRIDGE, /window\.addEventListener\('scroll', onScroll, \{ passive: true \}\)/);
  /* The label: the panel's screen follows the stage's word — never its own guess. */
  assert.match(TOOLS, /window\.addEventListener\(RSVP_STAGE_SCENE_EVENT, onScene\)/);
  assert.match(TOOLS, /if \(w && w !== s\) return askRsvpStage\(\{ scene: w \}\);\s*setScreen\(s\);/);
  assert.match(TOOLS, /if \(rsvpOpen\) return screen;/, 'the label is not the screen on show');
});

test('5 · the tabs read Form · When yes · When no, with the prototype’s icons — and the label over them says the SAME word', () => {
  assert.deepEqual(RSVP_STAGE_SCENES.map((s) => [s.key, s.tab, s.label]), [
    ['form', 'Form', 'RSVP form'],
    ['thanks', 'When yes', 'When yes'],
    ['decline', 'When no', 'When no'],
  ]);
  assert.match(TOOLS, /const RSVP_TAB_ICON: Record<RsvpStageScene, LucideIcon> = \{ form: Reply, thanks: Check, decline: X \};/);
  /* One word per screen, on the tab and in "You're editing · RSVP › Form" (measured 08 Oct: the label read "RSVP FORM"). */
  assert.match(TOOLS, /RSVP_STAGE_SCENES\.map\(\(s\) => \(\{ key: s\.key as string, label: s\.tab, tab: s\.tab, option: RSVP_STAGE_KEY as string \}\)\)/);
  assert.match(TOOLS, /\{rsvpTabIcon\(rsvpOpen, p\.key\)\}\s*<span className="max-w-full truncate">\{p\.tab\}<\/span>/);
  assert.match(TOOLS, /pageLabel = pages\.find\(\(p\) => p\.key === shownPage\)\?\.label/);
});

test('5 · 👆 a FINGER reaches the tabs: the row stands in the RSVP stage’s own column, under its screens — never under the layer', () => {
  /* Measured on the preview, 08 Oct (375 px): Form · When yes · When no sat at y 706–750, and the point at each
     one's centre was the RSVP frame — the row was drawn over the work area's foot, and the RSVP stage is a layer
     OVER the work area. Only a scripted click reached a tab. */
  const SHELL = src(`${L}/maker-shell.tsx`);
  const layerZ = Number(/className="absolute inset-0 z-(\d+) flex bg-cream" data-maker-rsvp-layer=""/.exec(SHELL)?.[1]);
  const barZ = Number(/'absolute inset-x-0 z-\[(\d+)\] border-t[^']*'/.exec(TOOLS)?.[1]);
  assert.ok(layerZ > 0 && barZ > 0, 'the layer or the row moved — re-point this guard');
  /* The reason, derived: while the layer is over the row's shell place, the shell is no place for the row here. */
  assert.ok(layerZ > barZ, 'the RSVP layer no longer covers the work area’s foot — this guard’s premise changed');
  assert.match(TOOLS, /const guestBarHost = rsvpOpen \? rsvpBarSlot : shellEl;/, 'on the RSVP stage the row is drawn into the shell, under the layer');
/* 🔁 RE-AIMED 2026-10-09 (commit 9, `the-play-button-previews.test.ts`): the guests' bar also stands in the whole-page preview (▶ held), where the rest of the toolbar is away — the pages are turned from it. */
  assert.match(TOOLS, /\{guestBarHost && \(!away \|\| previewing\)\s*\? createPortal\(\s*<nav[\s\S]*?<\/nav>,\s*guestBarHost,\s*\)/, 'the row is not drawn into its host');
  /* The host is the stage's own slot, and nothing else. */
  assert.deepEqual([...TOOLS.matchAll(/setRsvpBarSlot\(([^;]*)\);/g)].map((m) => m[1]), ['null', 'document.querySelector<HTMLElement>(`[${RSVP_STAGE_BAR_SLOT}]`)']);
  assert.equal(RSVP_STAGE_BAR_SLOT, 'data-rsvp-stage-bar-slot');
  /* THE STRUCTURE: the screens, then the slot — two children of ONE flex column, in that order, so the screens end
     above the row at every height of the lower third. */
  assert.match(
    STAGE,
    /page=\{\s*(?:\{\s*\}\s*)?<>\s*\{page\}\s*<div \{\.\.\.\{ \[RSVP_STAGE_BAR_SLOT\]: '' \}\} className="shrink-0 lg:hidden" \/>\s*<\/>\s*\}/,
    'the slot is not the sibling after the screens',
  );
  const PAGE = src(`${L}/maker-page.tsx`);
  const body = /<section[^>]*data-maker-page-body=""[^>]*className="([^"]*)"[^>]*>\s*\{page\}\s*<\/section>/.exec(PAGE);
  assert.ok(body, 'the page is no longer the direct child of the Maker page’s body');
  const column = body![1]!.split(/\s+/);
  for (const c of ['flex', 'flex-col', 'min-h-0', 'flex-1']) assert.ok(column.includes(c), `the body is not a shrinking flex column (${c})`);
  /* …the screens take what is left; the slot never shrinks; the row in it is in flow (no place of its own). */
  const screens = /<div className="([^"]*)" data-rsvp-stage-body="">/.exec(STAGE);
  assert.ok(screens && ['min-h-0', 'flex-1'].every((c) => screens[1]!.split(/\s+/).includes(c)), 'the screens do not give way to the row');
  assert.match(TOOLS, /style=\{rsvpOpen \? undefined : \{ bottom: 'calc\(var\(--maker-lt-h\) \+ env\(safe-area-inset-bottom\)\)'/, 'the row is placed over the page on the RSVP stage');
  assert.match(TOOLS, /className=\{rsvpOpen \? 'relative border-t/, 'the row is taken out of the column’s flow');
  /* The stage says it is up as it mounts — the panel finds the slot then (it may have mounted first). */
  assert.match(TOOLS, /if \(!isRsvpStageScene\(s\)\) return;\s*findSlot\(\);/);
});

/* ══ 6 · THE FRAME ═══════════════════════════════════════════════════════════ */

test('6 · the frame, its name tab and ↑ ↓ ✕ are drawn on the RSVP screen’s own frame — the one on show', () => {
  assert.equal(rsvpStageFrameSelector('thanks'), 'iframe[data-rsvp-stage-frame="thanks"]:not([hidden])');
  assert.match(STAGE, /data-rsvp-stage-frame=\{s\.key\}/);
  assert.match(STAGE, /hidden=\{scene !== s\.key\}/);
  assert.match(TOOLS, /const frameSel = rsvpOpen \? rsvpStageFrameSelector\(screen\) : SHOWN_FRAME;/);
  /* The RSVP stage is no longer shut out of the frame. */
  /* (Re-aimed 2026-10-09: the frame's edits are a hook now — `usePartEdits({ … })` — so the toolbar's Edit can draw
     the same move and remove in its last row; the same two values, as an object's fields instead of JSX props.) */
  assert.match(TOOLS, /usePartEdits\(\{\s*stage: stageKey,\s*picked: open && !cameraOpen \? picked : null,\s*frame: rsvpOpen \? frameSel : undefined,/);
  assert.doesNotMatch(TOOLS, /picked[=:] ?\{?open && !rsvpOpen/);
  assert.match(EDGES, /function partBox\(canvas: string, el\?: string \| null, frameSel: string = SHOWN_FRAME\): Box \| null \{\s*const frame = document\.querySelector<HTMLIFrameElement>\(frameSel\);/);
  assert.match(EDGES, /const b = partBox\(canvas, el, frame\);/);
  assert.match(EDGES, /visibleBand\(frame\)/);
  /* ↑ ↓ walk the screen in the order it is DRAWN, measured on that same frame; the picked part is brought into view on it. */
  assert.match(TOOLS, /makerPartTopOnScreen\(stageKey, k, frameSel\)/);
  assert.match(TOOLS, /centrePart\(pickedKey, pickedEl, frameSel\)/);
  /* The parts are read off the screen on show, and again when it says it is up. */
  assert.match(TOOLS, /setPresent\(readPresent\(frameSel\)\);/);
  assert.match(TOOLS, /d\.t === 'ready' \|\| d\.t === 'rsvpReady'/);
});

test('6 · a reply page is a FIXED page: its parts have the frame — never ＋, and nothing there moves or is taken off', () => {
  /* Nothing can be added to, moved on or taken off a reply page — and the ＋ sheet asks the work area, which stays
     mounted UNDER the RSVP stage: it would offer the Invitation's hidden scenes, a write to another stage. */
  /* 🔁 RE-AIMED 2026-10-09: the frame has no ↑ ↓ ✕, grip or 🗑 anywhere now (owner: *"on preview screen, you only
     select"*) — moving and removing are the toolbar's Edit › Earlier · Later · Remove, which read the SAME two
     answers (`canMove` / `canRemove`), so a reply page's three are grey. The gate's end is the frame's own end. */
  assert.deepEqual(MAKER_STAGE_KEYS.filter(makerStageIsFixedPages), [RSVP_STAGE_KEY]);
  assert.match(EDGES, /const fixedPages = makerStageIsFixedPages\(stage\);/);
  /* Both ＋ sit inside the one gate. */
  const gate = EDGES.indexOf('{fixedPages ? null : (');
  const gateEnd = EDGES.indexOf('{toast && !error ? (');
  assert.ok(gate > 0 && gateEnd > gate, '＋ is offered on a reply page');
  for (const add of ['data-part-add="above"', 'data-part-add="below"']) {
    const at = EDGES.indexOf(add);
    assert.ok(at > gate && at < gateEnd, `${add} is outside the fixed-page gate`);
  }
  assert.equal((EDGES.match(/data-part-add=/g) ?? []).length, 2, 'a third ＋ is drawn, outside the gate');
  assert.match(EDGES, /const canRemove = edgesOf\.remove && [^;]* && !fixedPages;/);
  assert.match(EDGES, /const canMove = edgesOf\.grip && [^;]* && !fixedPages;/);
  /* …and those two answers are all Edit's last row is offered. */
  assert.match(EDGES, /const canStep = \(dir: -1 \| 1\) => Boolean\(typeof document !== 'undefined' && canMove && /);
  assert.match(EDGES, /remove: canRemove \? \(\) => setRemoving\(true\) : null,/);
});

/* ══ 7 · A GUEST'S PAGES ARE UNTOUCHED ═══════════════════════════════════════ */

test('7 · every marker, every name and the bridge are behind the host-verified canvas — a guest is served none of it', () => {
  for (const page of [REPLY, ENTER]) {
    /* The canvas flag is set in ONE place: a verified host of this event. */
    assert.deepEqual([...page.matchAll(/\bcanvas = true;/g)].length, 1);
    assert.match(page, /if \(asksForHostCanvas\(search\)\) \{\s*const viewer = await getCurrentUser\(\);\s*if \(viewer && \(await loadHostMembership\([^)]*\)\)\) \{\s*canvas = true;/);
    for (const m of page.matchAll(/<span hidden data-maker-section=/g)) {
      const before = page.slice(Math.max(0, m.index! - 80), m.index!);
      assert.match(before, /\{canvas(?: && [^?{}]+)? \? $/, 'a marker is drawn for a guest');
    }
  }
  assert.match(REPLY, /\{canvas \? <RsvpCanvasBridge \/> : null\}/);
  assert.match(ENTER, /\{canvas && wordKeys \? \(\s*<RsvpCanvasBridge \/>\s*\) : null\}/);
  /* The form's wrapper and the split date · place line exist on the canvas only. */
  assert.match(REPLY, /function CanvasSection\(\{ on, children \}: \{ on: boolean; children: React\.ReactNode \}\) \{\s*return on \? <div className="space-y-4">\{children\}<\/div> : <>\{children\}<\/>;\s*\}/);
  assert.deepEqual([...REPLY.matchAll(/<CanvasSection on=\{(\w+)\}>/g)].map((m) => m[1]), ['canvas']);
  assert.deepEqual([...REPLY.matchAll(/canvasWhenWhere\(event\)/g)].length, 1);
  /* The door every guest is served is not edited for this: its masthead is named by the bridge, on the canvas. */
  assert.doesNotMatch(src('app/_components/door/door-shell.tsx'), /data-el=|data-maker-section/);
  assert.match(BRIDGE, /stampRsvpCanvas\(document\);/);
});

/* ══ 8 · EVERY LINE IS ITS OWN PART, AND THE GROUP IS ONE TOO ═══════════════════════════════════════════════════════
   Owner, on the live Maker's RSVP stage (2026-10-09, verbatim): "why is this grouped?" (the eyebrow, the question,
   both answers and the hint in ONE frame) · "shouldn't it be per element?" · and on the prototype: "i like this idea.
   heading message then the whole group?" — yes: each line a part, the whole group a part too.
   Executed on a page marked as the real ones are. Sabotages: a tap that stops reading the line → red; a line of
   another section accepted → red; the frame no longer finding a line → red. */

/** The form's section as the page marks it: the group, and its lines by name. */
function linedForm() {
  const line = (name: string, kids: Fake[] = [], tag = 'span') => el(tag, { [RSVP_LINE_ATTR]: name }, kids);
  const eyebrow = line('eyebrow');
  const question = line('question');
  const yesWord = el('span', { 'data-rsvp-word': 'rsvp:attending' });
  const yesRadio = el('input', { type: 'radio' });
  const yes = line('yes', [yesRadio, yesWord], 'label');
  const no = line('no', [el('span', { 'data-rsvp-word': 'rsvp:declined' })], 'label');
  const hint = line('hint', [], 'p');
  const stray = line('heading', [], 'p'); /* a line of ANOTHER section, wrongly inside this one */
  const meal = el('select');
  const fieldset = el('fieldset', {}, [el('legend', {}, [eyebrow, question]), yes, no]);
  const form = el('form', {}, [fieldset, el('div', {}, [meal]), hint, stray]);
  const group = el('div', {}, [form]);
  const page = door([marker('f:rsvp'), group], [el('p'), el('h1')]);
  return { ...page, group, form, fieldset, eyebrow, question, yes, yesWord, yesRadio, no, hint, stray, meal };
}

test('8 · a tap on a line picks THAT line of its part; a tap between the lines picks the group', () => {
  const s = linedForm();
  const hit = (t: Fake) => rsvpPartOfTap(t);
  for (const [node, name] of [[s.eyebrow, 'eyebrow'], [s.question, 'question'], [s.yes, 'yes'], [s.no, 'no'], [s.hint, 'hint']] as const) {
    assert.deepEqual({ key: hit(node)?.key, line: hit(node)?.line }, { key: 'f:rsvp', line: name }, `${name} did not pick itself`);
    assert.equal(makerPartOfTap(RSVP_STAGE_KEY, 'form', hit(node)!.key, hit(node)!.el), 'rsvp', 'a line left its part');
  }
  /* Anything INSIDE a line is that line — the couple's word in the answer, its radio. */
  assert.equal(hit(s.yesWord)?.line, 'yes');
  assert.equal(hit(s.yesRadio)?.line, 'yes');
  assert.equal(hit(s.yesWord)?.word, 'rsvp:attending', 'the word under the finger is no longer named');
  /* Between the lines — the form's own paper, a field that is no line — is THE GROUP: the part, with no line. */
  for (const node of [s.group, s.form, s.fieldset, s.meal]) {
    assert.deepEqual({ key: hit(node)?.key, line: hit(node)?.line }, { key: 'f:rsvp', line: null }, 'the group was not picked from between its lines');
  }
  /* A name that is not a line of THIS section picks the group — never a line that is not there. */
  assert.deepEqual({ key: hit(s.stray)?.key, line: hit(s.stray)?.line }, { key: 'f:rsvp', line: null });
  assert.equal(rsvpLineOf('f:rsvp', 'heading'), null);
  assert.equal(rsvpLineOf('f:yesnote', 'heading'), 'heading');
  assert.equal(rsvpLineOf('f:pass', 'save'), 'save');
  assert.equal(rsvpLineOf(null, 'question'), null);
  assert.equal(rsvpLineOf('f:hero', 'question'), null, 'the cover has no lines: its parts are the masthead’s own');
});

test('8 · the lines: each section names its own, each has a name, and the PAGES mark them', () => {
  assert.deepEqual(RSVP_SECTION_LINES, { 'f:rsvp': ['eyebrow', 'question', 'yes', 'no', 'hint'], 'f:yesnote': ['heading', 'message'], 'f:nonote': ['heading', 'message'], 'f:pass': ['save'] });
  for (const lines of Object.values(RSVP_SECTION_LINES)) for (const name of lines) assert.ok(RSVP_LINE_NAME[name], `${name} has no name`);
  assert.equal(RSVP_LINE_ATTR, 'data-rsvp-line');
  const marked = new Set(Object.values(RSVP_CANVAS_SECTIONS).flat() as string[]);
  for (const section of Object.keys(RSVP_SECTION_LINES)) assert.ok(marked.has(section), `${section} is not a section any screen marks`);
  /* THE PAGES: the form's lines in the widget, the hint where the one-at-a-time flow draws it, the two notes and the
     Save button on the landing. A plain attribute, the same for every guest — a name; it draws nothing. */
  const WIDGET = src('app/[slug]/_components/rsvp-widget.tsx');
  assert.match(WIDGET, /<span data-rsvp-line="eyebrow"/);
  assert.match(WIDGET, /<span data-rsvp-line="question"/);
  assert.match(WIDGET, /data-rsvp-line=\{option\.key === 'attending' \? 'yes' : option\.key === 'declined' \? 'no' : undefined\}/);
  assert.match(src('app/[slug]/_components/rsvp-one-at-a-time.tsx'), /<p data-rsvp-line="hint"/);
  assert.equal((ENTER.match(/data-rsvp-line="heading"/g) ?? []).length, 2, 'When yes and When no each name their heading');
  assert.equal((ENTER.match(/data-rsvp-line="message"/g) ?? []).length, 2, 'When yes and When no each name their message');
  /* The Save button's name is on a box AROUND it: a button is inert on the canvas, so the tap lands on what holds it. */
  assert.match(ENTER, /<div data-rsvp-line="save">/);
  assert.ok(RSVP_CANVAS_CONTROLS.split(',').map((c) => c.trim()).includes('button'));
  /* Never `data-el`: that name is the Event Hub's own (the cover's parts and their looks). */
  for (const name of ['question', 'hint', 'yes', 'no', 'save']) assert.doesNotMatch(WIDGET + ENTER, new RegExp(`data-el="${name}"`));
});

test('8 · WIRING: the frame, its name, the caption and the panel follow the LINE; the group keeps the part’s own', () => {
  /* The page sends the line with the pick. */
  assert.match(BRIDGE, /\.\.\.\(part\.line \? \{ line: part\.line \} : \{\}\)/);
  /* A line is picked only WITH its part: another part, a tab, the ground let it go with nothing to reset. */
  assert.match(TOOLS, /const rsvpLine = rsvpOpen && picked && lineAtPart\?\.part === picked \? lineAtPart\.line : null;/);
  /* The frame is drawn ON the line and wears its name… */
  assert.match(TOOLS, /const rsvpLineName = rsvpLine \? \(RSVP_LINE_NAME\[rsvpLine\] \?\? rsvpLine\) : rsvpCard \? RSVP_CARD_NAME : null;/);
  assert.match(TOOLS, /line: rsvpLine && rsvpLineName \? \{ key: rsvpLine, name: rsvpLineName \} : null,/);
  assert.match(EDGES, /const el = picked \? \(line\?\.key \?\? MAKER_PARTS\[picked\]\.el \?\? null\) : null;/);
  assert.match(EDGES, /\[data-el="\$\{CSS\.escape\(el\)\}"\], \[data-rsvp-line="\$\{CSS\.escape\(el\)\}"\]/);
  assert.match(EDGES, /\{line\?\.name \?\? name \?\? label\}/);
  /* …"You're editing" ends on it, and the stage's own panel is told which line. */
  assert.match(TOOLS, /\(x\): x is string => Boolean\(x\),\s*\);\s*if \(rsvpLineName && picked\) \{[^}]*linePieces\.push\(rsvpLineName\);\s*\}/, 'the line is not the LAST piece of "You’re editing" — the piece that is never cut');
  assert.match(TOOLS, /setStagePanelNow\(\{ picked, quiet, about, line: rsvpLine \}\);/);
  assert.match(src(`${L}/stage-panel/store.ts`), /\(next\.line \?\? null\) === \(now\.line \?\? null\)/, 'a new line on the same part would not reach the panel');
});
