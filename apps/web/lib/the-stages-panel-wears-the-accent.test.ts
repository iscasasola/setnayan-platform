/**
 * the-stages-panel-wears-the-accent.test.ts — IN THE STAGES PANEL, WHAT IS ON, PICKED OR TAPPABLE IS THE APP'S ACCENT,
 * AND EVERY ACTION IS THE APP'S ACTION BUTTON.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9 and its APPROVED block): *"we want the whole app to be adaptive to the
 * same feel"* · *"if we change our color to blue, it will be easy to change the button colors"* · *"Dropdown — Chevron
 * should be teracota color?"* · *"pill selector should have a consistent color"* · kind 21, "the five colour circles".
 *
 * Held, each where it can be EXECUTED:
 *   (1) ONE LINE REACHES THE PANEL — the panel's own `--sp-cta` (the picked card's ring, the slider's fill, every
 *       `var(--sp-cta)`) and its wash read `--sn-accent`; with the accent swapped to a blue in a stand-in they come
 *       out blue. What the panel still writes by hand is thirteen neutrals, by name — a fourteenth is a failure.
 *   (2) THE DOOR, THE CONFIRM, DONE — rendered: Style › Look's door is the app's SECOND action button (never an ink
 *       bar), 44 px, icon and word; the remove confirm's two answers are the second button and the DELETE button (the
 *       house danger token, never a second terracotta); the typing bar's Done and the colour sheet's Use are the MAIN
 *       button — and the main button's fill and word are the accent's two tokens.
 *   (3) A DIRECTION IS A DROPDOWN, GROW | SHRINK IS THE PILL — rendered: Move draws ONE dropdown (a ▾ that opens),
 *       no button per arrow; Size draws the app's pill selector, its picked choice in the accent.
 *   (4) COLOUR CIRCLES — rendered: a swatch is a circle on a 44-px tap, the picked one ringed in the accent; Text and
 *       Background draw no swatch of their own.
 *   (5) THE MARKS — the dropdown's ▾ is the template's (nothing repaints it gold); the frame, its name, ＋ ↑ ↓ ✕ and
 *       the grip are the accent's fill and ink; 🗑 is the danger token.
 *   (6) THE WATCH — no file of the panel writes the terracotta, the red or an ink button by hand.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { SP_DD_BUTTON, SP_SWATCH, SP_SWATCH_FACE, SP_SWATCH_MORE, SP_SWATCH_ON, STAGE_PANEL_VARS, STAGE_TAP_TARGETS } from './maker-stage-room';
import { phoneHeightPx } from './maker-phone-room';

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
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const PANEL = `../${L}/stage-panel`;
const CSS = read('app/globals.css');

type Vars = Record<string, string>;
const varsOf = (block: string): Vars => Object.fromEntries([...block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
const resolve = (value: string, vars: Vars, depth = 0): string => {
  assert.ok(depth < 8, `a variable loops: ${value}`);
  return value.replace(/var\((--[a-z0-9-]+)\)/g, (_, name: string) => {
    assert.ok(name in vars, `${name} is not set`);
    return resolve(vars[name]!, vars, depth + 1);
  });
};
const ROOT = CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('html.dark {'));
const THE_ONE_LINE = '--sn-accent: var(--color-mulberry);';
const BLUE = '37 99 235';
assert.equal(ROOT.split(THE_ONE_LINE).length - 1, 1, 'anti-vacuity: the accent’s one line was not found');
const LIGHT = varsOf(ROOT);
const BLUED = varsOf(ROOT.replace(THE_ONE_LINE, `--sn-accent: ${BLUE};`));

/* ── (1) one line reaches the panel ───────────────────────────────────── */

/** The panel's own names for a colour, as `stage-tools.tsx` sets them on the page. */
const SP: Vars = Object.fromEntries(STAGE_PANEL_VARS.split(';').map((d) => [d.slice(0, d.indexOf(':')), d.slice(d.indexOf(':') + 1)]));

