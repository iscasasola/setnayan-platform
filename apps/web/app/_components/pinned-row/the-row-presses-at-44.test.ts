/**
 * 🛡 THE PINNED ROW'S PRESSES ARE 44 × 44 OR TALLER (walker on live f8f278f at 390 px, 18 Nov 2026: "Events ▾" 72×28,
 * "＋" and "⚙" 40×40; the drawing `user_dashboard_clean_2026-11-17_fable.html` draws `.pm{min-height:44px}` and 44×44
 * round buttons; 44 is the owner's floor). Red on main, where the row's stylesheet sets no size on its controls.
 * SABOTAGE: drop any of the three rules below → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const css = stripComments(readFileSync(join(import.meta.dirname, 'pinned-row.module.css'), 'utf8'));
const rule = (sel: string) => {
  const i = css.indexOf(`${sel} {`);
  assert.ok(i >= 0, `no rule for ${sel}`);
  return css.slice(i, css.indexOf('}', i));
};

test('the picker draws 44 tall', () => {
  assert.match(rule('.pinPick :global([data-pinned-picker])'), /min-height:\s*44px/);
});

test('every button on the row is 44 tall, and an icon button is 44 × 44', () => {
  assert.match(rule('.pin :global(.ab)'), /min-height:\s*44px/);
  const icon = rule('.pin :global(.ab.icon-only)');
  assert.match(icon, /\bwidth:\s*44px/);
  assert.match(icon, /min-width:\s*44px/);
  assert.match(icon, /\bheight:\s*44px/);
});

test('the picker the rule names is the one the row draws', () => {
  const tsx = readFileSync(join(import.meta.dirname, 'pinned-row.tsx'), 'utf8');
  assert.match(tsx, /dataAttr="data-pinned-picker"/);
});
