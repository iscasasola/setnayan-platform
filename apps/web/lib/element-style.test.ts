/**
 * element-style.test.ts — ONE ELEMENT'S OWN LOOK, end to end.
 *
 * Owner, 2026-09-26/27: tapping an element in the Maker changes its font ·
 * colour · size · animation, each overriding the Event Hub's look for that
 * element only (the Keynote rule), each with a reset, Pro at Apply, and never
 * on the RSVP form. What this file proves, by RENDERING where it can:
 *
 *   1. the sanitizer keeps only closed-set values (nothing typed reaches CSS);
 *   2. a stored override reaches a GUEST's page — the hero's parts inline, a
 *      scene's parts through the scoped style the frame writes after it;
 *   3. a reset clears it, and an untouched page is byte-identical;
 *   4. a free couple's override is HELD at Apply, a Pro couple's is written,
 *      and taking one off is free;
 *   5. `data-el` never reaches a guest's markup — only the Maker canvas's;
 *   6. the canvas stamps exactly what the guest style targets (one selector list).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  HUB_SCENE_ELEMENT_SELECTOR,
  hubElementContrast,
  hubElementDeclarations,
  hubElementInlineStyle,
  hubElementSceneCss,
  sanitizeHubElements,
  withElementChoice,
  withoutElement,
} from './element-style';
import { HUB_MOTION_PRESETS, hasHubCanvas, sanitizeHubCanvas } from './hub-canvas';
import { emptyHubDraft, mergeHubDraft, planHubDraftApply, type HubLiveState } from './hub-draft';
import type { InvitationWidgetRow } from './invitation-widgets';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');

/* ── 1 · the sanitizer ─────────────────────────────────────────────────── */

test('the sanitizer keeps closed-set values and drops everything else', () => {
  const got = sanitizeHubElements({
    names: { font: 'cormorant', color: '#AABBCC', size: 'xl', motion: { in: 'rise', during: 'drift', timeline: 'scroll', out: 'lift' } },
    heading: { font: 'Comic Sans', color: 'red', size: 'm', motion: { in: 'bounce', during: 'spin', timeline: 'sideways' } },
    body: { color: '#123456; background:url(x)' },
    mark: { color: '#112233', font: 'fraunces', size: 'l' },
    evil: { color: '#000000' },
    line: 'not an object',
  });
  assert.deepEqual(got, {
    // ♻ the old S · L · XL are carried onto the stepper's scale (85 · 120 · 145)
    names: { font: 'cormorant', color: '#aabbcc', size: 145, motion: { in: 'rise', during: 'drift', timeline: 'scroll', out: 'lift' } },
    // the mark is a drawing: no font or colour of its own
    mark: { size: 120 },
  });
  assert.equal(sanitizeHubElements({ heading: { size: 'm' } }), null, 'M is the theme size — an absence, never stored');
  assert.equal(sanitizeHubElements(null), null);
  assert.equal(sanitizeHubElements([]), null);
});

test("#6019's single Animation choice is carried onto the model — the nearest In + During pair, never dropped", () => {
  // Every old preset name still means something (HUB_MOTION_PRESETS is the list #6019 offered).
  const carried = Object.fromEntries(
    HUB_MOTION_PRESETS.map((p) => [p, sanitizeHubElements({ heading: { anim: p } })?.heading?.motion ?? null]),
  );
  assert.deepEqual(carried, {
    still: null,
    calm: { in: 'fade' },
    editorial: { in: 'rise' },
    cinematic: { in: 'rise', during: 'drift', timeline: 'scroll' },
  });
});

test('the canvas contract carries the elements, and elements alone are not an arrangement', () => {
  const canvas = sanitizeHubCanvas({ canvas: { elements: { heading: { color: '#112233' } } } });
  assert.deepEqual(canvas, { elements: { heading: { color: '#112233' } } });
  assert.equal(hasHubCanvas(canvas), false, 'one heading colour must not frame (and animate) the whole scene');
  assert.equal(hasHubCanvas(sanitizeHubCanvas({ canvas: { preset: 'calm', elements: { heading: { color: '#112233' } } } })), true);
});

test('nothing a couple typed can become CSS text', () => {
  const css = hubElementSceneCss('schedule', sanitizeHubElements({ heading: { color: '#112233}body{display:none' } }));
  assert.equal(css, null);
  assert.equal(hubElementSceneCss('sched"ule', { heading: { color: '#112233' } }), null, 'the scope token is held to [a-z0-9_]');
});

/* ── 2 · a stored override reaches a guest ─────────────────────────────── */

function widget(type: string, config: unknown): InvitationWidgetRow {
  return {
    widget_id: `w-${type}`,
    event_id: 'e1',
    widget_type: type as InvitationWidgetRow['widget_type'],
    display_order: 5,
    is_visible: true,
    is_always_on: false,
    tier: 'basic',
    config_json: config,
    created_at: '',
    updated_at: '',
    mode: 'auto',
  };
}