test('(1) the panel’s “on” colour and its wash READ the accent — swap the one line and both come out blue; thirteen neutrals are all it writes', () => {
  assert.equal(Object.keys(SP).length, 16, 'anti-vacuity: the panel’s colours were not read');
  for (const vars of [LIGHT, BLUED]) {
    const accent = resolve(vars['--sn-accent']!, vars);
    assert.equal(resolve(SP['--sp-cta']!, vars), `rgb(${accent})`, 'the picked ring / slider fill does not follow the accent');
    assert.equal(resolve(SP['--sp-cta-wash']!, vars), `rgb(${accent} / .1)`, 'the wash is a colour of its own');
  }
  assert.equal(resolve(SP['--sp-cta']!, LIGHT), 'rgb(194 78 37)');
  assert.equal(resolve(SP['--sp-cta']!, BLUED), `rgb(${BLUE})`, 'anti-vacuity: the swap did not move the answer');
  assert.equal(resolve(SP['--sp-bad']!, LIGHT), 'rgb(179 38 30)', 'the panel’s red is not the house danger token');
  /* What is still written by hand: grounds, inks, hairlines and the gold — never "on". */
  const byHand = Object.entries(SP).filter(([, v]) => /#[0-9a-f]{3,8}\b/i.test(v)).map(([k]) => k.replace('--sp-', ''));
  assert.deepEqual(byHand, ['page', 'paper', 'ink', 'ink2', 'mute', 'gold', 'gold-soft', 'gold-wash', 'line', 'line2', 'pill', 'pill-on', 'ok']);
  /* The panel puts those names on the page from this one string. */
  assert.match(read(`${L}/stage-tools.tsx`), /`html:has\(\[data-stage-tools\]\)\{\$\{STAGE_PANEL_VARS\}\}`/);
});

/* ── (2) the door, the confirm, Done ──────────────────────────────────── */

const classOf = (html: string, tag: RegExp): string[] => (tag.exec(html)?.[1] ?? '').replace(/&amp;/g, '&').split(/\s+/);

test('(2a) Style › Look’s door is the app’s SECOND action button — 44 px, icon and word, a link when it leaves the Maker', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { QuietBar } = await import(`${PANEL}/kit`);
  const { setStagePanelNow } = await import(`${PANEL}/store`);
  const AB = await import('../components/action-button');
  const draw = () => renderToStaticMarkup(React.createElement(QuietBar));

  setStagePanelNow({ picked: 'gifts', quiet: { kind: 'studio', words: 'Edit the E-Gifts', open: () => {} }, about: null });
  const studio = draw();
  const cls = classOf(studio, /<button[^>]*class="([^"]*)"/);
  for (const c of AB.actionButtonClass('neutral').split(' ')) assert.ok(cls.includes(c), `the door is not the shared second button (no “${c}”): ${cls.join(' ')}`);
  assert.ok(!cls.includes('ab-main'), 'the door is drawn as the screen’s main button');
  assert.match(studio, /<svg[\s\S]*?<span class="lbl">Edit the E-Gifts<\/span>/, 'icon and word');
  assert.ok(cls.includes('!h-11'), 'the door is not 44 px to the thumb');
  assert.doesNotMatch(studio, /sp-ink|bg-ink|›/, 'an ink bar, or a “›” tail, is back');

  setStagePanelNow({ picked: 'date', quiet: { kind: 'suppliers', words: 'Change the date in Suppliers', href: '/dashboard/x/vendors' }, about: null });
  const out = draw();
  assert.match(out, /<a[^>]*class="ab ab-neutral[^"]*"[^>]*href="\/dashboard\/x\/vendors"|<a[^>]*href="\/dashboard\/x\/vendors"[^>]*class="ab ab-neutral/, 'the Suppliers door is not the same button, as a link');
  setStagePanelNow({ picked: null, quiet: null, about: null });
  assert.equal(draw(), '', 'anti-vacuity: with no door the bar still draws');
  /* The panel's old ink bar is gone from the room's measured strings. */
  assert.ok(!('STAGE_QUIET_ROW' in STAGE_TAP_TARGETS));
});

