/**
 * A control that freezes something must have a control that unfreezes it —
 * and BOTH must be reachable from a screen.
 *
 * 🚨 THE DEFECT THIS CLOSES. An admin could put a vendor payout on hold: the
 * button was wired, the "On hold" filter listed the result, and the confirmation
 * promised in so many words that *"it stays held until you lift it manually."*
 * **Nothing could lift it.** `releasePayoutHoldAction` existed, was audit-logged,
 * and no page imported it — the held branch of the row rendered `null`.
 *
 * 🔑 THE PROMISE IS WHAT MADE IT INVISIBLE. The screen said the lever existed, so
 * nobody went looking for it. A forward primitive with no inverse, wearing the
 * "gate with no handle" costume: the mechanism is written, granted and correct,
 * and no human can reach it.
 *
 * ⚖ THIS GUARD IS DELIBERATELY NARROW. It pins the pairs that exist today rather
 * than trying to infer every forward/inverse relationship in the codebase — a
 * rule that guessed would cry wolf, and a guard that cries wolf teaches you to
 * skim past the one time it is right.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WEB = process.cwd();

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Screens only — a generated inventory listing every action by name makes
 *  every action look wired, which is exactly how this one hid. */
const SCREENS = walk(join(WEB, 'app/admin')).filter(
  (f) => !f.endsWith('.test.tsx') && !f.includes('.generated.'),
);
const screenSrc = SCREENS.map((f) => readFileSync(f, 'utf8')).join('\n');

/** forward control → the inverse that must be reachable from the same tree. */
const PAIRS: Array<{ forward: string; inverse: string; why: string }> = [
  {
    forward: 'holdPayoutAction',
    inverse: 'releasePayoutHoldAction',
    why: 'a frozen payout that cannot be unfrozen strands a supplier’s money',
  },
];

test('the guard can actually fire — it reads real screens', () => {
  assert.ok(SCREENS.length > 50, `walked only ${SCREENS.length} admin screens`);
  assert.ok(screenSrc.includes('holdPayoutAction'), 'the forward control is gone from every screen');
});

for (const { forward, inverse, why } of PAIRS) {
  test(`${forward} has a reachable inverse — ${inverse}`, () => {
    // Both must be MOUNTED on a screen, not merely exported somewhere.
    assert.ok(
      new RegExp(`action=\\{${forward}\\}`).test(screenSrc),
      `${forward} is no longer bound to a form — if it was removed, remove this pair too`,
    );
    assert.ok(
      new RegExp(`action=\\{${inverse}\\}`).test(screenSrc),
      `${inverse} is not bound to any admin form, so ${why}. ` +
        'An exported action nothing renders is a gate with no handle.',
    );
  });
}
