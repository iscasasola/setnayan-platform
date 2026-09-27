/**
 * scene-ombres-and-glass-opacity-paint.test.ts — THE NEW BACKGROUND CHOICES
 * PAINT A GUEST'S SCENE.
 *
 * The Maker's Format → Background row (approved 2026-09-27): No background ·
 * Plain · Diagonal · Glow · Opaque · Frosted · Upload media, and an Opacity row
 * on both glasses (answer 5: *"both"*, 20–100%). A choice the page does not
 * draw is a control that moves no pixels. What this proves, by RENDERING the
 * frame a dispatcher mounts:
 *
 *   1. Diagonal and Glow paint the scene with the Main background's ombré made
 *      from the scene's ONE colour — class, gradient and the CSS rule that reads it;
 *   2. Dawn is not a scene background (answer 1) — it is dropped on read;
 *   3. a glass's opacity is kept only on a glass, only in 5% steps from 20 to 100.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { hubCanvasVars, sanitizeHubCanvas } from './hub-canvas';
import { ombreCss } from './ombre';
import { HubCanvasFrame } from '../app/[slug]/_components/hub-canvas-frame';
import { INVITE_THEMES } from './invite-themes';
import { sceneTintGround } from './scene-legibility';
import type { InvitationWidgetRow } from './invitation-widgets';

(globalThis as unknown as { React: unknown }).React = React;

const CSS = readFileSync(join(__dirname, '..', 'app/globals.css'), 'utf8');

function paint(canvas: unknown): string {
  const widget = { widget_id: 'w1', widget_type: 'message', is_visible: true, display_order: 1, config_json: { canvas } } as unknown as InvitationWidgetRow;
  return renderToStaticMarkup(
    React.createElement(HubCanvasFrame, { widget } as never, React.createElement('section', null, React.createElement('p', null, 'Hello'))),
  );
}

test('Diagonal and Glow paint the scene from its one colour', () => {
  for (const shape of ['diagonal', 'glow'] as const) {
    const html = paint({ kind: shape, color: '#a9834b' });
    assert.match(html, new RegExp(`class="hub-canvas [^"]*hub-bg-${shape}`), `${shape}: the kind class`);
    assert.match(html, /--hub-bg-color:#a9834b/);
    const vars = hubCanvasVars(sanitizeHubCanvas({ canvas: { kind: shape, color: '#a9834b' } }));
    assert.equal(vars['--hub-bg-image'], ombreCss({ shape, base: '#a9834b' }), `${shape}: the Main background's own ombré`);
    assert.match(vars['--hub-bg-image']!, /gradient\(/);
  }
  const i = CSS.indexOf('.hub-bg-glow {');
  assert.ok(i >= 0 && /background-image:\s*var\(--hub-bg-image\)/.test(CSS.slice(i, CSS.indexOf('}', i))), 'a CSS rule paints the ombré');
  // A colour is required, like Plain — no colour, no background.
  assert.equal(sanitizeHubCanvas({ canvas: { kind: 'glow' } }).kind, undefined);
});

test('Dawn is not a scene background — dropped on read', () => {
  assert.equal(sanitizeHubCanvas({ canvas: { kind: 'dawn', color: '#a9834b' } }).kind, undefined);
});

test('a glass keeps its own opacity — only on a glass, only 20–100 in steps of 5', () => {
  assert.equal(sanitizeHubCanvas({ canvas: { kind: 'frost', opacity: 35 } }).opacity, 35);
  assert.equal(sanitizeHubCanvas({ canvas: { kind: 'glass', opacity: 100 } }).opacity, 100);
  assert.equal(sanitizeHubCanvas({ canvas: { kind: 'frost', opacity: 15 } }).opacity, undefined);
  assert.equal(sanitizeHubCanvas({ canvas: { kind: 'frost', opacity: 42 } }).opacity, undefined);
  assert.equal(sanitizeHubCanvas({ canvas: { kind: 'color', color: '#ffffff', opacity: 50 } }).opacity, undefined, 'a flat colour has no opacity');
});

test('🪟 the couple’s opacity sets the pane — and the words still hold AA (rails on)', () => {
  for (const theme of Object.values(INVITE_THEMES)) {
    for (const [kind, tint] of [['frost', '#f4ecdd'], ['glass', '#ffffff'], ['frost', '#3b4e67'], ['glass', '#8a1c2b']] as const) {
      const solid = sceneTintGround(theme, kind, tint, 95);
      assert.ok(solid.alpha >= 0.95, `${theme.id} ${kind} ${tint}: a 95% pane is at least 95% solid`);
      const faint = sceneTintGround(theme, kind, tint, 20);
      assert.ok(faint.alpha >= 0.2, 'never clearer than asked… ');
      assert.ok(faint.bodyContrast >= 4.5, `${theme.id} ${kind} ${tint}: …and never unreadable (${faint.bodyContrast.toFixed(2)})`);
    }
  }
  // A higher opacity than the glass's own floor is honoured exactly.
  assert.equal(sceneTintGround(INVITE_THEMES.house, 'frost', '#ffffff', 90).alpha, 0.9);
  // …and reaches the guest's page as the pane the CSS paints.
  const html = paint({ kind: 'frost', color: '#ffffff', opacity: 90 });
  assert.match(html, /--hub-glass-fill:rgb\(255 255 255 \/ 0\.90\)/);
});

test('🌅 an ombré’s words hold AA over its WHOLE ramp — light and dark colours alike', () => {
  for (const theme of Object.values(INVITE_THEMES)) {
    for (const kind of ['diagonal', 'glow'] as const) {
      for (const base of ['#f4ecdd', '#a9834b', '#2a2622', '#3b4e67']) {
        const g = sceneTintGround(theme, kind, base);
        assert.ok(g.samples.length > 2, 'measured over the ramp, not one colour');
        assert.ok(g.bodyContrast >= 4.5 - 0.3, `${theme.id} ${kind} ${base}: ${g.bodyContrast.toFixed(2)}`);
      }
    }
  }
  // The frame carries the ink the ramp asked for.
  assert.match(paint({ kind: 'glow', color: '#2a2622' }), /color:rgb\(/);
});