test('(2b) the remove confirm answers with the second button and the DELETE button; Done and Use are the MAIN button — and the main button is the accent', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const AB = await import('../components/action-button');
  const Dot = () => React.createElement('svg');
  /* The confirm (`RemovePartSheet`): its source, between its name and the Reveal's block. */
  const sheet = read(`${L}/add-part-sheet.tsx`);
  const confirm = sheet.slice(sheet.indexOf('function RemovePartSheet('), sheet.indexOf('export function revealStageOf('));
  assert.ok(confirm.length > 600, 'anti-vacuity: the confirm was not found');
  assert.equal((confirm.match(/<ActionButton tone="neutral" icon=\{Check\} label="Keep it" onClick=\{onClose\}/g) ?? []).length, 2, 'Keep it is not the second button (both shapes of the confirm)');
  assert.match(confirm, /<ActionButton tone="danger" icon=\{Trash2\} label=\{w\.yes\} onClick=\{onYes\}/, 'the yes answer is not the delete button');
  assert.doesNotMatch(confirm, /<button\b|bg-danger-|bg-ink/, 'a hand-made answer is back');
  /* …and what those tones paint: delete is the house danger token, outlined — never filled like the main verb. */
  const del = renderToStaticMarkup(React.createElement(AB.ActionButton, { tone: 'danger', icon: Dot, label: 'Remove' }));
  assert.match(del, /class="ab ab-danger"/);
  assert.match(CSS, /:is\(button, a\)\.ab\.ab-danger \{ --ab-tone: var\(--color-danger\); \}/);

  /* Done (the typing bar) and Use (the colour sheet). */
  const bar = read(`${E}/type-in-place.tsx`);
  const keys = bar.slice(bar.indexOf('if (stagesStudio && !p.inline'), bar.indexOf('if (p.inline) {'));
  assert.match(keys, /<ActionButton tone="brand" main icon=\{Check\} label="Done" onClick=\{p\.onClose\} \/>/, 'Done is not the main button');
  assert.doesNotMatch(keys, /#[0-9a-fA-F]{6}\b/, 'the typing bar writes a colour');
  const picker = read('app/dashboard/[eventId]/studio/mood-board/_components/colour-picker-sheet.tsx');
  assert.match(picker, /<ActionButton tone="brand" main icon=\{Check\} label="Use" disabled=\{!typed\}/, 'Use is not the main button');
  /* …and the colour picked NOW is marked in the accent: its ring, its row, its tick. (The "AA ✗" badge is a state
     badge and keeps its own colour.) */
  assert.match(picker, /\$\{on \? 'ring-2 ring-sn-accent ring-offset-2 ring-offset-white' : ''\}/);
  assert.match(picker, /\$\{on \? 'bg-sn-accent\/10' : ''\}/);
  assert.match(picker, /\{on \? <Check aria-hidden className="ml-auto h-4 w-4 shrink-0 text-sn-accent"/);
  assert.doesNotMatch(picker, /mulberry|bg-ink px-4|ring-terracotta|bg-terracotta-700\/10/, 'the colour sheet marks a pick, or draws a button, in a colour of its own');

  /* THE MAIN BUTTON IS THE ACCENT: its fill reads `--sn-accent`, its word `--sn-on-accent` — swap the line, it is blue. */
  const main = renderToStaticMarkup(React.createElement(AB.ActionButton, { tone: 'brand', icon: Dot, label: 'Done', main: true }));
  assert.match(main, /class="ab ab-brand ab-main"/);
  const brand = /:is\(button, a\)\.ab\.ab-brand \{ --ab-tone: ([^;]+);/.exec(CSS)?.[1] ?? '';
  const fill = /:is\(button, a\)\.ab\.ab-main \{\s*background: rgb\(var\(--ab-tone\)\);/.test(CSS);
  assert.ok(fill, 'the main button’s fill is not its tone');
  assert.equal(resolve(brand, LIGHT), '194 78 37');
  assert.equal(resolve(brand, BLUED), BLUE, 'the main button does not follow the accent');
  const word = /:is\(button, a\)\.ab\.ab-brand\.ab-main,\s*html\.dark :is\(button, a\)\.ab\.ab-brand\.ab-main \{ color: ([^;]+); \}/.exec(CSS)?.[1] ?? '';
  assert.equal(word, 'rgb(var(--sn-on-accent))', 'the main button’s word is not the ink that reads on the accent');
});

/* ── (3) a direction is a dropdown; Grow | Shrink is the pill ─────────── */

test('(3) Move draws ONE dropdown (no button per arrow) and Size draws the app’s pill selector, the picked one in the accent', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StageAnimate } = await import(`${PANEL}/stage-animate`);
  const { setStageAnimatePhase } = await import(`${PANEL}/store`);
  const P = await import('../app/_components/pill-selector');
  const dd = { value: 'auto', options: [{ key: 'auto', label: 'Auto' }], onPick: () => {} };
  const draw = (phase: 'in' | 'out', fx: Record<string, unknown> | null) => {
    setStageAnimatePhase(phase);
    return renderToStaticMarkup(React.createElement(StageAnimate, { how: dd, inFx: fx, outFx: fx, onIn: () => {}, onOut: () => {}, does: dd, timing: dd }));
  };
  for (const end of ['in', 'out'] as const) {
    const html = draw(end, { move: 'below', size: 'grow' });
    const move = html.slice(html.indexOf(`data-stage-effect="${end}-move"`), html.indexOf(`data-stage-effect="${end}-size"`));
    /* ONE control beside the switch, and it is a dropdown: a button that says it opens a list, wearing the ▾. */
    assert.match(move, new RegExp(`data-stage-dd="${end}-move-dir"`), `${end}: Move has no dropdown`);
    assert.equal((move.match(/aria-haspopup="listbox"/g) ?? []).length, 1, `${end}: Move’s direction is not one dropdown`);
    assert.equal((move.match(/<button\b/g) ?? []).length, 2, `${end}: Move draws more than its switch and its dropdown`);
    assert.match(move, new RegExp(`>${end === 'in' ? 'From' : 'To'}</span>`), 'the dropdown does not say From / To');
    assert.match(move, /the bottom/, 'the dropdown does not say the way in words');
    assert.doesNotMatch(html, /data-stage-dir=/, 'a button per arrow is back');
    /* Size: the shared selector, two choices, the picked one the accent — and nothing ink. */
    const size = html.slice(html.indexOf(`data-stage-effect="${end}-size"`));
    assert.match(size, new RegExp(`role="group" aria-label="Size ${end}" data-pill-selector="${end}-size"`));
    const grow = classOf(size, /<button[^>]*aria-pressed="true"[^>]*class="([^"]*)"[^>]*data-seg="grow"|<button[^>]*data-seg="grow"[^>]*class="([^"]*)"/);
    const picked = /<button type="button" aria-pressed="true" class="([^"]*)" data-seg="grow"/.exec(size)?.[1]?.split(/\s+/) ?? grow;
    for (const c of P.PILL_ON_CLASS.split(' ')) assert.ok(picked.includes(c), `${end}: the picked size is not the accent (no “${c}”)`);
    assert.match(size, /<button type="button" aria-pressed="false" class="[^"]*" data-seg="shrink"/);
    assert.doesNotMatch(html, /--sp-ink\)\] bg-\[var\(--sp-ink\)\]|bg-\[var\(--sp-ink\)\] text-white/, 'an ink-black picked button is back');
  }
  /* Off: no dropdown, no selector — the row says so in words. */
  const off = draw('in', null);
  assert.doesNotMatch(off, /move-dir|data-pill-selector/);
  assert.match(off, /Stays in place[\s\S]*Same size/);
  /* A stored "Settle back" is neither: nothing is picked. */
  assert.doesNotMatch(draw('out', { size: 'settle' }), /aria-pressed="true"[^>]*data-seg=/);
  setStageAnimatePhase('in');
});

