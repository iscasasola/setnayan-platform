/**
 * a-scene-is-as-tall-as-its-content.test.ts — EVERY EVENT HUB SCENE FITS ITS
 * CONTENT, THE GAPS BETWEEN SCENES ARE ONE RHYTHM, AND THE PROGRESS LINE HAS NO
 * BLANK.
 *
 * Owner 2026-09-27 (DECISION_LOG "A SCENE IS AS TALL AS ITS CONTENT" and
 * "SCRUB SCENES ALSO FIT THEIR CONTENT"): *"this scene should not be alone. the
 * spacing between scenes depend on the content to keep a balanced gap from each
 * other"*. Measured on production before this: a Scrub scene was pinned at one
 * full screen (1,060px) with a 196px Countdown centred by ~342px of nothing
 * above and below; an Auto run was held at one screen with ~3.7rem of padding.
 *
 * Owner 2026-09-28: *"look at the progress line, there was a blank"* — a segment
 * drawn for a section that rendered nothing, whose timeline never existed.
 *
 * 🔑 PROPERTIES, NOT PHRASINGS. Each test below walks EVERY rule of
 * `globals.css` (parsed, so a comment or a reworded selector cannot hide a
 * declaration) or renders EVERY page plan up to a size, and asserts a property
 * of the whole set — never that one particular line reads a particular way.
 * The layout itself (real gaps in pixels, the cross-fade never blank, the fill
 * monotonic while scrolling) is measured by the QA harness in Chromium and iOS
 * Safari at 390 and 1280; see the PR for the table.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss, { type Rule, type Declaration } from 'postcss';
import { HUB_TRANSITIONS } from './hub-scenes';

const CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
const ROOT = postcss.parse(CSS);

/** Every rule, one entry per selector in its list, with its declarations. */
function rules(): { selector: string; decls: Declaration[]; rule: Rule }[] {
  const out: { selector: string; decls: Declaration[]; rule: Rule }[] = [];
  ROOT.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes$/.test((rule.parent as { name: string }).name)) return;
    const decls = rule.nodes.filter((n): n is Declaration => n.type === 'decl');
    for (const selector of rule.selectors) out.push({ selector: selector.trim(), decls, rule });
  });
  return out;
}

/** The last compound of a selector — the element the rule styles. */
const subject = (sel: string) => sel.split(/\s*[>~+]\s*|\s+/).filter(Boolean).pop() ?? '';

/* 🔁 RE-AIMED 2026-10-09 (the cleanup that removed the stacked Scrub run — `.hub-run` / `.hub-scrub` / `.hub-sp`).
   A SCENE WRAPPER: the page's scenes, an Auto run, a scene of any kind — and the boxes a Scrub hand-over nests its
   scenes in (`hub-scenes.tsx` `flow`: cell › stage › the scene, then `after` › `below`), so this guard SEES the new
   wrappers instead of going quiet about them. */
const WRAPPER = /\.hub-(scenes|arun|scene|scroll|auto|cell|stage|after|below)(?![\w-])/;
/* A SCENE'S FRAME: what a stacked (Auto) scene shows — its direct child. */
const FRAME = /\.hub-auto(?![\w-])[^\s>~+]*\s*>\s*(\*|\.hub-canvas|section)(?![\w-])[^\s>~+]*$/;

const isWrapper = (sel: string) => !sel.includes('::') && WRAPPER.test(subject(sel));
const isFrame = (sel: string) => !sel.includes('::') && FRAME.test(sel);
const VIEWPORT = /\b\d*\.?\d+(s|d|l)?v(h|b|max|min)\b/;
const SIZE = /^(min-)?(height|block-size)$/;

