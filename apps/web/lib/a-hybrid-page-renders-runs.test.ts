/**
 * a-hybrid-page-renders-runs.test.ts — THE SCENES REACH THE MARKUP, AND FAIL TO
 * THE PLAIN PAGE.
 *
 * Owner 2026-09-24, "hybrid perfect": some sections Scrub (pin, cross-fade with
 * the next scrub section), some Scroll; "still have a fallback for phones who
 * cannot run the effect". The contract is executed in `hub-scenes.test.ts`;
 * this file RENDERS `HubScenes` and reads the stylesheet, because a correct
 * contract that never reaches the page is the defect this build exists to avoid.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { HUB_SCENE_CLASSES, SCENE_PROGRESS_RANGE } from './hub-scenes';
import { HUB_SCRUB_CLASSES, HUB_SCRUB_RETIRED_CLASSES } from '../app/[slug]/_components/hub-scrub-math';

const row = (id: string, transition?: string) =>
  ({
    widget_id: id,
    event_id: 'E1',
    widget_type: 'custom_1',
    config_json: transition ? { canvas: { transition } } : null,
  }) as never;

async function render(widgets: unknown[], scrubAllowed: boolean): Promise<{ html: string; children: string }> {
  const React = (await import('react')).default;
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HubScenes } = await import('../app/[slug]/_components/hub-scenes');
  const Scenes = HubScenes as unknown as React.FunctionComponent<Record<string, unknown>>;
  const kids = widgets.map((w) =>
    React.createElement('section', { key: (w as { widget_id: string }).widget_id }, (w as { widget_id: string }).widget_id),
  );
  return {
    html: renderToStaticMarkup(React.createElement(Scenes, { widgets, scrubAllowed }, kids)),
    children: renderToStaticMarkup(React.createElement(React.Fragment, null, kids)),
  };
}

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

/* 🔁 RE-AIMED 2026-10-09 (commit 8c — owner: *"element run completely normal. we only control the effect"* · *"them must
   be on the same position to create that keynote like transistion"*): a Scrub scene is NO LONGER drawn as a stacked
   run (`hub-run` › `hub-scrub` + `hub-sp`). Every scene stays an ordinary scene in page order; one that hands over is
   wrapped, with the rest of the page, in a cell the engine holds still (`hub-scenes.tsx` `flow`). The claims are the
   same — the choice reaches the markup, in order, with one progress segment a scene — on the new shape. */
