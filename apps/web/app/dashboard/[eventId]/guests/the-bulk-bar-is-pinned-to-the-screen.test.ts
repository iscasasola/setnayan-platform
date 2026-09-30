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

test('the roster still renders inside those wrappers, and the bulk bar is still fixed', () => {
  const page = stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', 'page.tsx'), 'utf8'));
  assert.match(page, /className="gl-settle-delayed sn-lens-swap min-w-0 space-y-4"/);
  const rows = stripComments(
    readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components', 'guest-list-multiselect.tsx'), 'utf8'),
  );
  assert.match(rows, /className="fixed inset-x-3 bottom-\[calc\(env\(safe-area-inset-bottom\)\+5rem\)\]/);
});