test('📏 no scene wrapper or frame forces a viewport-height minimum', () => {
  let looked = 0;
  const bad: string[] = [];
  for (const { selector, decls } of rules()) {
    if (!isWrapper(selector) && !isFrame(selector)) continue;
    looked += 1;
    for (const d of decls) {
      /* `max-height` is a CAP (a tall frame scrolls inside itself), never a
         floor. The run's `grid-template-rows` is the scroll TRACK a Scrub run
         consumes, drawn in a zero-width column — no box a guest sees is sized
         by it (asserted in the next test). */
      if (SIZE.test(d.prop) && VIEWPORT.test(d.value)) bad.push(`${selector} { ${d.prop}: ${d.value} }`);
    }
  }
  assert.ok(looked >= 20, `anti-vacuity: the scene rules were found (${looked})`);
  assert.deepEqual(bad, [], 'a scene is as tall as its content — never padded to the screen');
});

/* 🔁 RE-AIMED 2026-10-09 (the cleanup). This held the stacked run's pinned FRAME (`.hub-scrub > *`, sticky, with a
   viewport-sized `::after` track on its slot). The owner's rule it protects has not moved — a Scrub scene is as tall
   as its content, never a full-screen band — but what holds a scene now is the hand-over's STAGE, standing still
   while an invisible length under it (the cell's `::after`, sized by the engine) is scrolled past. */
test('📏 a held Scrub scene is as tall as its content: the stage stands still, nothing is sized, the hold is an invisible length', () => {
  const all = rules();
  const stage = all.find((r) => r.selector === '.hub-scenes[data-hub-scrub-on] .hub-stage');
  assert.ok(stage?.decls.some((d) => d.prop === 'position' && d.value === 'sticky'), 'the stage is what stands still');
  const bad: string[] = [];
  let looked = 0;
  for (const { selector, decls } of all) {
    if (selector.includes('::') || !/\.hub-(cell|stage|after|below|scene)(?![\w-])/.test(subject(selector))) continue;
    looked += 1;
    for (const d of decls) {
      if (SIZE.test(d.prop)) bad.push(`${selector} { ${d.prop}: ${d.value} }`);
      if (/^flex(-grow)?$/.test(d.prop) && !/^(none|0|0 0 \S+)$/.test(d.value)) bad.push(`${selector} { ${d.prop}: ${d.value} }`);
      /* Auto margins are how the old frame was centred inside a full screen. */
      if (/^margin(-block|-top|-bottom)?$/.test(d.prop) && /\bauto\b/.test(d.value)) bad.push(`${selector} { ${d.prop}: ${d.value} }`);
      if (d.prop === 'display' && /flex/.test(d.value)) bad.push(`${selector} { ${d.prop}: ${d.value} }`);
    }
  }
  assert.ok(looked >= 8, `anti-vacuity: the scene and hand-over rules were found (${looked})`);
  assert.deepEqual(bad, [], 'a scene and its hand-over boxes follow their content');
  // The hold is the only added length, and it is invisible: an empty pseudo-element sized by the engine, 0 without it.
  const track = all.find((r) => r.selector === '.hub-scenes[data-hub-scrub-on] .hub-cell::after');
  assert.ok(track, 'the cell carries its hold as an ::after');
  assert.ok(track.decls.some((d) => d.prop === 'content' && d.value === "''"), 'an empty pseudo-element — nothing to see');
  assert.equal(track.decls.find((d) => d.prop === 'height')?.value, 'var(--hub-len, 0px)');
  // …and the stacked run is not half-back.
  assert.deepEqual(all.filter((r) => /\.hub-(run|scrub|sp)(?![\w-])/.test(r.selector)).map((r) => r.selector), []);
});