test('⭐ a hybrid page emits its hand-overs, every scene in page order, and one progress segment per section', async () => {
  // Each value is the transition INTO THE NEXT scene. A ⟶scrub⟶ B, B → C scroll, C → D scroll, D ⟶scrub⟶ E,
  // E → F auto — but E already belongs to D's hand-over and one scene cannot sit in two (first come wins,
  // `groupSceneRuns`) — and F is the tail, whose own Scrub has nothing to hand over to.
  const widgets = [row('A', 'scrub'), row('B'), row('C'), row('D', 'scrub'), row('E', 'auto'), row('F', 'scrub')];
  const { html } = await render(widgets, true);

  assert.equal(count(html, /class="hub-scenes"/g), 1, 'one scenes wrapper');
  assert.equal(count(html, /class="hub-cell"/g), 2, 'two hand-overs: A → B and D → E');
  assert.equal(count(html, /class="hub-stage"/g), 2);
  assert.equal(count(html, /class="hub-after"/g), 2);
  assert.equal(count(html, /class="hub-scene hub-scroll"/g), 6, 'every scene is an ordinary scene');
  for (const c of HUB_SCRUB_RETIRED_CLASSES) assert.doesNotMatch(html, new RegExp(`class="[^"]*\\b${c}\\b`), `${c} is the stacked run — it is not drawn any more`);
  /* PAGE ORDER, untouched: nothing is stacked, nothing re-ordered. */
  assert.deepEqual([...html.matchAll(/<section>(\w)<\/section>/g)].map((m) => m[1]), ['A', 'B', 'C', 'D', 'E', 'F']);
  /* Whose effects are played under the thumb: a scene that Leaves by Scrub, and the scene after one. Not C. */
  const fx = [...html.matchAll(/<div class="hub-scene hub-scroll" style="[^"]*"( data-hub-fx="")?><section>(\w)</g)].filter((m) => m[1]).map((m) => m[2]);
  assert.deepEqual(fx, ['A', 'B', 'D', 'E', 'F']);
  const bar = html.slice(html.indexOf('hub-prog-bar'), html.indexOf('</span>', html.indexOf('hub-prog-bar')));
  assert.equal(count(bar, /<i /g), 6, 'six segments for six scenes');
  assert.match(html, /class="hub-prog" aria-hidden="true"/, 'the mark is decoration to a screen reader');

  // A hand-over: the leaving scene, then THE REST OF THE PAGE — its first scene is the arrival, what follows the
  // pair is in its own wrapper — all inside the one stage that stands still. Each scene names its own timeline.
  assert.match(
    html,
    /<div class="hub-cell"><div class="hub-stage"><div class="hub-scene hub-scroll" style="--hub-tl:--hub-s0" data-hub-fx=""><section>A<\/section><\/div><div class="hub-after"><div class="hub-scene hub-scroll" style="--hub-tl:--hub-s1" data-hub-fx=""><section>B<\/section><\/div><div class="hub-below"><div class="hub-scene hub-scroll" style="--hub-tl:--hub-s2"><section>C<\/section><\/div><div class="hub-cell">/,
  );
  /* …and the second hand-over is INSIDE the first one's rest of the page (while A hands over, all of it stands). */
  assert.ok(html.indexOf('<section>D</section>') > html.indexOf('class="hub-below"'), 'the later hand-over is not inside the earlier one’s page');
  // The scope names every section, so the progress mark can see them all.
  assert.match(html, /--hub-scope:--hub-s0, --hub-s1, --hub-s2, --hub-s3, --hub-s4, --hub-s5/);
  // Every segment fills on the ONE line (`SCENE_PROGRESS_RANGE`), so they fill strictly in page order.
  for (let i = 0; i < 6; i++) {
    assert.ok(bar.includes(`--hub-tl:--hub-s${i};--hub-pr:${SCENE_PROGRESS_RANGE}`), `segment ${i} carries the one range`);
  }
  /* Nothing the engine sets is in the server's markup: unarmed, these wrappers are plain blocks. */
  assert.doesNotMatch(html, /data-hub-scrub-on|--hub-len|--hub-top|--hub-up|data-hub-away|<script/);
});

test('⛔ a scene with NO Build out hands nothing over: it stays an ordinary scene, and the next builds in below it', async () => {
  const still = { widget_id: 'A', event_id: 'E1', widget_type: 'custom_1', config_json: { canvas: { transition: 'scrub', out: 'none' } } } as never;
  const { html } = await render([still, row('B'), row('C')], true);
  assert.equal(count(html, /class="hub-cell"/g), 0, 'a hold with nothing to play');
  assert.deepEqual([...html.matchAll(/data-hub-fx=""[^>]*>(?:<div[^>]*>)*<section>(\w)</g)].map((m) => m[1]), ['A', 'B'], 'both still play their effects under the thumb');
  /* …and the LAST scene of a page has nothing to hand over to, whatever it is set to. */
  assert.equal(count((await render([row('A'), row('B', 'scrub')], true)).html, /class="hub-cell"/g), 0);
});

test('⛔ every class in the exported vocabulary is really emitted (the list the CSS guard trusts)', async () => {
  // A hand-over AND an auto run, so both vocabularies are rendered, not declared.
  const { html } = await render([row('A', 'scrub'), row('B'), row('C', 'auto'), row('D'), row('E')], true);
  for (const c of [...HUB_SCENE_CLASSES, ...HUB_SCRUB_CLASSES]) assert.match(html, new RegExp(`class="[^"]*\\b${c}\\b`), `${c} is emitted`);
  /* 🔁 RE-AIMED 2026-10-09 (the cleanup): the stacked run's stylesheet is REMOVED, so its three classes left the
     vocabulary with it — and no rule may name them again (a rule on a class nothing emits is dead weight a later
     reader takes for a live mechanism). */
  for (const c of HUB_SCRUB_RETIRED_CLASSES) {
    assert.ok(!(HUB_SCENE_CLASSES as readonly string[]).includes(c), `${c} is back in the vocabulary`);
    assert.doesNotMatch(CSS, new RegExp(`\\.${c}(?![\\w-])`), `the stylesheet names .${c} — the stacked Scrub run is gone`);
  }
});

test('🎬 an auto run renders its scenes in ONE wrapper, one progress segment, and the page is otherwise untouched', async () => {
  const { html } = await render([row('A'), row('B', 'auto'), row('C', 'auto'), row('D'), row('E')], true);
  assert.equal(count(html, /class="hub-arun"/g), 1, 'one auto run: B·C·D');
  assert.equal(count(html, /class="hub-scene hub-auto"/g), 3);
  assert.equal(count(html, /class="hub-scene hub-scroll"/g), 2, 'A and E scroll');
  const bar = html.slice(html.indexOf('hub-prog-bar'), html.indexOf('</span>', html.indexOf('hub-prog-bar')));
  assert.equal(count(bar, /<i /g), 3, 'A · the run · E');
  // Unarmed on the server: no data-armed, so no rule that hides a scene applies.
  assert.doesNotMatch(html, /data-armed|data-playing|data-auto-in|data-auto-out/);
});

test('⛔ NO SCRUB, NO CHANGE — the page is byte-identical to the children', async () => {
  for (const [label, widgets, pro] of [
    ['nobody chose anything', [row('A'), row('B')], true],
    ['Auto-scroll without Pro', [row('A', 'auto'), row('B', 'auto')], false],
    ['Scrub without Pro', [row('A', 'scrub'), row('B', 'scrub')], false],
    ['a malformed value', [row('A', 'hold'), row('B', 'move')], true],
    ['Scrub only on the LAST scene (the tail has no next)', [row('A'), row('B', 'scrub')], true],
  ] as const) {
    const { html, children } = await render([...widgets], pro);
    assert.equal(html, children, label);
  }
});

test('⛔ if the node list and the widget list disagree, nothing is paired by position', async () => {
  const React = (await import('react')).default;
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HubScenes } = await import('../app/[slug]/_components/hub-scenes');
  const Scenes = HubScenes as unknown as React.FunctionComponent<Record<string, unknown>>;
  const html = renderToStaticMarkup(
    React.createElement(Scenes, { widgets: [row('A', 'scrub'), row('B', 'scrub')], scrubAllowed: true }, [
      React.createElement('section', { key: 'A' }, 'A'),
    ]),
  );
  assert.equal(html, '<section>A</section>');
});