/* ── (4) colour circles ───────────────────────────────────────────────── */

test('(4) a swatch is a CIRCLE on a 44-px tap, the picked one ringed in the accent — and Text and Background draw none of their own', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { Swatch, SwatchMore } = await import(`${PANEL}/kit`);
  const face = React.createElement('i');
  const on = renderToStaticMarkup(React.createElement(Swatch, { on: true, label: 'Colour', face, onPick: () => {}, data: { 'data-x': 'a' } }));
  const offHtml = renderToStaticMarkup(React.createElement(Swatch, { on: false, label: 'Colour', face, onPick: () => {}, data: { 'data-x': 'a' } }));
  const faceOn = classOf(on, /<span aria-hidden="true" class="([^"]*)"/);
  for (const c of ['h-8', 'w-8', 'rounded-full']) assert.ok(faceOn.includes(c), `the swatch is not a 32-px circle (no “${c}”)`);
  assert.ok(!faceOn.some((c) => /^rounded-(?:sm|md|lg|xl)$/.test(c)), 'the swatch is a rounded square');
  assert.ok(faceOn.includes(SP_SWATCH_ON) && /rgb\(var\(--sn-accent\)\)/.test(SP_SWATCH_ON), 'the picked circle is not ringed in the accent');
  assert.ok(!classOf(offHtml, /<span aria-hidden="true" class="([^"]*)"/).includes(SP_SWATCH_ON), 'a circle that is not picked wears the ring');
  assert.match(on, /aria-pressed="true"/);
  assert.ok((phoneHeightPx(SP_SWATCH, 812) ?? 0) >= 44, 'the tap around a circle is under 44 px');
  assert.ok(SP_SWATCH_FACE.split(' ').includes('sn-press-ring'), 'a press does not ring the circle');
  const more = renderToStaticMarkup(React.createElement(SwatchMore, { open: false, onOpen: () => {}, data: { 'data-x': 'more' } }));
  assert.match(more, /aria-haspopup="dialog"[^>]*aria-expanded="false"[^>]*aria-label="Any colour"/);
  assert.ok(SP_SWATCH_MORE.split(' ').includes('rounded-full') && SP_SWATCH_MORE.split(' ').includes('text-sn-accent'), '“+” is not a circle with its mark in the accent');
  for (const f of ['stage-text.tsx', 'stage-background.tsx']) {
    const src = read(`${L}/stage-panel/${f}`);
    assert.match(src, /<Swatch\b/, `${f} does not draw the shared circle`);
    assert.match(src, /<SwatchMore\b/, `${f} draws its own “+”`);
    assert.doesNotMatch(src, /SP_SWATCH|rounded-md border border-black\/10|border-dashed/, `${f} still draws a swatch by hand`);
  }
});