test('↕ the gap between consecutive scenes is ONE rhythm — no stacked margins, no screen-sized padding', () => {
  // The rhythm is what the plain page uses between two sections.
  /* 🔁 RE-AIMED 2026-10-09 (the cleanup): the stacked run's own rule is gone; the same rhythm is the hand-over nest's. */
  const rhythm = rules().find((r) => r.selector === '.hub-stage > .hub-after');
  assert.ok(rhythm, 'the fallback rhythm exists');
  const R = rhythm.decls.find((d) => d.prop === 'margin-top')?.value;
  assert.equal(R, '1rem');
  const rem = (v: string) => (v === '0' || v === '0px' ? 0 : /^(-?\d*\.?\d+)rem$/.exec(v) ? Number(/^(-?\d*\.?\d+)rem$/.exec(v)![1]) : NaN);
  const bad: string[] = [];
  let looked = 0;
  for (const { selector, decls } of rules()) {
    /* The wrappers, plus the "every unit after the progress mark" rule, which
       spaces runs and scroll scenes alike. */
    if (!isWrapper(selector) && !/^\.hub-scenes > \.hub-prog ~/.test(selector)) continue;
    /* 🔁 2026-10-09 (commit 8c): ONE length here is not a gap between scenes — the page's END, after the last scene, on a
       page with a Scrub hand-over and only once the engine has armed (`--hub-end`: what it takes for the last row
       and the last hand-over to complete on a tall window; 0 on most pages). Named exactly, never a pattern. */
    if (selector === '.hub-scenes[data-hub-scrub-on]' && decls.length === 1 && decls[0]!.prop === 'padding-bottom' && decls[0]!.value === 'var(--hub-end, 0px)') continue;
    /* 🔁 2026-10-09 (the cleanup — the nest's boxes are wrappers this guard now sees): ONE more length is not a gap
       either — the pull that draws an arrival IN THE SAME PLACE as the scene it follows (`--hub-up`, negative, set by
       the engine; the 1rem rhythm without it). Named exactly, never a pattern. */
    if (selector === '.hub-scenes[data-hub-scrub-on] .hub-scene + .hub-after' && decls.length === 1 && decls[0]!.prop === 'margin-top' && decls[0]!.value === 'var(--hub-up, 1rem)') continue;
    for (const d of decls) {
      if (!/^(margin|padding)(-block)?(-top|-bottom|-start|-end)?$/.test(d.prop)) continue;
      if (/^(margin|padding)$/.test(d.prop) && d.value.split(/\s+/).length > 1) {
        bad.push(`${selector} { ${d.prop}: ${d.value} } — say the block sides explicitly`);
        continue;
      }
      looked += 1;
      const n = rem(d.value);
      /* 0 (a stacked scene, or a scene inside a run) or the rhythm, within a
         quarter rem. Anything else — a viewport unit, `auto`, a clamp — is a
         gap that depends on the screen instead of on the content. */
      if (!(n === 0 || Math.abs(n - 1) <= 0.25)) bad.push(`${selector} { ${d.prop}: ${d.value} }`);
    }
  }
  assert.ok(looked >= 4, `anti-vacuity: the spacing rules were found (${looked})`);
  assert.deepEqual(bad, []);
});

/* ── THE PROGRESS LINE ─────────────────────────────────────────────────── */

async function render(transitions: (string | undefined)[], scrubAllowed: boolean): Promise<string> {
  const React = (await import('react')).default;
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HubScenes } = await import('../app/[slug]/_components/hub-scenes');
  const Scenes = HubScenes as unknown as React.FunctionComponent<Record<string, unknown>>;
  const widgets = transitions.map((t, i) => ({
    widget_id: `w${i}`,
    event_id: 'E1',
    widget_type: 'custom_1',
    config_json: t ? { canvas: { transition: t } } : null,
  }));
  const kids = widgets.map((w) => React.createElement('section', { key: w.widget_id }, w.widget_id));
  return renderToStaticMarkup(React.createElement(Scenes, { widgets, scrubAllowed }, kids));
}

/** Every plan of `n` sections over the transition set (plus "unset"). */
function* plans(n: number): Generator<(string | undefined)[]> {
  const opts = [undefined, ...HUB_TRANSITIONS];
  const total = opts.length ** n;
  for (let k = 0; k < total; k++) {
    const plan: (string | undefined)[] = [];
    let x = k;
    for (let i = 0; i < n; i++) {
      plan.push(opts[x % opts.length]);
      x = Math.floor(x / opts.length);
    }
    yield plan;
  }
}

