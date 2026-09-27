/**
 * the-motion-reaches-the-guest.test.ts — THE EVENT HUB'S MOTION ACTUALLY PLAYS
 * FOR A GUEST, ON A PHONE, IN EVERY ENGINE, AND NEVER HIDES A WORD.
 *
 * The owner asked "does the animations work and scrubbing and scrolling?" and a
 * QA run (harness rendering the SHIPPED components; Chromium phone + real iOS
 * Safari 26.5 + an engine with scroll timelines stripped, standing in for
 * iOS ≤ 18) measured nine ways it did not. Each rule below is the PROPERTY that
 * would have caught one of them, not the phrasing of its fix:
 *
 *   1. words VANISHED on an engine without scroll timelines — element motion
 *      was an ungated inline `animation`, and the Out's `both` fill held
 *      opacity 0 for good                                  → the gate, the fill
 *   2. a section with ANY background never moved — `overflow: hidden` made its
 *      frame a scroll container, so every `view()` inside tracked a box that
 *      never scrolls                                       → clip, not hidden
 *   3. Auto-scroll STOPPED the moment a phone scrolled to it — a touch pan
 *      starts with `pointerdown`                            → click, not pointerdown
 *   4. Reduce Motion was ignored by a part's scroll motion  → the gate
 *   5. "Plays once" only played on the first screen        → `.pahina-in`
 *   6. "Goes out" was dead on one-after-another parts      → the Out slot
 *   7. a part arriving from the right widened the page     → overflow-x: clip
 *   8. a part's OWN motion lost to its scene's rules        → out-rank, compose
 *   9. a delayed part sat INVISIBLE through its delay      → fill none
 *
 * Every assertion here was seen to fail by sabotage before it was trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  HUB_EL_DURING_WORDS,
  HUB_EL_IN,
  HUB_EL_OUT,
  HUB_SCENE_ELEMENT_KEYS,
  hubElementInlineStyle,
  hubElementMotionDeclarations,
  hubElementSceneCss,
  sanitizeHubElementMotion,
  type HubElementMotion,
} from './element-style';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const CSS = stripComments(read('app/globals.css'));

/** Every motion the model allows — both timelines, every In · During · Out · Delay. */
function everyMotion(): HubElementMotion[] {
  const out: HubElementMotion[] = [];
  for (const timeline of ['once', 'scroll'])
    for (const i of HUB_EL_IN)
      for (const d of [...HUB_EL_DURING_WORDS])
        for (const o of HUB_EL_OUT)
          for (const delay of ['none', 'long']) {
            const m = sanitizeHubElementMotion({ in: i, during: d, out: o, timeline, delay });
            if (m) out.push(m);
          }
  return out;
}

/** The body of the brace block that opens at `at` (brace-counted, never "the next }"). */
function blockAt(css: string, at: number): string {
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}' && (depth -= 1) === 0) return css.slice(open + 1, i);
  }
  throw new Error('unclosed block');
}

/** The regions inside `@supports (animation-timeline: view())` → reduced-motion no-preference. */
function gated(css: string): string[] {
  const out: string[] = [];
  for (const m of css.matchAll(/@supports \(animation-timeline: view\(\)\)/g)) {
    const inner = blockAt(css, m.index ?? 0);
    const mq = inner.indexOf('@media (prefers-reduced-motion: no-preference)');
    if (mq >= 0) out.push(blockAt(inner, mq));
  }
  return out;
}

