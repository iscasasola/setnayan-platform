/**
 * six-effects-finish-still-and-ask-pro.test.ts — ✨ THE SIX NEW EFFECTS (owner-approved 2026-10-16, DECISION_LOG
 * "APPROVED — SIX NEW EFFECTS: WORD BY WORD · SPREAD · GLOW (TEXT), DEVELOP · CURTAIN · LIGHT LEAK (PICTURES)", verbatim
 * *"Approved — build the six effects as the prototype shows."*; and "ALL ANIMATE, EFFECTS, STYLES AND ACCENTS ARE EVENT
 * HUB PRO ◆"). Two properties, held for EACH of the six:
 *
 *   (1) A GUEST WHO ASKED FOR STILLNESS (or is on Save-Data) SEES THE FINISHED STATE — never hidden, never a start
 *       frame. Every animation of the six lives behind `prefers-reduced-motion: no-preference` AND off `.sn-save-data`;
 *       what styles the effect outside that gate draws the words at rest, the photo whole and in colour, the halo at its
 *       middle strength and the flare held faint (the ambient sheet's own still, the same on Save-Data); and every
 *       one-shot keyframe ENDS at rest. Rendered: the part wears its hook and its words read exactly as without it.
 *   (2) EACH IS PRO ◆, THE SHIPPED WAY — tried free in the Maker (marked ◆ there, as Shimmer is), held at Apply for a
 *       couple without Pro and NAMED by its own name on the Apply sheet; nothing is asked of a couple with Pro.
 *
 * And the costs the approval set: transform · opacity · filter · clip-path only (never `letter-spacing`, never
 * `text-shadow`), and per-letter spans only up to 24 letters.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';
import {
  HUB_EL_DURING_PRO_NAMED,
  HUB_SPREAD_LETTERS_MAX,
  sanitizeHubElementStyle,
  type HubElementKey,
  type HubElementMotion,
  type HubElementStyles,
} from './element-style';
import { AMBIENT_EFFECT_CSS } from './ambient-effects';
import { hubFxCut } from './part-fx';
import { emptyHubDraft, mergeHubDraft } from './hub-draft';
import { hubDraftProEffects } from './hub-pro-effects';

(globalThis as unknown as { React: unknown }).React = React;
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup;
let PahinaMasthead: typeof import('@/app/[slug]/_components/pahina-masthead').PahinaMasthead;
before(async () => {
  ({ renderToStaticMarkup } = await import('react-dom/server'));
  ({ PahinaMasthead } = await import('@/app/[slug]/_components/pahina-masthead'));
});

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** THE SIX — the part each plays on, its motion, the hook it wears, its keyframe, and the name Apply gives it. */
type Fx = { name: string; part: HubElementKey; motion: HubElementMotion; hook: [string, string]; kf: string | null };
const SIX: readonly Fx[] = [
  { name: 'Word by word', part: 'names', motion: { words: 'word' }, hook: ['data-el-words', 'word'], kf: 'el-fx-word' },
  { name: 'Spread', part: 'names', motion: { words: 'spread' }, hook: ['data-el-words', 'spread'], kf: 'el-fx-letter' },
  { name: 'Glow', part: 'names', motion: { during: 'glow' }, hook: ['data-el-glow', ''], kf: 'el-fx-glow' },
  { name: 'Develop', part: 'photo', motion: { reveal: 'develop' }, hook: ['data-el-reveal', 'develop'], kf: 'el-fx-develop' },
  { name: 'Curtain', part: 'photo', motion: { reveal: 'curtain' }, hook: ['data-el-reveal', 'curtain'], kf: 'el-fx-curtain' },
  /* Light leak's drawing is the ambient `leak` (its own keyframe and still live in `AMBIENT_EFFECT_CSS`). */
  { name: 'Light leak', part: 'photo', motion: { during: 'leak' }, hook: ['data-el-act', 'leak'], kf: null },
];

