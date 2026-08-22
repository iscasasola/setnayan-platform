/**
 * say-what-happened.test.ts — the guest must be told what happened to them.
 *
 * Two controls looked identical whether they worked or not.
 *
 * 1 · THE REPLY THAT SILENTLY WASN'T SAVED. `submitRsvp` handled a failed write
 *    with a bare `return` under the comment "Best-effort silent failure for
 *    guest-side surface; couple sees the row unchanged. A toast UI lands with
 *    the polish pass." The polish pass never came. The guest tapped Save, the
 *    button stopped spinning, the page came back looking exactly as before, and
 *    nothing was written.
 *
 *    This is the one failure with NO natural discovery path. The guest has no
 *    reason to check again — they replied. The couple cannot tell "never
 *    answered" from "answered and we dropped it". The caterer's headcount is
 *    short and nobody learns why until the day.
 *
 *    Worse than the finding said: the SUCCESS path was silent too. It redirected
 *    with `?saved=1` and nothing anywhere rendered that param, so both outcomes
 *    produced the same page.
 *
 * 2 · THE PADLOCK THAT COULDN'T EXPLAIN ITSELF. `site-menu-bar.tsx` states in
 *    its own comment that "a padlock with its reason says the truth" — and put
 *    the reason in a `title=` attribute, which is a native tooltip requiring a
 *    MOUSE HOVERING. This bar is a fixed bottom bar on a phone. There is no
 *    hover. So every guest saw a faint Camera with a small padlock and had no
 *    way, at all, to find out why. The resolver has always carried
 *    `lockedReason` precisely so it could be said out loud.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIONS = readFileSync(join(HERE, '..', 'actions.ts'), 'utf8');
const BAR = readFileSync(join(HERE, '..', '_components', 'site-menu-bar.tsx'), 'utf8');
const WIDGET = readFileSync(join(HERE, '..', '_components', 'rsvp-widget.tsx'), 'utf8');
const PAGE = readFileSync(join(HERE, '..', 'page.tsx'), 'utf8');

/** Just `submitRsvp`, so an unrelated redirect elsewhere cannot satisfy this. */
function submitRsvpSource(): string {
  const start = ACTIONS.indexOf('export async function submitRsvp(');
  assert.notEqual(start, -1, 'submitRsvp is gone or renamed — update this test.');
  const next = ACTIONS.indexOf('\nexport ', start + 10);
  return ACTIONS.slice(start, next === -1 ? undefined : next);
}

test('a reply that failed to save says so', () => {
  const src = submitRsvpSource();
  const errBranch = src.indexOf('if (error) {');
  assert.notEqual(errBranch, -1, 'the write error is no longer handled at all');
  const branch = src.slice(errBranch, errBranch + 1400);

  assert.ok(
    /redirect\(/.test(branch),
    'The failed-write branch does not redirect, so the guest gets the same page ' +
      'back and believes they replied. A fault log is for us; the guest needs ' +
      'to be told.',
  );
  assert.match(
    branch,
    /rsvp=error/,
    'The failure must be signalled to the page — this is the param it renders.',
  );
  assert.ok(
    !/^\s*return;\s*$/m.test(branch.slice(0, branch.indexOf('redirect('))),
    'A bare `return` before the redirect puts the silent failure back.',
  );
});

test('a reply that DID save says so too', () => {
  // The old success path redirected with `?saved=1` and NOTHING rendered it, so
  // success and failure produced identical pages. Fixing only the error half
  // would have left "no message" still meaning two different things.
  //
  // ⚠ 2026-08-20: the success signal became one of THREE outcomes, so the old
  // literal `rsvp=ok` match stopped holding. This test caught that change —
  // correctly — and is widened rather than loosened: the property it defends is
  // "every outcome the action can produce has words on the page", which is now
  // asserted for all three, not just one.
  const src = submitRsvpSource();
  assert.match(
    src,
    /rsvp=\$\{outcome\}|rsvp=ok/,
    'the success signal is gone',
  );

  // Every literal the outcome can take must have a renderer. A new outcome
  // added here without a branch on the page is a guest told nothing.
  const OUTCOMES = ['ok', 'error', 'details', 'refused'];
  for (const o of OUTCOMES) {
    assert.ok(
      src.includes(`'${o}'`) || src.includes(`rsvp=${o}`),
      `submitRsvp can no longer produce the "${o}" outcome — if it was retired, drop it here too`,
    );
    assert.match(
      PAGE,
      new RegExp(`search\\.rsvp === '${o}'`),
      `nothing on the page turns the "${o}" outcome into words`,
    );
  }
});

test('the message reaches the form, at the top of it', () => {
  assert.match(WIDGET, /flash\?: \{ tone: 'ok' \| 'error'; text: string \} \| null;/, 'the widget stopped accepting it');
  const formStart = WIDGET.indexOf('<form action={action}');
  const flashAt = WIDGET.indexOf('{flash ? (');
  assert.ok(flashAt !== -1, 'the widget renders no message');
  assert.ok(
    flashAt > formStart && flashAt - formStart < 400,
    'The message must sit at the TOP of the form. At the bottom it is below the ' +
      'fold on a phone, and the entire point is that the guest must not walk ' +
      'away thinking they replied.',
  );
  assert.match(WIDGET, /role=\{flash\.tone === 'error' \? 'alert' : 'status'\}/, 'a failure must be announced, not just coloured');
});

test('a locked tab can explain itself without a mouse', () => {
  assert.ok(
    !/title=\{slot\.lockedReason\}/.test(BAR),
    'The reason is back in a `title=`, which is a hover tooltip. This bar lives ' +
      'at the bottom of a phone screen — there is no hover, so the reason is ' +
      'unreachable for the entire audience.',
  );
  assert.match(
    BAR,
    /onClick=\{\(\) => setOpenReason\(slot\.lockedReason \?\? null\)\}/,
    'Tapping a locked tab must reveal its reason.',
  );
  assert.match(
    BAR,
    /aria-label=\{`\$\{slot\.label\} — \$\{slot\.lockedReason \?\? 'not available yet'\}`\}/,
    'A screen reader must get the reason without having to tap first.',
  );
  // EVERY locked renderer — the ordinary slot, the camera (which has its own
  // chrome and is a separate copy of the same span), and since 2026-08-17 the
  // DESKTOP RAIL, which is a third copy for screens ≥1280 where the pinned bar
  // is not drawn at all.
  //
  // ⚠ THIS COUNT WENT 2 → 3 BECAUSE A THIRD RENDERER GENUINELY EXISTS, not to
  // make a red build green. The rail was added without it and CI caught the
  // omission — which is the count doing its job. A fourth renderer must raise
  // it again, deliberately: a locked tab that cannot say WHY is the exact
  // defect this file was written for, and on the rail it would be worse than
  // on the bar, because a desktop visitor has no tap-to-reveal habit to fall
  // back on.
  const taps = BAR.match(/setOpenReason\(slot\.lockedReason/g) ?? [];
  assert.equal(
    taps.length,
    3,
    'Every locked renderer must reveal the reason — the ordinary slot, the ' +
      'camera (the slot most often locked), and the desktop rail.',
  );
});
