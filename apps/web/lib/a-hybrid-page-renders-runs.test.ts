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
import { HUB_SCENE_CLASSES } from './hub-scenes';

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

test('⭐ a hybrid page emits its runs, its spacers and one progress segment per section', async () => {
  // Each value is the transition INTO THE NEXT scene. A ⟶scrub⟶ B, B → C
  // scroll, C → D scroll, D ⟶scrub⟶ E, E → F auto — but E already belongs to
  // D's scrub run and one scene cannot sit in two runs, so E hands over to F
  // like a page (first come wins, `groupSceneRuns`) — and F is the tail. So:
  // run(A,B) · C · run(D,E) · F.
  const widgets = [row('A', 'scrub'), row('B'), row('C'), row('D', 'scrub'), row('E', 'auto'), row('F', 'scrub')];
  const { html } = await render(widgets, true);

  assert.equal(count(html, /class="hub-scenes"/g), 1, 'one scenes wrapper');
  assert.equal(count(html, /class="hub-run"/g), 2, 'two runs: A·B and D·E');
  assert.equal(count(html, /class="hub-scene hub-scrub"/g), 4, 'four pinned scenes');
  assert.equal(count(html, /class="hub-sp"/g), 4, 'each pinned scene is followed by its spacer');
  assert.equal(count(html, /class="hub-scene hub-scroll"/g), 2, 'C, and F whose Scrub is the ignored tail');
  const bar = html.slice(html.indexOf('hub-prog-bar'), html.indexOf('</span>', html.indexOf('hub-prog-bar')));
  assert.equal(count(bar, /<i /g), 6, 'six segments for six scenes');
  assert.match(html, /class="hub-prog" aria-hidden="true"/, 'the mark is decoration to a screen reader');

  // A run keeps its sections in order, each followed by its own spacer, and
  // spacer and section name the SAME timeline.
  const run1 = html.slice(html.indexOf('class="hub-run"'), html.indexOf('class="hub-scene hub-scroll"'));
  assert.match(
    run1,
    /hub-scrub" style="--hub-tl:--hub-s0"><section>A<\/section><\/div><i class="hub-sp" aria-hidden="true" style="--hub-tl:--hub-s0"><\/i><div class="hub-scene hub-scrub" style="--hub-tl:--hub-s1"><section>B<\/section><\/div><i class="hub-sp" aria-hidden="true" style="--hub-tl:--hub-s1">/,
  );
  // The scope names every section, so the progress mark can see them all.
  assert.match(html, /--hub-scope:--hub-s0, --hub-s1, --hub-s2, --hub-s3, --hub-s4, --hub-s5/);
  // First-of-run / last-of-run / scroll ranges reach the segments.
  assert.match(bar, /--hub-tl:--hub-s0;--hub-pr:entry 0% exit 55%/);
  assert.match(bar, /--hub-tl:--hub-s1;--hub-pr:entry 45% exit 50%/);
  assert.match(bar, /--hub-tl:--hub-s2;--hub-pr:entry 50% exit 50%/);
  assert.match(bar, /--hub-tl:--hub-s3;--hub-pr:entry 0% exit 55%/);
  assert.match(bar, /--hub-tl:--hub-s5;--hub-pr:entry 50% exit 50%/);
});

test('⛔ every class in the exported vocabulary is really emitted (the list the CSS guard trusts)', async () => {
  // A scrub run AND an auto run, so both vocabularies are rendered, not declared.
  const { html } = await render([row('A', 'scrub'), row('B'), row('C', 'auto'), row('D'), row('E')], true);
  for (const c of HUB_SCENE_CLASSES) assert.match(html, new RegExp(`class="[^"]*\\b${c}\\b`), `${c} is emitted`);
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
  assert.match(outside, /\.hub-sp \{ display: none; \}/);
  assert.match(outside, /\.hub-prog \{ display: none; \}/);
  // Nothing that pins or pulls up exists anywhere but inside the gate.
  for (const re of [/\.hub-scrub[^{]*\{[^}]*position:\s*sticky/, /margin-top:\s*-100s?vh/, /timeline-scope:\s*var/, /view-timeline:\s*var/]) {
    assert.doesNotMatch(outside, re, `${re} leaked outside the gate`);
    assert.match(gate, re, `${re} is inside the gate`);
  }
});

test('🔒 the fallback keeps the hub rhythm: sections still stack 1rem apart when nothing pins', () => {
  assert.match(CSS, /\.hub-scenes > \.hub-prog ~ \* ~ \* \{ margin-top: 1rem; \}/);
  assert.match(CSS, /\.hub-run > \.hub-scene ~ \.hub-scene \{ margin-top: 1rem; \}/);
});

test('🔑 the true cross-fade: in over entry 15–75%, out over exit 25–85%, on the spacer timeline', () => {
  const gate = scenesGate();
  assert.match(gate, /animation-range: entry 15% entry 75%, exit 25% exit 85%/, 'a mid-run section does both');
  assert.match(gate, /height: 170vh;\s*view-timeline: var\(--hub-tl\) block;/, 'the spacer is ≥ 100vh and names the timeline');
  assert.match(gate, /height: 100svh;/, 'a pinned section is one phone screen');
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
  assert.match(scenesGate(), /animation: hub-scene-in linear both, hub-scene-out linear forwards;/);
});

test('⛔ an empty scrub section drops out of its run instead of pinning a blank screen', () => {
  const gate = scenesGate();
  assert.match(gate, /\.hub-scrub:empty,\s*\.hub-scrub:has\(> \.hub-canvas > \.hub-canvas-body:empty\) \{ display: none; \}/);
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
    const divert = body.indexOf('if (drafting) await saveCanvasToDraft(', body.indexOf('step.needsPro'));
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