/* ── a small CSS reader: every leaf rule with the at-rules around it ──────── */
type Rule = { chain: string[]; selector: string; body: string };
function rulesOf(cssText: string): Rule[] {
  const css = stripComments(cssText);
  const out: Rule[] = [];
  const stack: Array<{ prelude: string; at: number; child: boolean }> = [];
  let last = 0;
  for (let i = 0; i < css.length; i += 1) {
    const c = css[i];
    if (c === '{') {
      if (stack.length) stack[stack.length - 1]!.child = true;
      const prelude = css.slice(last, i).split(';').pop()!.trim();
      stack.push({ prelude, at: i + 1, child: false });
      last = i + 1;
    } else if (c === '}') {
      const top = stack.pop();
      if (top && !top.child) out.push({ chain: stack.map((s) => s.prelude), selector: top.prelude, body: css.slice(top.at, i) });
      last = i + 1;
    }
  }
  return out;
}
const GLOBALS = rulesOf(read('app/globals.css'));
/** A selector list split at its top-level commas (never inside `:is(…)` · `:has(…)`). */
function selectors(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let at = 0;
  for (let i = 0; i < list.length; i += 1) {
    if (list[i] === '(') depth += 1;
    else if (list[i] === ')') depth -= 1;
    else if (list[i] === ',' && depth === 0) {
      out.push(list.slice(at, i).trim());
      at = i + 1;
    }
  }
  out.push(list.slice(at).trim());
  return out;
}
const GATE = '@media screen and (prefers-reduced-motion: no-preference)';
const KEYFRAMES = (name: string) => GLOBALS.filter((r) => r.chain[r.chain.length - 1] === `@keyframes ${name}`);
const decl = (body: string, prop: string) => new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(body)?.[1]?.trim() ?? null;
/** The rules that move or style the six's hooks. */
const FX_HOOK = /data-el-(?:w|l|sl|pic|glow|words|reveal|act|leak)\b/;

function render(elements: HubElementStyles | null) {
  return renderToStaticMarkup(
    React.createElement(PahinaMasthead, {
      displayName: 'Indalecio & Claire',
      eventDate: '2026-12-18',
      twoPeople: true,
      elements,
      eyebrow: 'With thanksgiving to God and with the blessing of our parents,',
      monogramSlot: React.createElement('span', null, 'IC'),
      mediaSlot: React.createElement('img', { alt: '', src: '/std/backgrounds/ballroom.webp' }),
    }),
  );
}
const textOf = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

test('(1a) every animation of the six is behind the reduced-motion gate AND off Save-Data — outside it nothing moves', () => {
  const moving = GLOBALS.filter((r) => !r.chain.some((c) => c.startsWith('@keyframes')) && /\bel-fx-[a-z]+/.test(decl(r.body, 'animation') ?? ''));
  for (const fx of SIX.filter((f) => f.kf)) {
    const uses = moving.filter((r) => (decl(r.body, 'animation') ?? '').includes(fx.kf!));
    assert.ok(uses.length > 0, `${fx.name}: no rule plays ${fx.kf}`);
    for (const r of uses) {
      assert.ok(r.chain.includes(GATE), `${fx.name}: "${r.selector}" plays ${fx.kf} outside the reduced-motion gate`);
      assert.ok(selectors(r.selector).every((s) => s.startsWith(':root:not(.sn-save-data)')), `${fx.name}: "${r.selector}" plays on a Save-Data connection`);
    }
  }
  for (const r of moving) assert.ok(r.chain.includes(GATE), `"${r.selector}" plays an effect outside the gate`);
});

