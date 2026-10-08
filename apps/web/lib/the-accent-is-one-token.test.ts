/**
 * the-accent-is-one-token.test.ts — THE APP'S ACCENT IS ONE SETTING, NAMED BY ITS JOB.
 *
 * Owner, 2026-10-08, right after approving the template gallery: *"if we change
 * our color to blue, it will be easy to change the button colors"*
 * (`INTERACTION_RULES.md` § 9, "Our colour is ONE setting"). Every template takes
 * its "on / picked / tappable" colour from ONE token (`--sn-accent`), and the
 * words on it from another (`--sn-on-accent`) — never from a colour written in
 * the template.
 *
 * Held, each where it can be EXECUTED:
 *   (1) THE WATCH — a template file contains no `mulberry`, no hex colour and no
 *       `text-white`: the list below is the scope; a later builder EXTENDS it as
 *       each kind becomes a shared template (never shortens it);
 *   (2) THE INK STILL READS — the two token values keep 4.5:1, computed from the
 *       numbers in `globals.css` (light, and the dormant dark block); a pale
 *       accent is told its ink must change;
 *   (3) ONE LINE REACHES THEM ALL — the ONE line is swapped to a blue in a
 *       stand-in copy of the stylesheet, and every template's "on" colour is
 *       resolved through the real Tailwind config and that stylesheet: each one
 *       comes out blue (and terracotta before the swap).
 *       ⚠ This is RESOLUTION BY READING — class → Tailwind colour → CSS variable →
 *       value — not a browser painting a pixel. It proves no template holds a
 *       colour of its own between the setting and the screen;
 *   (4) THE GUEST'S EVENT HUB IS NOT REACHED — nothing under `app/[slug]` names
 *       the token or a template, and the hub's own themes never set or read it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';

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
const CSS = read('app/globals.css');

/**
 * THE TEMPLATE FILES — one source per kind of control (`INTERACTION_RULES.md` § 9). Whole files: nothing in them may
 * write the accent. EXTEND this list when a kind becomes a shared template; never take a file off it to go green.
 */
const TEMPLATE_FILES = [
  'app/_components/pill-selector.tsx', // 1 · Pill selector
  'app/_components/pill-thumb.tsx', //     its thumb
  'app/_components/press-feel.tsx', //     the one press, and its ring
  `${E}/background-cards.tsx`, //          5 · Style card (and its one status line)
  `${E}/pick-menu.tsx`, //                 2 · Dropdown
  `${E}/pick-menu-place.ts`, //                its looks
  'app/_components/timeline-row.tsx', //   13 · Timeline row (and its three list states)
  'app/_components/timeline-states.tsx', // 13 · …its loading and problem states (their own small file)
  'app/_components/ticker.tsx', //             its ticker, and the pill + pop that opens it
  'app/_components/switch-track.tsx', //   3 · Switch (its drawing; the colours are `.sn-switch` in globals.css)
  'app/_components/form-row.tsx', //       6 · Form row / 10 · Field (typed · chosen · on/off · a fact shown)
  'app/_components/explain.tsx', //        7 · ⓘ explanation (the centred popup on a phone, the note on a computer)
  'app/_components/fold.tsx', //           19 · Fold
] as const;

/**
 * TEMPLATE LOOKS that live inside a bigger file which is not itself a template (it holds a panel's whole skin): the
 * named constants are watched, not the file.
 */
const TEMPLATE_CONSTANTS: Array<{ file: string; names: string[] }> = [
  { file: 'lib/maker-stage-room.ts', names: ['STAGE_TOOL_FACE', 'SP_PHASE'] }, // the pill selector, drawn for the Stages tools and Phases
];

/** The stylesheet's template rules, by selector — each must take its "on" from the token. */
const TEMPLATE_RULES = [".sn-switch[data-on='true'],"];