async function renderFrame(type: string, config: unknown): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HubCanvasFrame } = await import('../app/[slug]/_components/hub-canvas-frame');
  return renderToStaticMarkup(
    React.createElement(
      // `children` arrives as the third argument; the cast only relaxes the
      // prop type's required `children` (react/no-children-prop forbids the prop).
      HubCanvasFrame as unknown as React.FC<{ widget: InvitationWidgetRow; children?: React.ReactNode }>,
      { widget: widget(type, config) },
      React.createElement(
        'section',
        null,
        React.createElement('p', { className: 'pahina-eyebrow' }, 'The day'),
        React.createElement('h2', null, 'Schedule'),
        React.createElement('p', null, 'Ceremony at three.'),
      ),
    ),
  );
}

test("a scene's stored override renders for guests — a scoped style right after the scene", async () => {
  const html = await renderFrame('schedule', {
    canvas: { elements: { heading: { font: 'cinzel', color: '#8a1c2b', size: 'l', motion: { in: 'fade' } } } },
  });
  const m = /<\/section><style hidden="" data-hub-els="schedule">([^<]*)<\/style>$/.exec(html);
  assert.ok(m, `the style must sit straight after the scene, unframed: ${html}`);
  const css = m[1]!;
  assert.match(css, /:has\(\+ style\[data-hub-els="schedule"\]\) :is\(h1, h2, h3, \.hub-tpl-h\)\{/);
  assert.match(css, /color:#8a1c2b !important/);
  assert.match(css, /font-family:var\(--font-cinzel\), Georgia, serif !important/);
  assert.match(css, /zoom:1\.2 !important/);
  // The motion is inside BOTH gates, and "Plays once" binds only once the scene is reached.
  assert.match(css, /@supports \(animation-timeline: view\(\)\)\{@media \(prefers-reduced-motion: no-preference\)\{/);
  assert.match(css, /\.pahina-in:has\(\+ style\[data-hub-els="schedule"\]\) :is\(h1, h2, h3, \.hub-tpl-h\):not\(#el-own\)\{animation:1\.1s [^;]* none el-in-fade/);
  assert.doesNotMatch(html, /class="hub-canvas/, 'elements alone must not frame the scene');
});

test('a framed scene keeps its frame, and the style follows the frame', async () => {
  const html = await renderFrame('schedule', { canvas: { preset: 'still', elements: { body: { color: '#112233' } } } });
  assert.match(html, /^<div class="hub-canvas /);
  assert.match(html, /<\/div><style hidden="" data-hub-els="schedule">[^<]*p:not\(\.pahina-eyebrow\):not\(\.hub-tpl-h\)/);
});

test('⛔ the RSVP form is never element-styled, whatever is stored', async () => {
  const html = await renderFrame('rsvp', { canvas: { elements: { heading: { color: '#112233' } } } });
  assert.doesNotMatch(html, /data-hub-els|<style/);
});

async function renderMasthead(props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PahinaMasthead } = await import('../app/[slug]/_components/pahina-masthead');
  return renderToStaticMarkup(
    React.createElement(PahinaMasthead, {
      displayName: 'Cale & Ice',
      eventDate: '2026-12-18',
      monogramSlot: React.createElement('span', null, 'CI'),
      card: { eyebrow: 'Together with their families', line: 'invite you to celebrate their wedding', timeLabel: '3:00 PM', hubHref: '#hub', hubLabel: 'Open' },
      ...props,
    }),
  );
}

test("the hero's stored override renders for guests, inline on the part it names", async () => {
  const html = await renderMasthead({ elements: { names: { color: '#8a1c2b', size: 'xl' }, time: { font: 'script' } } });
  assert.match(html, /<h1 style="color:#8a1c2b;zoom:1\.45" data-motion="arrive-names"/);
  assert.match(html, /<p style="font-family:var\(--font-script\), cursive" class="mt-2 text-xs/);
  // "Plays once" arrives on the clock — no scroll timeline.
  const moving = await renderMasthead({ elements: { names: { motion: { in: 'rise' } } } });
  // As custom properties the ONE gated rule reads — never a bare inline animation.
  assert.match(moving, /<h1 data-el-motion="" style="--el-anim:1\.1s [^"]* none el-in-rise;--el-tl:auto;--el-range:normal"/);
  assert.doesNotMatch(moving, /style="([^"]*;)?animation(-timeline|-range)?:/);
});

/* ── 3 · a reset clears it; an untouched page is byte-identical ───────── */

test('a reset clears one field, then the element, then the list', () => {
  const start = sanitizeHubElements({ heading: { font: 'cinzel', color: '#112233' }, body: { size: 's' } });
  const noFont = withElementChoice(start, 'heading', 'font', null);
  assert.deepEqual(noFont, { heading: { color: '#112233' }, body: { size: 85 } });
  const noHeading = withElementChoice(noFont, 'heading', 'color', null);
  assert.deepEqual(noHeading, { body: { size: 85 } }, 'an element with nothing left disappears');
  assert.deepEqual(withElementChoice(noHeading, 'body', 'size', 100), null, '100 (the theme size) is the reset for size');
  assert.equal(withoutElement(start, 'heading')?.heading, undefined);
});

test('an untouched scene and hero render exactly as before', async () => {
  const bare = await renderFrame('schedule', {});
  assert.doesNotMatch(bare, /<style|data-hub-els|data-el/);
  const withNull = await renderMasthead({ elements: null });
  const without = await renderMasthead({});
  assert.equal(withNull, without);
  assert.doesNotMatch(without, /style=|data-el/);
  assert.equal(hubElementInlineStyle(undefined), undefined);
  assert.deepEqual(hubElementDeclarations({}), []);
});

/* ── 4 · Pro at Apply ──────────────────────────────────────────────────── */

const LIVE: HubLiveState = {
  events: {},
  widgets: [
    { ...widget('hero', {}), is_always_on: true, display_order: 1 },
    widget('schedule', { canvas: { preset: 'calm' }, keep: 'me' }),
  ],
};

test('a free couple may TRY an element style — Apply holds it back; a Pro couple has it written', () => {
  const draft = mergeHubDraft(emptyHubDraft(), {
    widgets: { hero: { canvas: { elements: { names: { color: '#8a1c2b' } } } } },
  });
  const free = planHubDraftApply(draft, LIVE, false);
  assert.equal(free.apply.length, 0, 'nothing unpaid reaches the live page');
  assert.equal(free.refused.length, 1);
  assert.equal(free.refused[0]!.kind === 'widget' && free.refused[0]!.field, 'canvas');
  const pro = planHubDraftApply(draft, LIVE, true);
  assert.equal(pro.apply.length, 1);
});

test('taking an element style OFF is free, even while another element keeps its own', () => {
  const live: HubLiveState = {
    events: {},
    widgets: [
      widget('schedule', { canvas: { elements: { heading: { color: '#112233' }, body: { size: 'l' } } } }),
    ],
  };
  const draft = mergeHubDraft(emptyHubDraft(), {
    // ♻ a saved 'L' and the stepper's 120 are the SAME size — not a change.
    widgets: { schedule: { canvas: { elements: { body: { size: 120 } } } } },
  });
  const plan = planHubDraftApply(draft, live, false);
  assert.equal(plan.refused.length, 0, 'a removal is never held');
  assert.equal(plan.apply.length, 1);
});

/* ── 5 · data-el never reaches a guest ─────────────────────────────────── */

test('⛔ data-el is absent from guest HTML — stamped only in the Maker canvas', async () => {
  const guest = await renderMasthead({ elements: { names: { color: '#112233' } } });
  assert.doesNotMatch(guest, /data-el=/);
  const canvas = await renderMasthead({ stampElements: true });
  for (const el of ['eyebrow', 'mark', 'names', 'line', 'date', 'time']) {
    assert.match(canvas, new RegExp(`data-el="${el}"`), `the canvas marks the ${el}`);
  }
  const scene = await renderFrame('schedule', { canvas: { elements: { heading: { color: '#112233' } } } });
  assert.doesNotMatch(scene, /data-el=/);
  // Every masthead mount passes the stamp from ONE switch — the Maker canvas's.
  const body = stripComments(readFileSync(join(WEB, 'app/[slug]/_components/site-body.tsx'), 'utf8'));
  assert.match(body, /stampElements: isMakerCanvas,/);
  const mounts = body.split('<PahinaMasthead').length - 1;
  const spread = body.split('{...heroElements}').length - 1;
  assert.equal(spread, mounts, `${mounts} masthead mounts, ${spread} carry the hero's element styles`);
});

/* ── 6 · the canvas stamps exactly what the guest style targets ───────── */

test('the bridge stamps by the SAME selector list the guest style uses', () => {
  const bridge = stripComments(readFileSync(join(WEB, 'app/[slug]/_components/editor-bridge.tsx'), 'utf8'));
  assert.match(bridge, /querySelectorAll<HTMLElement>\(HUB_SCENE_ELEMENT_SELECTOR\[el\]\)/);
  assert.match(bridge, /HUB_ELEMENT_EXCLUDED_WIDGETS\.includes/);
  const css = hubElementSceneCss('schedule', { label: { color: '#111111' }, heading: { color: '#222222' }, body: { color: '#333333' } })!;
  for (const sel of Object.values(HUB_SCENE_ELEMENT_SELECTOR)) {
    assert.ok(css.includes(`:is(${sel})`), `the guest style targets ${sel}`);
  }
});

test('the contrast warning measures, and never blocks', () => {
  assert.equal(hubElementContrast('#2b241c', '#ffffff').ok, true);
  const pale = hubElementContrast('#e8dcc0', '#ffffff');
  assert.equal(pale.ok, false);
  assert.ok(pale.ratio < 4.5);
});
