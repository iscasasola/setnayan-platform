import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { turnstileErrorGuidance, turnstileErrorLogLine } from './turnstile-error-guidance';

/**
 * The property: when the bot check fails, BOTH the person and the owner are
 * told something they can act on.
 *
 * 2026-09-18 — captcha was switched on, the widget rendered "Verification
 * failed", and nobody could sign in with email and password. Cloudflare passes
 * the error code to `error-callback`. The handler was `() => {}`: no
 * parameter, no console, no message. The one fact that explained an outage was
 * discarded at the instant it arrived, and an hour went into guessing.
 */

/* ── THE DECISION, EXECUTED ──────────────────────────────────────────────── */

test('EVERY code produces an actionable message — especially an unknown one', () => {
  const codes = [
    '110200', '110100', '110110', '110500', '110600',
    '300010', '600001', '102002',
    'totally-new-code', '', null, undefined, 42,
  ];
  for (const c of codes) {
    const g = turnstileErrorGuidance(c);
    assert.ok(g.message.length > 20, `too terse for ${String(c)}`);
    // The failure this replaces said nothing a person could do. Every message
    // must name a next step.
    assert.match(
      g.message,
      /Google|Apple|Reload|different browser|different network/i,
      `no way forward offered for ${String(c)}: "${g.message}"`,
    );
    assert.doesNotMatch(g.message, /^Verification failed\.?$/i);
  }
});

test('a misconfiguration is named as OURS, not the visitor\'s fault', () => {
  // 110200 = the domain is not on the widget's hostname list. 1101xx = a bad
  // or deleted site key. Both are the owner's to fix, and the person should
  // not be told to try again — it will fail identically forever.
  for (const c of ['110200', '110100']) {
    const g = turnstileErrorGuidance(c);
    assert.equal(g.ownerMustFix, true, c);
    assert.equal(g.retryable, false, `${c} told the person to retry a permanent failure`);
  }
  // A timeout or a transient execution error IS worth retrying.
  for (const c of ['110600', '300010', '600001']) {
    assert.equal(turnstileErrorGuidance(c).retryable, true, c);
    assert.equal(turnstileErrorGuidance(c).ownerMustFix, false, c);
  }
});

test('the log line always carries the code and the troubleshooting URL', () => {
  // This is the line that turns an hour into ten seconds.
  for (const c of ['110200', 'weird', '', null]) {
    const line = turnstileErrorLogLine(c);
    assert.match(line, /\[turnstile\]/);
    assert.match(line, /code /);
    assert.match(line, /developers\.cloudflare\.com\/turnstile/);
  }
  assert.match(turnstileErrorLogLine('110200'), /OWNER ACTION/);
  assert.match(turnstileErrorLogLine(''), /code unknown/);
  // A transient code must NOT shout owner action — crying wolf is how a real
  // one gets ignored.
  assert.doesNotMatch(turnstileErrorLogLine('600001'), /OWNER ACTION/);
});

/* ── THE WIRING — the bug was that the code never left the callback ──────── */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const field = () =>
  stripComments(
    readFileSync(join(WEB, 'app/_components/auth/turnstile-field.tsx'), 'utf8'),
  );

test('the error callback TAKES the code — this is the regression', () => {
  const s = field();
  assert.doesNotMatch(
    s,
    /'error-callback':\s*\(\s*\)\s*=>/,
    "error-callback takes no parameter again. Cloudflare passes the error code " +
      'there; dropping it is what made an outage undiagnosable for an hour.',
  );
  assert.match(s, /'error-callback':\s*\(\s*code/, 'the code is not captured');
});

test('the code reaches the console AND the screen', () => {
  const s = field();
  assert.match(s, /turnstileErrorLogLine\(code\)/, 'nothing is logged — F12 shows nothing');
  assert.match(s, /turnstileErrorGuidance\(code\)/, 'the person is shown nothing');
  assert.match(s, /data-turnstile-error=/, 'no rendered notice: a log line never changed a pixel');
  // And a successful retry must clear it, or the page keeps accusing itself.
  assert.match(s, /setFailure\(null\)/, 'a recovered challenge leaves the warning on screen');
});