const WRITTEN = [
  { what: 'the colour name `mulberry`', re: /mulberry/ },
  { what: 'a hex colour', re: /#[0-9a-fA-F]{3,8}\b/ },
  { what: '`text-white` (the ink on the accent is `text-sn-on-accent`)', re: /\btext-white\b/ },
  { what: 'the kit’s gold `accent` class (the app’s accent is `sn-accent`)', re: /(?:^|[\s"'`:])(?:bg|text|ring|border)-accent(?![\w-])/ },
];

/* ── (1) the watch ────────────────────────────────────────────────────── */

test('(1) no template writes the accent — no `mulberry`, no hex, no `text-white` in a template file', () => {
  for (const file of TEMPLATE_FILES) {
    const src = read(file);
    assert.ok(src.length > 200, `anti-vacuity: ${file} was not read`);
    for (const { what, re } of WRITTEN) {
      const line = src.split('\n').find((l) => re.test(l));
      assert.equal(line, undefined, `${file} writes ${what}: ${line?.trim().slice(0, 140)}`);
    }
  }
  // The named looks inside bigger files.
  for (const { file, names } of TEMPLATE_CONSTANTS) {
    const src = read(file);
    const found = names.filter((n) => new RegExp(`export const ${n}\\b`).test(src));
    assert.ok(found.length >= 1, `anti-vacuity: none of ${names.join(', ')} is in ${file}`);
  }
  const room = read('lib/maker-stage-room.ts');
  const faces = room.split('\n').filter((l) => /aria-pressed:(bg|text)-/.test(l));
  assert.equal(faces.length, 2, 'anti-vacuity: the Stages tools’ and Phases’ picked faces were not found');
  for (const l of faces) {
    assert.match(l, /aria-pressed:bg-sn-accent\b/, 'a pill face’s fill is not the accent');
    assert.match(l, /aria-pressed:text-sn-on-accent\b/, 'a pill face’s words are not the ink on the accent');
    assert.doesNotMatch(l, /mulberry|aria-pressed:text-white/, 'a pill face writes its own colour');
  }
  // The stylesheet's template rules.
  for (const sel of TEMPLATE_RULES) {
    const at = CSS.indexOf(sel);
    assert.ok(at > 0, `anti-vacuity: \`${sel}\` is not in the stylesheet`);
    const rule = CSS.slice(at, CSS.indexOf('}', at));
    assert.match(rule, /background-color: rgb\(var\(--sn-accent\)\);/, `${sel} does not take its colour from the accent`);
    assert.doesNotMatch(rule, /mulberry|#[0-9a-fA-F]{3,8}\b/);
  }
  // …and the watch can see: a line that writes each of the three is caught.
  for (const [sample, n] of [['bg-mulberry text-white', 2], ['color: #C24E25;', 1], ['bg-accent', 1], ['ring-sn-accent text-sn-on-accent', 0]] as const) {
    assert.equal(WRITTEN.filter(({ re }) => re.test(sample)).length, n, `anti-vacuity: the watch misreads "${sample}"`);
  }
});

/* ── (2) the ink still reads ──────────────────────────────────────────── */

type Vars = Record<string, string>;
/** The custom properties declared in one block of the stylesheet. */
function varsOf(block: string): Vars {
  const out: Vars = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}
/** A value with every `var(--x)` it names followed to the end. */
function resolve(value: string, vars: Vars, depth = 0): string {
  assert.ok(depth < 8, `a variable loops: ${value}`);
  return value.replace(/var\((--[a-z0-9-]+)\)/g, (_, name: string) => {
    assert.ok(name in vars, `${name} is not set`);
    return resolve(vars[name]!, vars, depth + 1);
  });
}
const triplet = (v: string): [number, number, number] => {
  const m = /^(\d{1,3}) (\d{1,3}) (\d{1,3})$/.exec(v.trim());
  assert.ok(m, `not three numbers: "${v}"`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
const lum = ([r, g, b]: [number, number, number]) => {
  const c = (x: number) => (x / 255 <= 0.03928 ? x / 255 / 12.92 : ((x / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};
const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

const lightAt = CSS.indexOf(':root {');
const darkAt = CSS.indexOf('html.dark {');
assert.ok(lightAt > 0 && darkAt > lightAt, 'anti-vacuity: the stylesheet’s two root blocks were not found');
const LIGHT = varsOf(CSS.slice(lightAt, darkAt));
const DARK = { ...LIGHT, ...varsOf(CSS.slice(darkAt, CSS.indexOf('\n  }', darkAt))) };

test('(2) the words on the accent read — 4.5:1 at least, from the numbers in the stylesheet; a pale accent is told so', () => {
  for (const [mode, vars] of [['light', LIGHT], ['dark', DARK]] as const) {
    const accent = triplet(resolve(vars['--sn-accent']!, vars));
    const ink = triplet(resolve(vars['--sn-on-accent']!, vars));
    const ratio = contrast(accent, ink);
    assert.ok(ratio >= 4.5, `${mode}: words on the accent read at ${ratio.toFixed(2)}:1 (accent ${accent.join(' ')}, ink ${ink.join(' ')}) — change --sn-on-accent with --sn-accent`);
  }
  // Today: the terracotta the old token holds, in both blocks.
  assert.deepEqual(triplet(resolve(LIGHT['--sn-accent']!, LIGHT)), [194, 78, 37]);
  assert.deepEqual(triplet(resolve(DARK['--sn-accent']!, DARK)), [229, 121, 78]);
  // The measure itself: white on the terracotta passes; white on a pale blue does NOT; a dark ink on it does.
  assert.ok(Math.abs(contrast([194, 78, 37], [255, 255, 255]) - 4.76) < 0.05);
  assert.ok(contrast([147, 197, 253], [255, 255, 255]) < 4.5, 'anti-vacuity: a pale accent under white words is let through');
  assert.ok(contrast([147, 197, 253], [44, 42, 41]) >= 4.5);
  assert.ok(contrast([37, 99, 235], [255, 255, 255]) >= 4.5, 'the blue of the proof below does not read under white');
});

/* ── (3) one line reaches every template ──────────────────────────────── */

const THE_ONE_LINE = '--sn-accent: var(--color-mulberry);';
const BLUE = '37 99 235';

test('(3) one line makes it blue — every template’s "on" colour resolves to the token, through the real Tailwind config', async () => {
  assert.equal(CSS.split(THE_ONE_LINE).length - 1, 1, 'the accent is set on more than one line (or none)');
  const standIn = CSS.replace(THE_ONE_LINE, `--sn-accent: ${BLUE};`);
  const blueVars = varsOf(standIn.slice(lightAt, standIn.indexOf('html.dark {')));

  const tw = (await import('../tailwind.config')).default as { theme: { extend: { colors: Record<string, unknown> } } };
  const colours = tw.theme.extend.colors;
  /** The `sn` family: `bg-sn-accent` reads `sn.accent`, `text-sn-on-accent` reads `sn['on-accent']`. */
  const sn = colours.sn as Record<string, string>;
  assert.deepEqual(sn, { accent: 'rgb(var(--sn-accent) / <alpha-value>)', 'on-accent': 'rgb(var(--sn-on-accent) / <alpha-value>)' });
  // NOT the kit's older `accent*` slots — those are its GOLD family (`bg-accent-soft` is a gold wash on the blog), and
  // stay exactly as they were. The `sn-` keeps the two apart (controller 2026-10-08: "a trap for the next person").
  assert.equal(colours.accent, 'var(--accent)', 'the kit’s gold `accent` slot was repointed');
  assert.equal(colours['accent-soft'], 'var(--accent-soft)');
  /** What a utility class paints: its Tailwind colour, with every variable followed. Null = not a colour class of ours. */
  const paints = (cls: string, vars: Vars): string | null => {
    const m = /(?:^|:)(?:bg|text|ring|border)-sn-(on-accent|accent)$/.exec(cls);
    return m ? resolve(sn[m[1]!]!, vars) : null;
  };
  const on = (vars: Vars) => `rgb(${resolve(vars['--sn-accent']!, vars)} / <alpha-value>)`;
  const ink = (vars: Vars) => `rgb(${resolve(vars['--sn-on-accent']!, vars)} / <alpha-value>)`;

  const { renderToStaticMarkup } = await import('react-dom/server');
  const P = await import('../app/_components/pill-selector');
  const T = await import('../app/_components/pill-thumb');
  const C = await import(`../${E}/background-cards`);
  const M = await import(`../${E}/pick-menu-place`);
  const R = await import('./maker-stage-room');
  const card = renderToStaticMarkup(
    React.createElement(
      C.BgCards,
      { label: 'Scene', source: 'scene', quietMs: 0, pick: { seq: 1, card: 'x', strip: 'scene', reading: true, file: true, pct: 40, laid: false, shown: false, saved: false, failed: null } },
      React.createElement(C.BgCard, { name: 'New', data: 'x', on: false, onPick: () => {}, swatch: 'none' }),
    ),
  );
  const classesOf = (html: string, mark: RegExp) => (mark.exec(html)?.[1] ?? '').split(/\s+/);
  /** Every "on" look a template draws: [what, its classes, 'fill' | 'ink' | 'ring' …]. */
  const looks: Array<[string, string[], 'accent' | 'on-accent']> = [
    ['pill selector — picked fill', P.PILL_ON_CLASS.split(' '), 'accent'],
    ['pill selector — picked words', P.PILL_ON_CLASS.split(' '), 'on-accent'],
    ['pill selector — a picked choice', P.pillSegClass(true).split(' '), 'accent'],
    ['pill selector — the thumb', T.PILL_THUMB_CLASS.split(' '), 'accent'],
    ['Stages tools — the picked face', R.STAGE_TOOL_FACE.split(' '), 'accent'],
    ['Stages tools — the picked icon', R.STAGE_TOOL_FACE.split(' '), 'on-accent'],
    ['Phases — the picked choice', R.SP_PHASE.split(' '), 'accent'],
    ['style card — the picked ring', classesOf(card, /data-bg-card-picture=""[^>]*class="([^"]*)"/), 'accent'],
    ['style card — the picked name', classesOf(card, /<button[^>]*data-bg-card="x"[^>]*class="([^"]*)"/), 'accent'],
    ['style card — the pie’s centre', classesOf(card, /data-bg-card-pie="40"[^>]*>\s*<span class="([^"]*)"/), 'accent'],
    ['style card — the pie’s figure', classesOf(card, /data-bg-card-pie="40"[^>]*>\s*<span class="([^"]*)"/), 'on-accent'],
    ['dropdown — the ▾', M.pickArrowClass(false).split(' '), 'accent'],
    ['dropdown — the picked option’s words', M.pickOptionClass(false, true).split(' '), 'accent'],
    ['dropdown — the picked option’s ✓', M.pickTickClass(false).split(' '), 'accent'],
  ];
  for (const vars of [LIGHT, blueVars]) {
    for (const [what, classes, job] of looks) {
      const painted = classes.map((c) => paints(c, vars)).filter((x): x is string => x !== null);
      const want = job === 'accent' ? on(vars) : ink(vars);
      assert.ok(painted.includes(want), `${what}: does not resolve to the ${job} (${want}) — its colour classes paint [${painted.join(' | ') || 'nothing of the token'}] from "${classes.join(' ').slice(0, 120)}"`);
    }
  }
  // The proof is not vacuous: the swap moved the answer.
  assert.equal(on(LIGHT), 'rgb(194 78 37 / <alpha-value>)');
  assert.equal(on(blueVars), `rgb(${BLUE} / <alpha-value>)`);
  // The two template rules that are CSS, not classes: the switch that is on, and the press ring.
  const switchOn = /\.sn-switch\[data-on='true'\],\s*\.peer:checked ~ \.sn-switch \{\s*background-color: ([^;]+);/.exec(CSS)?.[1] ?? '';
  assert.equal(resolve(switchOn, blueVars), `rgb(${BLUE})`, 'a switch that is on does not follow the accent');
  const ring = /border:2px solid (rgb\(var\(--sn-accent\) \/ \.45\))/.exec(read('app/_components/press-feel.tsx'))?.[1] ?? '';
  assert.equal(resolve(ring, blueVars), `rgb(${BLUE} / .45)`, 'the press ring does not follow the accent');
  // The thumb's pulse ring copies the thumb (no colour of its own).
  assert.match(CSS, /\.sn-pill-thumb::after \{[^}]*background: inherit;/);
});

/* ── (4) the guest's Event Hub is not reached ─────────────────────────── */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('(4) the guest’s Event Hub never reads the app’s accent — nothing under app/[slug] names the token or a template', () => {
  const files = walk(join(WEB, 'app/[slug]'));
  assert.ok(files.length > 100, `anti-vacuity: only ${files.length} guest files read`);
  const LEAKS = [
    { what: 'the accent token', re: /--sn-(?:on-)?accent\b/ },
    { what: 'an accent class', re: /(?:^|[\s"'`:])(?:bg|text|ring|border)-sn-(?:on-)?accent(?![\w-])/ },
    { what: 'the pill selector template', re: /pill-selector'|pill-thumb'|PILL_ON_CLASS|PILL_THUMB_CLASS/ },
  ];
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const { what, re } of LEAKS) assert.doesNotMatch(src, re, `${relative(WEB, f)} reads ${what} — the guest's hub wears the couple's own colours`);
  }
  // The hub's themes set their own colours (`--hub-accent*`, their own `--color-mulberry`) and never touch ours.
  const hubBlocks = CSS.split('\n').filter((l) => /--hub-accent-ink:/.test(l));
  assert.ok(hubBlocks.length >= 5, 'anti-vacuity: the hub’s own accent inks were not found');
  assert.equal((CSS.match(/--sn-accent:/g) ?? []).length, 1, 'the accent is set again somewhere (a theme, a scope)');
  // The dropdown is the one template the hub also draws — and there it takes the page's own ink.
  const M = require(`../${E}/pick-menu-place`) as typeof import('../app/dashboard/[eventId]/website/editor/_components/pick-menu-place');
  assert.ok(M.pickArrowClass(false).split(' ').includes('[.sn-editorial_&]:text-inherit'), 'the ▾ is the app’s accent inside the guest’s hub');
  assert.doesNotMatch(M.pickOptionClass(false, true, true) + M.pickTickClass(true), /accent/, 'the list keeps the app’s accent inside the guest’s hub');
});
