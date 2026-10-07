import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

/**
 * 🪤 A FINISHED ANIMATION CAN STILL MOVE A `position: fixed` BAR (Fix E,
 * 2026-09-30). The roster sits inside `.gl-settle-delayed sn-lens-swap`, whose
 * entry motion animates `transform` to `none`. Filled forwards (`both`), the
 * end state is translateY(0) — an identity matrix, measured in a real render
 * as `matrix(1, 0, 0, 1, 0, 0)` — and ANY transform makes the element the
 * containing block for fixed descendants. The bulk bar ("N selected · Invite
 * selected · Set group ▾ …", `fixed bottom-[…+5rem]`) then pinned itself to the
 * bottom of the whole LIST: on a phone, a long press selected a guest and the
 * bar was a screen or more below, out of sight.
 *
 * No test renders CSS, so this pins the cause: every animation on a wrapper the
 * roster lives in fills `backwards` only.
 */
const CSS = stripComments(readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8'));

function ruleOf(selector: string): string {
  const at = CSS.indexOf(`${selector} {`);
  assert.notEqual(at, -1, `${selector} is gone from globals.css — this guard is blind`);
  return CSS.slice(at, CSS.indexOf('}', at));
}

test('the roster wrappers never keep their entry transform', () => {
  for (const sel of ['.gl-settle', '.gl-settle-delayed', '.sn-lens-swap']) {
    const rule = ruleOf(sel);
    assert.match(rule, /animation:[^;]*\bbackwards\b/, `${sel} must fill backwards: ${rule}`);
    assert.doesNotMatch(rule, /animation:[^;]*\b(both|forwards)\b/, `${sel} keeps a transform after it finishes — the bulk bar leaves the screen: ${rule}`);
  }
});

test('the thumb row (and Select mode’s bulk row) is fixed on the measured dock, and no ancestor transforms it (Maker PR 4f)', () => {
  const css = stripComments(
    readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components', 'guests-screen.module.css'), 'utf8'),
  );
  const lower = css.slice(css.indexOf('.lower {'), css.indexOf('}', css.indexOf('.lower {')));
  assert.match(lower, /position: fixed;/, 'the thumb row is no longer fixed to the screen');
  // In the iOS app the bottom chrome is the measured dock (`--sn-bottomdock-h`).
  assert.match(lower, /bottom: calc\(var\(--sn-bottomdock-h, calc\(env\(safe-area-inset-bottom\) \+ 64px\)\)\);/, 'the thumb row no longer stands on the measured dock');
  // The row's own ancestors in the screen never animate a transform (a
  // transformed ancestor makes `fixed` relative to it — the bar leaves the screen).
  const screen = stripComments(
    readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components', 'guests-screen.tsx'), 'utf8'),
  );
  const root = screen.slice(screen.indexOf('<div ref={rootRef}'), screen.indexOf('>', screen.indexOf('<div ref={rootRef}')));
  assert.doesNotMatch(root, /styles\.rise/, 'the screen root animates — the fixed thumb row would ride with it');
  const page = stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', 'page.tsx'), 'utf8'));
  assert.doesNotMatch(page, /gl-settle[^"]*"[^>]*>\s*\{guestsScreen\}/, 'the screen sits inside an entry-transform wrapper again');
});
