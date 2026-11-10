/**
 * a-closed-tip-takes-no-room.test.ts — 🔒 a CLOSED InfoTip bubble (`.sn-tip`) is laid out at 0 × 0, so it can
 * never widen a phone page; an OPEN one is slid back inside the screen by `<InfoTip>`.
 *
 * Measured 2026-11-10 (Build 5 Lane R, live site, logged out, 320-px window): `/` was 332 px wide and `/pricing`
 * 338 px wide — the whole page scrolled sideways. The cause on both: closed ⓘ bubbles. A closed tip is
 * `visibility: hidden` (it stays in the DOM so `aria-describedby` resolves), and hidden is still LAID OUT — a
 * 288-px bubble hanging from an ⓘ 44 px in ends at 332. Opened, the same bubble cut its last words off-screen.
 *
 * The properties held here:
 *   1. the base `.sn-tip` rule (the closed state) declares `max-width: 0`, `max-height: 0` and `overflow: hidden`;
 *   2. the open rule gives the size back;
 *   3. the size returns AFTER the fade on close (max-width / max-height ride the `visibility` delay), so closing
 *      still fades the whole bubble instead of collapsing it;
 *   4. the open translate carries `--sn-tip-nudge`, and `<InfoTip>` sets it from a 16-px gutter.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const CSS = stripComments(readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8'));
const TIP = stripComments(readFileSync(join(__dirname, '..', 'app', '_components', 'info-tip.tsx'), 'utf8'));

function block(selector: RegExp): string {
  const m = CSS.match(new RegExp(`(^|\\})\\s*${selector.source}\\s*\\{([^}]*)\\}`, 'm'));
  assert.ok(m, `rule ${selector.source} not found in app/globals.css`);
  return m[2] ?? '';
}
const decl = (b: string, prop: string) => b.match(new RegExp(`(^|;|\\s)${prop}\\s*:\\s*([^;]+);`))?.[2]?.trim();

test('a closed .sn-tip is laid out at 0 × 0 and clips', () => {
  const closed = block(/\.sn-tip/);
  assert.equal(decl(closed, 'max-width'), '0', 'closed .sn-tip must be max-width: 0 — a hidden 288-px bubble widens a 320-px page');
  assert.equal(decl(closed, 'max-height'), '0', 'closed .sn-tip must be max-height: 0');
  assert.equal(decl(closed, 'overflow'), 'hidden', 'closed .sn-tip must clip its own text (overflow: hidden)');
});

test('an open .sn-tip gets its size back', () => {
  const open = block(/\.sn-tip\[data-open='true'\]/);
  const mw = decl(open, 'max-width') ?? '';
  assert.ok(/18rem/.test(mw) && /100vw/.test(mw), `open .sn-tip max-width should be min(18rem, 100vw − gutters), got "${mw}"`);
  assert.ok(decl(open, 'max-height') && decl(open, 'max-height') !== '0', 'open .sn-tip must give max-height back');
  assert.equal(decl(open, 'overflow'), 'visible');
});

test('the size returns only after the close fade', () => {
  const t = (decl(block(/\.sn-tip/), 'transition') ?? '').replace(/\s+/g, ' ');
  for (const p of ['max-width', 'max-height']) {
    assert.ok(new RegExp(`${p} 0s linear var\\(--sn-dur-control\\)`).test(t), `${p} must wait out the fade like visibility does — got "${t}"`);
  }
});

test('the open bubble is nudged inside a 16-px gutter', () => {
  assert.ok(/--sn-tip-nudge/.test(decl(block(/\.sn-tip\[data-open='true'\]/), 'translate') ?? ''), 'open translate must add var(--sn-tip-nudge)');
  assert.ok(/setProperty\('--sn-tip-nudge'/.test(TIP), '<InfoTip> must set --sn-tip-nudge on open');
  assert.ok(/vw - 16/.test(TIP) && /16 - left/.test(TIP), '<InfoTip> must keep both edges 16 px inside the screen');
});

test('the front-door hero ⓘ opens upward, inside the clipped hero', () => {
  // The hero is `overflow: hidden` (its photo) and the Papic line sits on its bottom edge: a bubble hanging below it
  // was cut after one line at every phone width (measured 320 px: bubble bottom 895, hero bottom 798).
  const css = stripComments(readFileSync(join(__dirname, '..', 'app', '_components', 'frontdoor', 'front-door-landing.css'), 'utf8'));
  const m = css.match(/\.fd \.fl-truths-papic \.sn-tip\s*\{([^}]*)\}/);
  assert.ok(m, 'the hero Papic ⓘ has no `.fd .fl-truths-papic .sn-tip` rule — it hangs below and the hero clips it');
  assert.match(m[1] ?? '', /bottom:\s*100%/, 'the hero Papic ⓘ must open upward (bottom: 100%)');
  assert.match(m[1] ?? '', /top:\s*auto/, 'the hero Papic ⓘ must release `top`');
});