/* ══ THE STYLESHEET: FALLBACK FIRST, EFFECT ONLY BEHIND EVERY GATE ════════ */

const CSS = stripComments(readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8'));

function blockAfter(src: string, at: number): string {
  const open = src.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  assert.fail('unclosed block');
}

/** The scenes gate: nested INSIDE the canvas's view() + reduced-motion gates. */
function scenesGate(): string {
  const view = CSS.indexOf('@supports (animation-timeline: view())');
  assert.ok(view > 0);
  const outer = blockAfter(CSS, view);
  assert.match(outer, /@media \(prefers-reduced-motion: no-preference\)/);
  const at = outer.indexOf('@supports (animation-range: entry 0% exit 100%) and (timeline-scope: none)');
  assert.ok(at > 0, 'the timeline-scope gate sits inside the view() + reduced-motion gates');
  return blockAfter(outer, at);
}

test('🔒 the plain page is the default: spacers and the mark are not drawn outside the gate', () => {
  const gate = scenesGate();
  const outside = CSS.replace(gate, '');
  assert.match(outside, /\.hub-prog \{ display: none; \}/);
  // Nothing that names a timeline across siblings exists anywhere but inside the gate.
  for (const re of [/timeline-scope:\s*var/, /view-timeline:\s*var/]) {
    assert.doesNotMatch(outside, re, `${re} leaked outside the gate`);
    assert.match(gate, re, `${re} is inside the gate`);
  }
  /* 🔁 RE-AIMED 2026-10-09 (the cleanup): the stacked run's spacer, pinned frame and grid are GONE from the whole
     stylesheet. What holds a Scrub scene now is the one sticky stage of "SCRUB — A HELD HAND-OVER", and it needs the
     mark only the script sets — so the plain page is still the default (`scrub-is-a-held-hand-over` (5)). */
  for (const re of [/grid-template-rows:\s*repeat\(var\(--hub-n/, /--hub-step\b/, /--hub-at\b/]) assert.doesNotMatch(CSS, re, `${re} — the stacked run is back`);
  const sticky = [...CSS.matchAll(/([^{}]*)\{[^{}]*position:\s*sticky[^{}]*\}/g)].map((m) => m[1]!.trim()).filter((sel) => /hub-(?:stage|scene|cell|after|below)/.test(sel));
  assert.deepEqual(sticky, ['.hub-scenes[data-hub-scrub-on] .hub-stage'], 'a scene is held by something other than the engine-marked stage');
});

test('🔒 the fallback keeps the hub rhythm: sections still stack 1rem apart when nothing pins', () => {
  assert.match(CSS, /\.hub-scenes > \.hub-prog ~ \* ~ \* \{ margin-top: 1rem; \}/);
  /* 🔁 RE-AIMED 2026-10-09 (the cleanup): the stacked run's own 1rem rule went with it; the same rhythm is now the
     hand-over nest's (cell › stage › scene, then the rest of the page). */
  assert.match(CSS, /\.hub-stage > \.hub-after,\s*\.hub-after > \.hub-below,\s*\.hub-below > \* \+ \* \{ margin-top: 1rem; \}/);
});

/* 🔁 RE-AIMED 2026-10-09 (the cleanup). This held the stacked run's cross-fade — IN leading OUT around the pin line on
   a spacer's timeline. Scrub is no longer a cross-fade of two pinned frames: the leaving scene's Build out plays
   first and the arrival begins when it is 80 % done, in the same place (owner: "let it enter on the last 20% of the
   build out"). That ORDER is executed in `scrub-is-a-held-hand-over.test.ts` (1) and played in a browser
   (`scripts/scrub-browser-check.mjs`). What stays here is the stylesheet's half: ONE fade a scene, driven by the
   script's number — and none of the old timeline fades left to fight it. */
test('🔑 the Scrub hand-over is one scripted fade a scene — the spacer-timeline cross-fade is gone', () => {
  assert.match(CSS, /\.hub-scenes\[data-hub-scrub-on\] \.hub-scene\[data-hub-fx\] \{ opacity: var\(--hub-o, 1\); \}/);
  assert.doesNotMatch(CSS, /animation: hub-scene-(?:in|out) linear/, 'a scene fades on a view timeline again');
  assert.doesNotMatch(CSS, /grid-column: 2;\s*view-timeline/, 'the spacer column is back');
});

test('⌨ a fully faded scene cannot take focus: visibility is hidden at, and only at, the faded end', () => {
  const kf = (name: string) => {
    const at = CSS.indexOf(`@keyframes ${name}`);
    assert.ok(at > 0, name);
    return blockAfter(CSS, at);
  };
  const inn = kf('hub-scene-in');
  const out = kf('hub-scene-out');
  assert.match(inn, /from \{[^}]*opacity: 0;[^}]*visibility: hidden;/);
  assert.match(inn, /to\s+\{[^}]*opacity: 1;[^}]*visibility: visible;/);
  assert.match(out, /from \{[^}]*opacity: 1;[^}]*visibility: visible;/);
  assert.match(out, /to\s+\{[^}]*opacity: 0;[^}]*visibility: hidden;/);
  // The fade-out keeps its end state (forwards); the fade-in holds its start before its window (both).
  /* 🔁 RE-AIMED 2026-10-09 (the cleanup): the keyframes are the Auto run's now (the stacked Scrub run that also
     used them is removed) — on its clock, same fills. A Scrub scene that has left is taken off the tab order by its
     own mark instead. */
  assert.match(scenesGate(), /animation: hub-scene-in var\(--hub-fade\) linear both, hub-scene-out var\(--hub-fade\) linear forwards;/);
  assert.match(CSS, /\.hub-scenes\[data-hub-scrub-on\] \.hub-scene\[data-hub-fx\]\[data-hub-away\] \{ visibility: hidden; \}/);
});

