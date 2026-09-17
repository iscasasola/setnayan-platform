import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { turnstileVerdict, type TurnstileOutcome } from './turnstile-verdict';

/**
 * The property: once the owner sets a secret, ONLY an explicit success gets
 * through. Everything else — no token, a rejection, an HTTP error, Cloudflare
 * unreachable — is a refusal.
 *
 * 🔑 WHY THIS FILE EXISTS. `/forgot-password` used to hand its Turnstile token
 * to GoTrue, which verified it. Moving the flow off GoTrue (the emailed link
 * was PKCE and only worked in the browser that asked) took that verification
 * with it, silently: the widget still rendered, the hidden field still arrived,
 * and nobody read it. **An unwired control is not a missing control, it is a
 * false one** — it spends a reviewer's attention proving the opposite of the
 * truth. Three sabotages of this PR went red; a fourth, flipping the verifier
 * to fail OPEN, went green against every test that existed. This is that gap.
 */

/* ── THE DECISION, EXECUTED ──────────────────────────────────────────────── */

test('with a secret set, only an explicit success passes', () => {
  const refusals: TurnstileOutcome[] = [
    { kind: 'no_token' },
    { kind: 'http_error', status: 500 },
    { kind: 'http_error', status: 403 },
    { kind: 'network_error' },
    { kind: 'answered', success: false },
  ];
  for (const o of refusals) {
    const v = turnstileVerdict(o);
    assert.equal(v.ok, false, `${o.kind} was let through`);
    assert.equal(v.configured, true, `${o.kind} reported the check as switched off`);
  }
  assert.deepEqual(turnstileVerdict({ kind: 'answered', success: true }), {
    configured: true,
    ok: true,
  });
});

test('a verifier we could not reach REFUSES — it does not shrug', () => {
  // The single most tempting wrong answer: "Cloudflare is down, let them in."
  // That sentence and "we have no bot check" are the same sentence.
  for (const o of [{ kind: 'network_error' } as const, { kind: 'http_error', status: 502 } as const]) {
    assert.equal(turnstileVerdict(o).ok, false, 'an unreachable verifier waved the request through');
  }
});

test('with NO secret the check is OFF, not PASSED — and the page still works', () => {
  const v = turnstileVerdict({ kind: 'no_secret' });
  assert.equal(v.ok, true, 'an unconfigured check took a working page down');
  assert.equal(
    v.configured,
    false,
    'reporting configured:true with no secret would let a caller believe a ' +
      'verification happened when nothing was verified',
  );
});

test('configured:false is reachable ONLY from no_secret', () => {
  // The floor. If any other outcome ever reports configured:false, a refusal
  // starts reading as "the check is off" and callers that branch on it stop
  // refusing.
  const all: TurnstileOutcome[] = [
    { kind: 'no_secret' },
    { kind: 'no_token' },
    { kind: 'http_error', status: 500 },
    { kind: 'network_error' },
    { kind: 'answered', success: true },
    { kind: 'answered', success: false },
  ];
  const unconfigured = all.filter((o) => !turnstileVerdict(o).configured);
  assert.deepEqual(unconfigured.map((o) => o.kind), ['no_secret']);
});

/* ── THE WIRING ──────────────────────────────────────────────────────────── */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const code = (rel: string) =>
  readFileSync(join(WEB, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n');

test('the server verifier decides nothing itself — it delegates', () => {
  const src = code('lib/turnstile-verify.ts');
  const inlined = src.match(/return\s*\{\s*configured:/g) ?? [];
  assert.deepEqual(
    inlined,
    [],
    'lib/turnstile-verify.ts is spelling verdicts inline again. It is server-only, ' +
      'so a test can never execute them — that is exactly how a fail-OPEN flip ' +
      'ships green. Every outcome must go through turnstileVerdict().',
  );
  assert.ok((src.match(/turnstileVerdict\(/g) ?? []).length >= 5,
    'not every outcome delegates — one branch decides for itself');
});
