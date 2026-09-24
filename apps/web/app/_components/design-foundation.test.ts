/**
 * design-foundation.test.ts — the shared pieces keep the owner's 2026-09-24
 * rulings, and the tokens they are built on resolve.
 *
 * Covers what the piece-specific suites (`info-tip.test.ts`,
 * `lib/no-card-guard.test.ts`) do not:
 *   1. every token the Tailwind theme EXPOSES is defined in globals.css — an
 *      undefined `var()` compiles fine and silently resolves to nothing;
 *   2. the new layers carry no border (owner: "glass layers drop their hairline");
 *   3. the canvas drift never HOLDS a transform and stops under reduced motion.
 *
 * Readout / Section / SidePanel land with their first adopter (branch
 * `rd/design-foundation-parts`), and bring their own tests with them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

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
  // The scrim/panel layers are where the guest card's sheet already sits.
  assert.equal(z('scrim'), Number(rule('.sn-inspector-peek').match(/z-index:\s*(\d+)/)?.[1]));
  assert.equal(z('panel'), Number(rule('.sn-inspector-sheet').match(/z-index:\s*(\d+)/)?.[1]));
});

test('the new layers are borderless — seated by shadow, not a hairline', () => {
  for (const sel of ['.sn-glass-bare', '.sn-tip-body']) {
    assert.doesNotMatch(rule(sel), /(^|[\s;])border(-left|-right|-top|-bottom)?\s*:/, `${sel} carries a border`);
  }
  assert.match(rule('.sn-glass-bare'), /box-shadow:/);
  // `.sn-glass` keeps its border ON PURPOSE (it bounds nine existing panels).
  assert.match(rule('.sn-glass'), /border:/);
});

test('the canvas drift never holds a transform, and stops under reduced motion', () => {
  assert.doesNotMatch(rule('.sn-canvas-drift::before'), /animation:[^;]*\b(both|forwards)\b/);
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.sn-canvas-drift::before\s*\{\s*animation:\s*none/);
});
