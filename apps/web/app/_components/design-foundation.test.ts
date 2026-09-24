/**
 * design-foundation.test.ts — the shared pieces keep the owner's 2026-09-24
 * rulings, and the tokens they are built on resolve.
 *
 * Covers what the piece-specific suites (`info-tip.test.ts`,
 * `readout.test.ts`, `lib/no-card-guard.test.ts`) do not:
 *   1. every token the Tailwind theme EXPOSES is defined in globals.css — an
 *      undefined `var()` compiles fine and silently resolves to nothing;
 *   2. the new layers carry no border (owner: "glass layers drop their hairline");
 *   3. the side panel never HOLDS a transform (lingering-transform rule) and
 *      makes its `aria-modal` promise through the shared hook;
 *   4. Section separates by space, not a box; the exit wait honours reduced motion.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..', '..');
const CSS = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');
const TW = stripComments(readFileSync(join(WEB, 'tailwind.config.ts'), 'utf8'));

/** The body of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = CSS.match(new RegExp(`(^|\\n)${esc}\\s*\\{([^}]*)\\}`));
  assert.ok(m, `no rule for ${selector} in globals.css`);
  return m[2] ?? '';
}

test('every var() the Tailwind theme exposes for the foundation is defined', () => {
  const block = TW.slice(TW.indexOf('boxShadow:'), TW.indexOf('colors:'));
  const used = [...block.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]);
  assert.ok(used.length >= 20, `expected the foundation keys, found ${used.length} var()s`);
  for (const name of used) {
    assert.match(CSS, new RegExp(`${name}\\s*:`), `${name} is exposed to Tailwind but never defined`);
  }
});

test('the z-scale is ordered the way the stack actually is', () => {
  const z = (n: string) => Number(CSS.match(new RegExp(`--sn-z-${n}:\\s*(\\d+)`))?.[1]);
  const order = ['base', 'raised', 'sticky', 'nav', 'pop', 'modal', 'toast', 'scrim', 'panel'] as const;
  order.slice(1).forEach((name, i) => {
    const below = order[i] as string;
    assert.ok(z(name) > z(below), `--sn-z-${name} must sit above --sn-z-${below}`);
  });
  // The side panel sits exactly where the guest card's sheet already does.
  assert.equal(z('scrim'), Number(rule('.sn-inspector-peek').match(/z-index:\s*(\d+)/)?.[1]));
  assert.equal(z('panel'), Number(rule('.sn-inspector-sheet').match(/z-index:\s*(\d+)/)?.[1]));
});

test('the new layers are borderless — seated by shadow, not a hairline', () => {
  for (const sel of ['.sn-glass-bare', '.sn-side-panel', '.sn-tip-body', '.sn-section']) {
    assert.doesNotMatch(rule(sel), /(^|[\s;])border(-left|-right|-top|-bottom)?\s*:/, `${sel} carries a border`);
  }
  assert.match(rule('.sn-glass-bare'), /box-shadow:/);
  assert.match(rule('.sn-side-panel'), /box-shadow:/);
  // `.sn-glass` keeps its border ON PURPOSE (it bounds nine existing panels).
  assert.match(rule('.sn-glass'), /border:/);
});

test('the side panel never holds a transform, and keeps its aria-modal promise', () => {
  for (const sel of ['.sn-side-panel', '.sn-side-panel-scrim', '.sn-canvas-drift::before']) {
    assert.doesNotMatch(rule(sel), /animation:[^;]*\b(both|forwards)\b/, `${sel} animation holds its end state`);
  }
  const code = stripComments(readFileSync(join(__dirname, 'side-panel.tsx'), 'utf8'));
  assert.match(code, /useModalA11y\(\{/, 'aria-modal without the shared focus hook');
  assert.match(code, /aria-modal="true"/);
  assert.match(code, /className="sn-side-panel\b/);
});

test('reduced motion: the drift stops and a closing panel does not wait', async () => {
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.sn-canvas-drift::before\s*\{\s*animation:\s*none/);
  const { sidePanelExitMs, SIDE_PANEL_EXIT_MS } = await import('./side-panel');
  assert.equal(sidePanelExitMs(true), 0);
  assert.equal(sidePanelExitMs(false), SIDE_PANEL_EXIT_MS);
  // The constant mirrors the CSS duration the panel transitions with.
  assert.equal(`${SIDE_PANEL_EXIT_MS}ms`, CSS.match(/--sn-dur-elem:\s*(\d+ms)/)?.[1]);
});

test('Section groups by space and type — no box, labelled by its heading', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { Section } = await import('./section');
  const html = renderToStaticMarkup(
    React.createElement(Section as never, { title: 'Budget', info: 'What counts.' }, 'x'),
  );
  assert.match(html, /^<section[^>]*class="sn-section"/);
  // The (i) is a CONTROL and keeps its round hairline by owner ruling; the
  // container around it may carry neither.
  const containers = html.replace(/<button[\s\S]*?<\/button>/g, '');
  assert.doesNotMatch(containers, /\bborder\b|rounded-/, 'a Section drew a box');
  const labelledBy = html.match(/aria-labelledby="([^"]+)"/)?.[1];
  assert.ok(labelledBy && new RegExp(`<h2 id="${labelledBy}"[^>]*>Budget</h2>`).test(html));
});