/* 🔁 RE-AIMED 2026-10-09 (the cleanup). The property stands — a widget that drew nothing must never hold a blank
   screen — but the stacked run's rule that kept it is removed. It is kept now by: the scene's own rule (an empty
   scene is no box at all), the nest's rhythm (no second gap where it was), and the ENGINE, which holds nothing for a
   scene with no height. Played in a browser too (`scripts/scrub-browser-check.mjs`, the empty-scene case). */
test('⛔ an empty Scrub scene holds nothing — no blank screen stands still', () => {
  assert.match(CSS, /\.hub-scene:empty,\s*\.hub-scene:has\(> \.hub-canvas > \.hub-canvas-body:empty\) \{ display: none; \}/);
  assert.match(CSS, /\.hub-stage > \.hub-scene:empty \+ \.hub-after,\s*\.hub-stage > \.hub-scene:has\(> \.hub-canvas > \.hub-canvas-body:empty\) \+ \.hub-after \{ margin-top: 0; \}/);
  const engine = stripComments(readFileSync(join(__dirname, '..', 'app/[slug]/_components/hub-scrub-engine.ts'), 'utf8'));
  assert.match(engine, /if \(scene\.offsetHeight === 0\) \{[^}]*put\(cell, '--hub-len', null\);[^}]*continue;\s*\}/, 'the engine holds the page for a scene that drew nothing');
});

