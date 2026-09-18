/**
 * The bot check must be SOLVABLE on a phone.
 *
 * Two defects shipped together and each one hides the other:
 *
 *   1 · The widget's holder was 293px at a 375px viewport, seven pixels under
 *       Cloudflare's 300px minimum for `size:'flexible'`, so the challenge laid
 *       out at ZERO HEIGHT — unsolvable, and no token ever produced.
 *   2 · The submit button was tappable before a token existed, so the common
 *       path produced "the security check did not pass", which blames the
 *       visitor for the form's timing.
 *
 * Both are invisible in ordinary testing, for the same reason:
 * `appearance:'interaction-only'` passes a trusted visitor SILENTLY. Nothing
 * is drawn, nothing needs to fit, and the page works. The floor only matters
 * when Cloudflare demands an interactive solve — which it does when one IP
 * makes many requests quickly. That is a wedding reception: a hundred guests
 * on one venue WiFi, every one of them on a phone.
 *
 * So this file asserts the two DECISIONS, executed — never the CSS text.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decideSubmitGate,
  holderFitsAt,
  holderMeetsWidgetMinimum,
  TURNSTILE_FLEXIBLE_MIN_WIDTH_PX,
  TURNSTILE_HOLDER_MIN_WIDTH_PX,
  TURNSTILE_WIDGET_SIZE,
} from './turnstile-submit-gate';

test('the holder guarantees at least the minimum the chosen widget size needs', () => {
  console.log(
    `  size=${TURNSTILE_WIDGET_SIZE} needs ${TURNSTILE_FLEXIBLE_MIN_WIDTH_PX}px · holder guarantees ${TURNSTILE_HOLDER_MIN_WIDTH_PX}px`,
  );
  assert.ok(
    holderMeetsWidgetMinimum(),
    `the widget is rendered at size '${TURNSTILE_WIDGET_SIZE}' but the holder ` +
      `guarantees only ${TURNSTILE_HOLDER_MIN_WIDTH_PX}px — below the minimum ` +
      `that size needs, the challenge lays out at zero height and cannot be solved`,
  );
});

test('the holder still reaches the minimum in the width a phone actually leaves', () => {
  // 293 is the measured content width inside the claim card at a 375px
  // viewport — the case that shipped broken. 285 covers a 320px phone.
  for (const available of [285, 293, 300, 382]) {
    const fits = holderFitsAt(available);
    console.log(`  available=${available}px -> fits=${fits}`);
    assert.ok(
      fits,
      `with ${available}px of content width the holder cannot reach ` +
        `${TURNSTILE_HOLDER_MIN_WIDTH_PX}px — a phone would be shown a ` +
        `zero-height challenge, exactly the bug this file exists to stop`,
    );
  }
});

test('a tap that arrives before the token is QUEUED, not refused', () => {
  assert.equal(
    decideSubmitGate({ token: '', hasWidget: true, alreadyQueued: false }),
    'queue',
    'an early tap must be held until the token lands, not sent to be refused',
  );
});

test('a tap PROCEEDS whenever waiting could not help', () => {
  // Token in hand — nothing to wait for.
  assert.equal(
    decideSubmitGate({ token: 'tok', hasWidget: true, alreadyQueued: false }),
    'proceed',
  );
  // 🔴 No widget: the script was blocked (ad-blocker, offline, CSP). There is
  // nothing that will ever produce a token, so holding the form shut would turn
  // an honest server refusal into a button that silently does nothing.
  assert.equal(
    decideSubmitGate({ token: '', hasWidget: false, alreadyQueued: false }),
    'proceed',
    'with no widget there is nothing to wait for — never trap the person',
  );
  // Already holding one: re-submitting must not queue again, or it loops.
  assert.equal(
    decideSubmitGate({ token: '', hasWidget: true, alreadyQueued: true }),
    'proceed',
    'a queued re-submit must pass through, or the form never sends',
  );
});