/** What is left once the gated regions — and the gates' own conditions — are cut out. */
function ungated(css: string): string {
  return gated(css)
    .reduce((acc, g) => acc.replace(g, ''), css)
    .replace(/@(supports|media) [^{]*/g, '');
}

/* ── 1 · 4 — the gate ─────────────────────────────────────────────────────── */

test('1·4 🔒 a scene part\'s motion is written ONLY inside both gates — for every motion the model allows', () => {
  let checked = 0;
  for (const motion of everyMotion()) {
    for (const key of HUB_SCENE_ELEMENT_KEYS) {
      const css = hubElementSceneCss('schedule', { [key]: { motion, color: '#112233' } })!;
      const inside = gated(css).join('\n');
      const outside = ungated(css);
      assert.match(inside, /animation:/, `no motion at all for ${JSON.stringify(motion)}`);
      assert.doesNotMatch(outside, /animation(-name|-timeline|-range)?\s*:/, `motion outside the gates: ${JSON.stringify(motion)}\n${css}`);
      // The look is NOT gated: a guest who asked for less motion keeps the couple's colour.
      assert.match(outside, /color:#112233 !important/);
      checked += 1;
    }
  }
  assert.ok(checked > 40, `anti-vacuity: ${checked}`);
});

test('1·4 🔒 a hero part never carries an inline animation — only properties the ONE gated rule reads', () => {
  for (const motion of everyMotion()) {
    const style = hubElementInlineStyle({ motion })!;
    for (const k of Object.keys(style)) {
      assert.doesNotMatch(k, /^animation/i, `inline ${k} on a hero part escapes every gate`);
    }
    assert.ok(style['--el-anim'], 'the motion must travel');
  }
  const rule = /\[data-el-motion\]:not\(#el-own\)\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(rule, 'the one rule that turns --el-anim into motion exists');
  assert.match(rule[1]!, /animation:\s*var\(--el-anim\)/);
  assert.match(rule[1]!, /animation-timeline:\s*var\(--el-tl\)/);
  assert.ok(
    gated(CSS).some((g) => g.includes('[data-el-motion]:not(#el-own)')),
    'the [data-el-motion] rule is outside the @supports + reduced-motion gates',
  );
  const MAST = stripComments(read('app/[slug]/_components/pahina-masthead.tsx'));
  assert.match(MAST, /\.\.\.hubElementMotionAttr\(elements\?\.\[key\]\)/, 'the hero part must carry the hook');
});

test('1 🔑 no Out ever HOLDS its end state — the fill is `backwards`', () => {
  for (const motion of everyMotion()) {
    if (!motion.out) continue;
    for (const place of ['page', 'hero', 'scrub', 'auto'] as const) {
      const anim = Object.fromEntries(hubElementMotionDeclarations(motion, place)).animation ?? '';
      const slot = anim.split(/,\s*(?![^()]*\))/).find((s) => / el-out-/.test(s));
      assert.ok(slot, `no Out slot for ${JSON.stringify(motion)} at ${place}`);
      assert.match(slot, / backwards el-out-/, `the Out at ${place} can hold opacity 0: ${slot}`);
    }
  }
});

/* ── 2 — clip, not hidden ─────────────────────────────────────────────────── */

test('2 🔴 no scene FRAME is a scroll container by accident — `clip`, never a bare `hidden`', () => {
  const canvas = CSS.slice(CSS.indexOf('.hub-canvas'));
  /* A FRAME is a box a scene's words sit inside: the scene, its canvas, its
     body, its ground and its shape. (A media tile, a progress segment and the
     sideways photo strip hold nothing that follows the page's scroll.) */
  const FRAME = /\.hub-(scenes?|run|arun|auto|scrub|scroll|canvas|canvas-body|canvas-photo|has-media|photo-beside|no-media|shape-[a-z]+|bg-[a-z]+|seq-[a-z]+|arr-[a-z]+)(?![\w-])[^,>~+\s]*\s*$/;
  /* The two scroll containers the canvas makes ON PURPOSE — a pinned Scrub
     scene and an armed Auto scene, so a tall scene can scroll inside itself.
     Their parts follow the scene's named timeline instead (asserted below). */
  const DELIBERATE = [/^\s*\.hub-scrub:not/, /^\s*\.hub-arun\[data-armed\] > \.hub-auto\s*$/];
  let seen = 0;
  for (const m of canvas.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selector, body] = m as unknown as [string, string, string];
    if (!selector.split(',').some((s) => FRAME.test(s))) continue;
    const scrolls = /overflow(-[xy])?\s*:\s*(hidden|auto|scroll)/.exec(body);
    if (!scrolls) continue;
    seen += 1;
    if (DELIBERATE.some((d) => d.test(selector))) continue;
    const clipAfter = new RegExp(`${scrolls[0].replace(/[-]/g, '\\-')}[\\s\\S]*overflow${scrolls[1] ?? ''}\\s*:\\s*clip`).test(body);
    assert.ok(clipAfter, `\`${selector.trim()}\` is a scroll container — every view() inside it freezes. Follow \`hidden\` with \`clip\`.`);
  }
  assert.ok(seen >= 3, `anti-vacuity: the frames with a clip were found (${seen})`);
  for (const sel of ['.hub-has-media', '.hub-shape-framed', '.hub-photo-beside > .hub-canvas-photo']) {
    const at = canvas.indexOf(`${sel} {`);
    assert.ok(at >= 0, `${sel} is styled`);
    assert.match(blockAt(canvas, at), /overflow:\s*clip/, `${sel} lost its clip`);
  }
});

test('2 🔑 inside the DELIBERATE scroll containers, scroll-linked motion follows the scene\'s own timeline', () => {
  const css = hubElementSceneCss('schedule', { label: { motion: { in: 'rise', timeline: 'scroll', out: 'fade' } } })!;
  assert.match(css, /\.hub-scrub > :has\(\+ style\[data-hub-els="schedule"\]\)[^{]*\{[^}]*animation-timeline:var\(--hub-tl\)/);
  assert.match(css, /\.hub-arun\[data-armed\] > \.hub-auto > :has\([^{]*\{[^}]*animation-timeline:var\(--hub-tl\)/);
  assert.match(CSS, /\.hub-scrub > \.hub-seq-parts > \.hub-canvas-body > \* > \*:nth-child\(n \+ 2\)\s*\{[^}]*--hub-part-in-tl:\s*var\(--hub-tl\)/);
  assert.match(CSS, /\.hub-arun\[data-armed\] > \.hub-auto > \.hub-seq-parts\.hub-tl-scrub[^{]*\{[^}]*--hub-part-in-tl:\s*var\(--hub-tl\)/);
});

/* ── 3 — a scroll is not a tap ────────────────────────────────────────────── */

test('3 🔴 Auto-scroll stops on a TAP or a key — never on the pointerdown every scroll starts with', () => {
  const SRC = stripComments(read('app/[slug]/_components/hub-auto-run.tsx'));
  assert.doesNotMatch(SRC, /['"]pointer(down|move)['"]|['"]touch(start|move)['"]/, 'a scroll gesture stops the run');
  assert.match(SRC, /addEventListener\('click', stop\)/, 'a tap must still stop it (owner rule)');
  assert.match(SRC, /addEventListener\('keydown', stop\)/);
  assert.match(SRC, /removeEventListener\('click', stop\)/, 'and the listener is removed on unmount');
});

/* ── 5 — "Plays once" waits for the guest ─────────────────────────────────── */

test('5 ⏳ every "Plays once" arrival binds only on a scene the page has marked `.pahina-in`', () => {
  let rules = 0;
  for (const g of gated(CSS)) {
    for (const m of g.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [, selector, body] = m as unknown as [string, string, string];
      if (!/\.hub-tl-time/.test(selector)) continue;
      if (!/animation(-name)?\s*:|--hub-part-in\s*:/.test(body)) continue;
      rules += 1;
      for (const s of selector.split(',')) {
        assert.match(s, /\.pahina-in/, `\`${s.trim()}\` starts a timed arrival on page LOAD`);
      }
    }
  }
  assert.ok(rules >= 2, `anti-vacuity: the whole and the parts rule were found (${rules})`);
  const css = hubElementSceneCss('schedule', { body: { motion: { in: 'fade' } } })!;
  const before = /(^|\n):has\(\+ style[^{]*\{([^}]*)\}/.exec(css);
  assert.ok(before, 'the not-yet-reached rule exists');
  assert.doesNotMatch(before[2]!, /el-in-/, 'a timed In plays before the guest reaches it');
  assert.match(css, /\.pahina-in:has\(\+ style[^{]*\{[^}]*el-in-fade/, 'and plays once they do');
  // …and the page's ONE observer is what sets the mark.
  const OBS = read('app/[slug]/_components/pahina-motion.tsx');
  assert.match(OBS, /var hsel='\.hub-canvas, style\[data-hub-els\]';/);
});

/* ── 6 — "Goes out" on parts ──────────────────────────────────────────────── */

test('6 🔴 one-after-another parts carry the section\'s Out, not only its In', () => {
  const rule = /\.hub-seq-parts > \.hub-canvas-body > \* > \*\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(rule, 'the one parts rule');
  assert.match(rule[1]!, /animation-name:\s*var\(--hub-part-in, none\),\s*var\(--hub-part-out, none\)/);
  assert.match(CSS, /\.hub-seq-parts\.hub-tl-scrub > \.hub-canvas-body > \* > \*\s*\{[^}]*--hub-part-out:\s*var\(--hub-out-kf/);
});

/* ── 7 — no sideways page ─────────────────────────────────────────────────── */

test('7 ↔ a section whose parts travel sideways clips them on the x axis', () => {
  for (const c of ['hub-in-move', 'hub-in-move_fade', 'hub-out-move', 'hub-out-move_fade']) {
    assert.match(CSS, new RegExp(`\\.${c} > \\.hub-canvas-body[^{]*\\{[^}]*overflow-x:\\s*clip`), `${c} can widen the page`);
  }
});

/* ── 8 — the part's own motion wins, and keeps what it did not choose ──────── */

test('8 🎯 the scene\'s rules carry no id; every element motion rule does — so the element always wins', () => {
  const canvas = CSS.slice(CSS.indexOf('.hub-canvas'));
  for (const m of canvas.matchAll(/([^{}@]+)\{/g)) {
    const sel = m[1]!;
    if (!/\.hub-/.test(sel)) continue;
    assert.doesNotMatch(sel, /#/, `a scene rule with an id can out-rank a part's own motion: ${sel.trim()}`);
  }
  for (const motion of everyMotion()) {
    const css = hubElementSceneCss('schedule', { body: { motion } })!;
    for (const g of gated(css)) {
      for (const r of g.matchAll(/([^{}]+)\{[^{}]*animation:/g)) {
        assert.match(r[1]!, /:not\(#el-own\)\s*$/, `an element motion rule without the boost: ${r[1]}`);
      }
    }
  }
});

test('8 🧩 a part with only Drift still arrives and leaves WITH its scene', () => {
  const d = Object.fromEntries(hubElementMotionDeclarations({ during: 'drift' }));
  assert.match(d.animation ?? '', /var\(--hub-part-in, none\)/, 'Drift replaced the scene\'s arrival');
  assert.match(d.animation ?? '', /var\(--hub-part-out, none\)/, 'Drift replaced the scene\'s hand-off');
  assert.match(d['animation-timeline'] ?? '', /var\(--hub-part-in-tl, auto\)/);
  // 🪤 the name LAST in a slot: `none` first would be read as the fill mode.
  for (const slot of (d.animation ?? '').split(/,\s*(?![^()]*\))/)) {
    assert.match(slot.trim(), /(el-[a-z-]+|var\(--hub-part-(in|out), none\))$/, `a slot whose name is not last: ${slot}`);
  }
});

test('8 🔑 every element motion STATES its timeline and range — a scene\'s view() cannot take it over', () => {
  for (const motion of everyMotion()) {
    const d = Object.fromEntries(hubElementMotionDeclarations(motion));
    assert.ok(d['animation-timeline'], `no timeline for ${JSON.stringify(motion)}`);
    assert.ok(d['animation-range'], `no range for ${JSON.stringify(motion)}`);
    const n = (s: string) => s.split(/,\s*(?![^()]*\))/).length;
    assert.equal(n(d['animation-timeline']!), n(d.animation!), 'one timeline per animation');
  }
});

/* ── 9 — never hidden while it waits ──────────────────────────────────────── */

test('9 ⏳ a timed In never paints its from-state during a Delay', () => {
  for (const place of ['page', 'hero'] as const) {
    const a = Object.fromEntries(hubElementMotionDeclarations({ in: 'rise', delay: 'long' }, place)).animation ?? '';
    assert.match(a, /0\.8s none el-in-rise/, `a delayed In at ${place} is hidden while it waits: ${a}`);
  }
  // The hero is on screen when the page opens: its "Follows the scroll" In plays on arrival.
  const hero = Object.fromEntries(hubElementMotionDeclarations({ in: 'fade', timeline: 'scroll', out: 'lift' }, 'hero'));
  assert.match(hero['animation-timeline'] ?? '', /^auto, view\(\)$/);
});

/* The page renders the gate, not just the library: a real frame, real markup. */
test('🔎 the guest page ships it — the frame renders the gated style after the scene', async () => {
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HubCanvasFrame } = await import('../app/[slug]/_components/hub-canvas-frame');
  const html = renderToStaticMarkup(
    React.createElement(
      HubCanvasFrame,
      {
        widget: {
          widget_id: 'w', event_id: 'e', widget_type: 'schedule', display_order: 1, is_visible: true,
          is_always_on: false, tier: 'basic', created_at: '', updated_at: '',
          config_json: { canvas: { elements: { body: { motion: { in: 'rise', timeline: 'scroll', out: 'fade' } } } } },
        } as never,
      },
      React.createElement('section', null, React.createElement('p', null, 'Words')),
    ),
  );
  const style = /<style hidden="" data-hub-els="schedule">([\s\S]*?)<\/style>/.exec(html);
  assert.ok(style, html);
  assert.equal(gated(style[1]!).length, 1);
  assert.doesNotMatch(ungated(style[1]!), /animation/);
});