test('🪤 no selector nests :has() inside :has() — the browser drops the WHOLE rule', () => {
  // Measured on this branch: the look-ahead was written `:has(~ x:has(…))`, the
  // fade-out rule vanished, and the cross-fade measured 0 of 80 positions.
  const gate = scenesGate();
  for (const m of gate.matchAll(/:has\(/g)) {
    const at = m.index ?? 0;
    let depth = 0;
    for (let i = at + 4; i < gate.length; i += 1) {
      if (gate[i] === '(') depth += 1;
      else if (gate[i] === ')') {
        if (depth === 0) {
          assert.doesNotMatch(gate.slice(at + 5, i), /:has\(/, `nested :has() near: ${gate.slice(at, i + 1)}`);
          break;
        }
        depth -= 1;
      }
    }
  }
});

/* ══ THE WRITER'S GATE ═══════════════════════════════════════════════════ */

test('⛔ setWidgetMotion refuses a free couple landing on Scrub / Auto-scroll — server-side, not just the chip', () => {
  const src = stripComments(
    readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'website', 'widgets', 'actions.ts'), 'utf8'),
  );
  const at = src.indexOf('export async function setWidgetMotion');
  assert.ok(at > 0);
  const body = src.slice(at, src.indexOf('\nexport async function', at + 10));
  assert.match(
    body,
    /const step = nextTransition\(canvas, transitionRaw, autoSpeedRaw\);\s*if \((?:!drafting && )?step\.needsPro && !\(await eventCoupleWebsiteProActive\(createAdminClient\(\), eventId\)\)\) \{\s*redirect\(`\/dashboard\/\$\{eventId\}\/studio\/website-pro`\);/,
  );
  // …and the gate runs BEFORE the row is written.
  assert.ok(body.indexOf('step.needsPro') < body.indexOf('.update({ config_json: next })'));
  // 💾 Event Hub Maker Phase 2: the gate is skipped ONLY for a DRAFT save
  // (`draft=1`), which diverts to the draft BEFORE this live update and never
  // reaches it — the Pro gate for a draft is `hubDraftAction` apply
  // (`lib/hub-draft-wiring.test.ts` holds both halves).
  if (/!drafting && step\.needsPro/.test(body)) {
    const divert = body.indexOf('if (drafting) return saveCanvasToDraft(', body.indexOf('step.needsPro'));
    assert.ok(divert > 0 && divert < body.indexOf('.update({ config_json: next })'), 'a skipped gate must divert to the draft before the live write');
  }
});

/* ══ AUTO RUNS IN THE STYLESHEET ═════════════════════════════════════════ */

test('🎬 the auto clock lives behind every gate AND the island’s own [data-armed] — no script, no hiding', () => {
  const gate = scenesGate();
  for (const attr of ['data-auto-in', 'data-auto-out', 'data-auto-skip']) {
    const rules = [...gate.matchAll(/([^{}]*)\{/g)].map((m) => m[1] as string).filter((r) => r.includes(`[${attr}]`));
    assert.ok(rules.length > 0, `${attr} is styled inside the gate`);
    for (const r of rules) assert.match(r, /\.hub-arun\[data-armed\]/, `${attr} rule is armed-only: ${r.trim()}`);
  }
  const outside = CSS.replace(gate, '');
  assert.doesNotMatch(outside, /data-auto-(in|out|skip)|\.hub-arun\[data-armed\]/, 'nothing outside the gate touches the clock');
});

test('🪤 "playing" out-ranks "paused" — measured: at a lower specificity nothing ever moved', () => {
  const gate = scenesGate();
  const paused = gate.indexOf('.hub-arun[data-armed] > .hub-auto[data-auto-in][data-auto-out] {');
  const running = gate.indexOf('.hub-arun[data-armed][data-playing] > .hub-auto[data-auto-in][data-auto-out] {');
  assert.ok(paused > 0 && running > paused, 'the running rule is as specific as the paused one and comes after it');
  assert.match(gate.slice(running, gate.indexOf('}', running)), /animation-play-state:\s*running/);
});
