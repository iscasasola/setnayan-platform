import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ST-11 · the moment row's × is a finger's width, and the circle did not grow.
 *
 * Measured: `.cx` was 28px, and 36px under `(pointer: coarse)` — under the 44px
 * touch floor on desk AND phone.
 *
 * ⚠ TWO OBVIOUS FIXES ARE RECORDED IN THIS STYLESHEET AS FAILURES, and this
 * guard exists mostly to stop either being reintroduced as a "simplification":
 *   · an invisible halo — `.x`: "spread over a neighbour, it took off the wrong
 *     photo (round 3)";
 *   · the app's global 44px min-height — `.x`: "on this 26px circle that drew a
 *     tall oval that reached over the words and the neighbour".
 *
 * 🔑 The register's own re-measure command for this row — `git grep "moment-row"`
 * — returns NOTHING on main; the class does not exist and has not for some time.
 * A dead command reads as "already fixed", so the anchors below are the class
 * names that actually resolve today, and the last test fails if they stop doing.
 */

const CSS = join(
  process.cwd(),
  'app/dashboard/[eventId]/story/_components/make-it-yours.module.css',
);
const TSX = join(
  process.cwd(),
  'app/dashboard/[eventId]/story/_components/make-it-yours.tsx',
);

/** The declarations of one class rule, by exact selector. */
function rule(css: string, selector: string): string {
  const at = css.indexOf(`\n${selector} {`);
  assert.ok(at > -1, `${selector} no longer exists — this guard must be re-aimed, not deleted`);
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

test('the × TARGET clears the 44px touch floor', () => {
  const css = readFileSync(CSS, 'utf8');
  const cx = rule(css, '.cx');
  assert.match(cx, /width:\s*44px/, `the moment × is under the touch floor: ${cx.trim()}`);
  assert.match(cx, /height:\s*44px/, `the moment × is under the touch floor: ${cx.trim()}`);
});

test('the painted circle did NOT grow with it', () => {
  // Grow the target, not the decoration. A filled 44px disc is the halo this
  // row was told not to bring back.
  const css = readFileSync(CSS, 'utf8');
  const dot = rule(css, '.cxDot');
  assert.match(dot, /width:\s*28px/, `the drawn circle grew: ${dot.trim()}`);
  assert.match(dot, /height:\s*28px/, `the drawn circle grew: ${dot.trim()}`);
});

test('hover paints the dot, never the 44px box', () => {
  const css = readFileSync(CSS, 'utf8');
  assert.match(
    css,
    /\.cx:hover \.cxDot \{/,
    'the hover background moved back onto the button box, which draws a 44px disc',
  );
  assert.doesNotMatch(
    css,
    /\n\.cx:hover \{/,
    'the button box paints on hover again — that is the decoration growing',
  );
});

test('no invisible halo is reintroduced on either ×', () => {
  // The failure this stylesheet records by name: a pseudo-element spread past
  // the control took off the wrong photo.
  const css = readFileSync(CSS, 'utf8');
  for (const sel of ['.cx', '.x']) {
    assert.doesNotMatch(
      css,
      new RegExp(`\\${sel}::(before|after)\\s*\\{[^}]*inset:\\s*-`),
      `${sel} grew an invisible halo again — round 3 removed exactly this`,
    );
  }
});

test('the anchors this row is found by actually resolve', () => {
  /*
    The register pointed at `moment-row`, which does not exist. This test is the
    replacement: if the class names move, THIS fails and names them, instead of
    a future re-measure returning zero and reading as "already fixed".
  */
  const css = readFileSync(CSS, 'utf8');
  const tsx = readFileSync(TSX, 'utf8');
  assert.match(css, /\n\.cx \{/, 'the moment × class was renamed — update this guard and the row');
  assert.match(css, /\n\.cxDot \{/, 'the circle span class was renamed');
  assert.match(tsx, /className=\{s\.cx\}/, 'the moment × no longer uses s.cx');
  assert.match(tsx, /className=\{s\.cxDot\}/, 'the glyph span was unwrapped — the circle will grow with the button');
  assert.doesNotMatch(tsx, /moment-row/, 'the dead anchor came back');
});