test('🔴 for every page plan: one segment per rendered section, each naming a live timeline', async () => {
  let pages = 0;
  for (let n = 1; n <= 5; n++) {
    for (const plan of plans(n)) {
      for (const pro of [true, false]) {
        const html = await render(plan, pro);
        // No run on the page → the page is byte-identical to before (asserted in
        // a-hybrid-page-renders-runs) and there is no progress line to check.
        if (!html.includes('hub-prog-bar')) continue;
        pages += 1;
        const bar = html.slice(html.indexOf('hub-prog-bar'), html.indexOf('</span>', html.indexOf('hub-prog-bar')));
        const segs = [...bar.matchAll(/<i style="--hub-tl:(--hub-s\d+);/g)].map((m) => m[1]!);
        // The sections that draw a box a guest can pass: each scroll scene,
        // each scrub scene, each auto RUN (one screen, one segment).
        // In document order — the order a guest scrolls past them.
        const sources = [
          ...html.matchAll(
            /class="(?:hub-scene hub-scroll|hub-sp|hub-arun)"[^>]*?style="--hub-tl:(--hub-s\d+)"/g,
          ),
        ].map((m) => m[1]!);
        assert.equal(segs.length, sources.length, `${plan} pro=${pro}: ${segs.length} segments for ${sources.length} sections`);
        assert.deepEqual(segs, sources, `${plan} pro=${pro}: segments in page order, each on its own section's timeline`);
        assert.equal(new Set(segs).size, segs.length, `${plan}: no two segments share a timeline`);
      }
    }
  }
  assert.ok(pages > 100, `anti-vacuity: pages with scenes rendered (${pages})`);
});

test('🔴 a segment has NO width until its section’s timeline is live — an empty section leaves no blank', () => {
  const all = rules();
  const seg = all.find((r) => r.selector === '.hub-prog-bar > i');
  assert.ok(seg, 'the segment is styled');
  const get = (p: string) => seg.decls.find((d) => d.prop === p)?.value;
  assert.match(get('flex') ?? '', /^0 0 0(px)?$/, 'a segment takes no room of its own');
  assert.equal(get('animation-timeline'), 'var(--hub-tl)', 'its room comes from its OWN section’s timeline');
  const anim = get('animation') ?? '';
  const name = /\b(hub-prog-[\w-]+)\b/.exec(anim)?.[1];
  assert.ok(name, 'an animation gives it its room');
  assert.match(anim, /\bboth\b/, 'held for as long as the timeline exists');
  let kf = '';
  ROOT.walkAtRules(/keyframes$/, (at) => {
    if (at.params === name) kf = at.toString();
  });
  assert.match(kf, /flex-grow:\s*[1-9]/, `${name} is what widens it`);
  // Nothing else may widen a segment, or a dead one would show again.
  for (const r of all) {
    if (!/\.hub-prog-bar > i(?![\w-])/.test(r.selector) || r.selector.includes('::')) continue;
    for (const d of r.decls) {
      if (/^(flex|flex-grow|width|min-width|flex-basis)$/.test(d.prop) && r !== seg) assert.fail(`${r.selector} { ${d.prop}: ${d.value} } widens a segment without its timeline`);
    }
  }
  // A gap would draw a sliver for every hidden segment.
  const bar = all.find((r) => r.selector === '.hub-prog-bar');
  assert.ok(bar && !bar.decls.some((d) => /^(gap|column-gap)$/.test(d.prop)), 'the bar spaces live segments only');
  // And an empty section is no section — on every engine, not only inside the gates.
  const empty = all.find((r) => r.selector === '.hub-scene:empty');
  assert.ok(empty && empty.rule.parent?.type === 'root', 'an empty scene is hidden outside every gate');
  assert.ok(empty.decls.some((d) => d.prop === 'display' && d.value === 'none'));
});