/* ── (5) the marks ────────────────────────────────────────────────────── */

test('(5) the ▾ is the dropdown’s own accent; the frame and its chips are the accent’s fill and ink; 🗑 is the danger token', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { Dd } = await import(`${PANEL}/kit`);
  const M = await import(`../${E}/pick-menu-place`);
  assert.doesNotMatch(SP_DD_BUTTON, /svg|gold/, 'the panel repaints the dropdown’s ▾');
  const html = renderToStaticMarkup(React.createElement(Dd, { small: 'Width', label: 'Width', data: 'w', value: 'a', options: [{ key: 'a', label: 'Framed' }], onPick: () => {} }));
  const arrow = classOf(html, /<svg[^>]*class="([^"]*)"/);
  for (const c of M.pickArrowClass(false).split(' ').filter(Boolean)) assert.ok(arrow.includes(c), `the ▾ lost “${c}”`);
  assert.ok(arrow.includes('text-sn-accent'));
  /* Gallery ›, Upload + and the stage ▾: the same mark. */
  assert.equal((read(`${L}/stage-panel/stage-background.tsx`).match(/h-3\.5 w-3\.5 shrink-0 text-sn-accent/g) ?? []).length, 2);
  assert.match(read(`${L}/stage-item-menu.tsx`), /<ChevronDown aria-hidden className=\{`h-3\.5 w-3\.5 shrink-0 text-sn-accent /);

  const edges = read(`${L}/add-part-sheet.tsx`);
  assert.match(edges, /export const PART_ACCENT = 'bg-sn-accent text-sn-on-accent';/);
  assert.match(edges, /export const PART_OUTLINE = 'absolute rounded-lg shadow-\[0_0_0_2px_rgb\(var\(--sn-accent\)\),0_0_0_7px_rgb\(var\(--sn-accent\)\/\.14\)\]';/);
  /* Every filled mark on the frame names the one pair: ↑ ↓ ✕, ＋, the name, the grip. */
  assert.equal((edges.match(/\$\{PART_ACCENT\}/g) ?? []).length, 4, 'a mark on the frame has a fill of its own');
  assert.match(edges, /data-part-outline=""\s+className=\{PART_OUTLINE\}/);
  assert.match(edges, /absolute h-1 rounded-full bg-sn-accent/, 'the drop line is not the accent');
  assert.match(edges, /border-\[rgb\(var\(--color-danger\)\)\] bg-white text-\[rgb\(var\(--color-danger\)\)\]/, '🗑 is not the house danger token');
  assert.equal((edges.match(/shrink-0 text-sn-accent" strokeWidth=\{2\.4\}/g) ?? []).length, 2, 'the ＋ sheet’s marks are not the accent');
});

/* ── (6) the watch ────────────────────────────────────────────────────── */

test('(6) no file of the panel writes the terracotta, the red or an ink button by hand', () => {
  const FILES = [
    `${L}/stage-panel/kit.tsx`,
    `${L}/stage-panel/stage-animate.tsx`,
    `${L}/stage-panel/stage-text.tsx`,
    `${L}/stage-panel/stage-background.tsx`,
    `${L}/stage-panel/stage-style.tsx`,
    `${L}/stage-panel/stage-arrange.tsx`,
    `${L}/stage-panel/style-carousel.tsx`,
    `${L}/add-part-sheet.tsx`,
    `${L}/stage-item-menu.tsx`,
  ];
  const BY_HAND = [
    { what: 'the terracotta as a hex', re: /#C24E25|194,\s*78,\s*37/i },
    { what: 'the red as a hex', re: /#B3261E/i },
    { what: 'the colour name `mulberry`', re: /mulberry/ },
    { what: 'the gold `terracotta-*` family or the blush `danger-*` as a fill or ink', re: /(?:bg|text|border|ring)-(?:terracotta|danger)(?:-\d+)?\b/ },
    { what: 'an ink-black picked face', re: /bg-\[var\(--sp-ink\)\]|bg-\[#2C2A29\]/i },
    { what: 'white words written on a fill (the ink on the accent is `text-sn-on-accent`)', re: /bg-sn-accent[^'"`]*\btext-white\b|\btext-white\b[^'"`]*bg-sn-accent/ },
  ];
  for (const f of FILES) {
    const src = read(f);
    assert.ok(src.length > 300, `anti-vacuity: ${f} was not read`);
    for (const { what, re } of BY_HAND) {
      const line = src.split('\n').find((l) => re.test(l));
      assert.equal(line, undefined, `${f} writes ${what}: ${line?.trim().slice(0, 150)}`);
    }
  }
  /* …and the watch can see each. */
  for (const [sample, n] of [['bg-[#C24E25] text-white', 1], ['border-[#B3261E]', 1], ['text-mulberry', 1], ['bg-danger-600', 1], ['bg-[var(--sp-ink)] text-white', 1], ['bg-sn-accent text-white', 1], ['bg-sn-accent text-sn-on-accent', 0]] as const) {
    assert.equal(BY_HAND.filter(({ re }) => re.test(sample)).length, n, `anti-vacuity: the watch misreads "${sample}"`);
  }
});