test('(1b) outside the gate every effect is drawn FINISHED — words at rest, the photo whole and in colour, the halo at its middle strength', () => {
  const resting = GLOBALS.filter((r) => !r.chain.includes(GATE) && !r.chain.some((c) => c.startsWith('@keyframes')) && FX_HOOK.test(r.selector));
  assert.ok(resting.length > 0, 'the reader found none of the six’s rules');
  for (const r of resting) {
    /* The one hide is the canvas's Light leak on a photo that does not leak (drawn there only to show at once). */
    if (/:not\(\[data-el-act='leak'\]\) > \[data-el-leak\]/.test(r.selector)) continue;
    assert.equal(decl(r.body, 'display'), null, `"${r.selector}" hides a part at rest`);
    assert.equal(decl(r.body, 'clip-path'), null, `"${r.selector}" clips the photo at rest`);
    assert.doesNotMatch(decl(r.body, 'filter') ?? '', /sepia/, `"${r.selector}" holds Develop's first frame at rest`);
    const o = decl(r.body, 'opacity');
    if (o !== null && !/var\(/.test(o)) assert.ok(Number(o) > 0, `"${r.selector}" is invisible at rest`);
  }
  /* Glow at rest: the halo held at its middle strength — between the breath's two ends. */
  const halo = resting.find((r) => /\[data-el-glow\] \[data-el-w\]::before/.test(r.selector));
  assert.ok(halo, 'Glow has no halo at rest');
  assert.equal(decl(halo!.body, 'content'), 'attr(data-t)', 'the halo is not a copy of the word');
  const breath = KEYFRAMES('el-fx-glow').flatMap((k) => [Number(decl(k.body, 'opacity'))]);
  const rest = Number(decl(halo!.body, 'opacity'));
  assert.ok(rest > Math.min(...breath) && rest < Math.max(...breath), `the halo rests at ${rest}, not between ${breath.join(' and ')}`);
});

test('(1c) every one-shot keyframe ENDS at rest, and the flare holds its still on reduced motion and on Save-Data alike', () => {
  for (const name of ['el-fx-word', 'el-fx-letter', 'el-fx-line']) {
    const frames = KEYFRAMES(name).map((k) => k.selector);
    assert.deepEqual(frames, ['from'], `${name} has an end frame of its own — the words must end where they rest`);
  }
  const to = (name: string, prop: string) => decl(KEYFRAMES(name).find((k) => k.selector === 'to')?.body ?? '', prop);
  assert.equal(to('el-fx-develop', 'filter'), 'none', 'Develop does not end in full colour');
  assert.equal(to('el-fx-curtain', 'clip-path'), 'inset(0 0 0 0)', 'Curtain does not end on the whole picture');
  // Light leak: the ambient sheet's reduced-motion still — and the same still on Save-Data.
  const rm = /@media \(prefers-reduced-motion:reduce\)\{[\s\S]*\[data-ambient-effect="leak"\] i\{([^}]*)\}/.exec(AMBIENT_EFFECT_CSS);
  assert.ok(rm, 'the ambient Light leak has no still for reduced motion');
  const sd = GLOBALS.find((r) => /\.sn-save-data \[data-el-leak\] \[data-ambient-effect='leak'\] i/.test(r.selector));
  assert.ok(sd, 'the photo’s Light leak has no still on Save-Data');
  for (const prop of ['opacity', 'transform']) {
    assert.equal((decl(sd!.body, prop) ?? '').replace(/\s+/g, ''), (decl(rm![1]!, prop) ?? '').replace(/\s+/g, ''), `Save-Data's flare is not the reduced-motion still (${prop})`);
  }
  assert.equal(decl(sd!.body, 'animation-name'), 'none');
});

test('(1d) rendered: each effect’s part wears its hook, and its words and picture read exactly as without it', () => {
  const plain = render(null);
  for (const fx of SIX) {
    const style = sanitizeHubElementStyle({ motion: fx.motion }, fx.part);
    assert.ok(style?.motion, `${fx.name}: the sanitizer dropped it from the ${fx.part}`);
    const html = render({ [fx.part]: style! });
    assert.ok(html.includes(`${fx.hook[0]}="${fx.hook[1]}"`), `${fx.name}: the part does not wear ${fx.hook[0]}`);
    assert.equal(textOf(html), textOf(plain), `${fx.name}: the cover's words changed`);
    assert.doesNotMatch(html, /style="[^"]*opacity:\s*0[;"]/, `${fx.name}: something is drawn invisible inline`);
  }
  // The photo's Light leak is the ambient drawing, drawn only where it is chosen.
  assert.ok(render({ photo: { motion: { during: 'leak' } } }).includes('data-ambient-effect="leak"'));
  assert.ok(!plain.includes('data-ambient-effect'), 'a plate with nothing chosen draws a flare');
  // A photo with nothing chosen keeps its own Parallax; a still one does not.
  assert.ok(plain.includes('data-pahina-parallax'));
  assert.ok(!render({ photo: { motion: { during: 'still' } } }).includes('data-pahina-parallax'));
});

test('(2) each is Pro ◆ the shipped way — marked ◆ in the Maker, named at Apply for a couple without Pro, never asked of one with it', () => {
  const live = { events: {}, widgets: [{ widget_id: 'w-hero', widget_type: 'hero', is_always_on: true, display_order: 0, config_json: {}, mode: 'auto' }] } as never;
  for (const fx of SIX) {
    const draft = mergeHubDraft(emptyHubDraft(), { widgets: { hero: { canvas: { elements: { [fx.part]: { motion: fx.motion } } } } } } as never);
    const asked = hubDraftProEffects(draft, live, false);
    assert.deepEqual(asked.map((e) => e.what), [fx.name], `${fx.name}: the Apply sheet does not name it`);
    assert.match(asked[0]!.where, fx.part === 'photo' ? /^Photo on the / : /^Event title on the /);
    assert.ok(asked[0]!.remove, `${fx.name}: it cannot be taken off alone`);
    assert.deepEqual(hubDraftProEffects(draft, live, true), [], `${fx.name}: Pro is asked of a couple who has it`);
  }
  // ◆ in the Maker, as Shimmer is: Action's two, and the new Words ▾ / Reveal ▾ choices.
  for (const d of ['shimmer', 'glow', 'leak'] as const) assert.ok(HUB_EL_DURING_PRO_NAMED.includes(d), `${d} is not marked ◆`);
  const sheet = stripComments(read('app/dashboard/[eventId]/website/editor/_components/element-sheet.tsx'));
  assert.match(sheet, /w === 'all' \? HUB_EL_WORDS_LABEL\[w\] : `\$\{HUB_EL_WORDS_LABEL\[w\]\} ◆`/, 'Word by word and Spread are not marked ◆');
  assert.match(sheet, /r === 'plain' \? HUB_EL_REVEAL_LABEL\[r\] : `\$\{HUB_EL_REVEAL_LABEL\[r\]\} ◆`/, 'Develop and Curtain are not marked ◆');
});

test('the costs the approval set: GPU properties only, and letters only up to 24', () => {
  for (const r of GLOBALS.filter((x) => /^@keyframes el-fx-/.test(x.chain[x.chain.length - 1] ?? ''))) {
    for (const prop of r.body.split(';').map((d) => d.split(':')[0]!.trim()).filter(Boolean)) {
      assert.ok(['transform', 'opacity', 'filter', 'clip-path'].includes(prop), `${r.chain.at(-1)} animates ${prop}`);
    }
  }
  const six = GLOBALS.filter((r) => FX_HOOK.test(r.selector));
  for (const r of six) {
    assert.equal(decl(r.body, 'letter-spacing'), null, `"${r.selector}" sets letter-spacing`);
    assert.equal(decl(r.body, 'text-shadow'), null, `"${r.selector}" sets text-shadow`);
  }
  assert.equal(HUB_SPREAD_LETTERS_MAX, 24);
  assert.deepEqual(hubFxCut('spread', 'x'.repeat(24)), { letters: true, line: false });
  assert.deepEqual(hubFxCut('spread', 'x'.repeat(25)), { letters: false, line: true });
});
