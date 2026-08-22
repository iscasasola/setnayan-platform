import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  humanAuthError,
  isHumanReadable,
  GENERIC_SIGN_IN_ERROR,
} from './human-auth-error';

/* ── THE OWNER'S OWN SCREENSHOT ─────────────────────────────────────────── */
test('the reported bug: a stringified error never reaches a person', () => {
  assert.equal(humanAuthError('{}'), GENERIC_SIGN_IN_ERROR);
  // The whole family, not just the one value that was reported — a deny-list
  // of known-bad strings is a bill you keep paying, and the next machine
  // string will not be `{}`.
  for (const junk of ['{}', '[]', '{"code":401}', '<html></html>', '   {}  ']) {
    assert.equal(humanAuthError(junk), GENERIC_SIGN_IN_ERROR, `leaked: ${junk}`);
  }
});

test('a bare machine token is not a sentence', () => {
  for (const token of ['validation_failed', 'server-error', 'auth.failed']) {
    const out = humanAuthError(token);
    assert.notEqual(out, token, `"${token}" was shown to a person verbatim`);
    assert.ok(out && out.length > 10);
  }
});

test('a real sentence from the provider is passed through unchanged', () => {
  const real = 'Password should be at least 6 characters.';
  assert.equal(humanAuthError(real), real);
});

/* ── THE ONE THAT BIT US ────────────────────────────────────────────────── */
test('"provider is not enabled" becomes a door that works', () => {
  const out = humanAuthError('provider is not enabled');
  assert.ok(out);
  assert.doesNotMatch(
    out,
    /provider|enabled|supabase|oauth/i,
    'The person is being told about our configuration. They cannot fix it — ' +
      'point them at the sign-in that does work.',
  );
  assert.match(out, /email and password/i);
});

/* ── null IN, null OUT — a formatter, not a detector ─────────────────────── */
test('no error stays no error — never paint a banner over a clean form', () => {
  assert.equal(humanAuthError(null), null);
  assert.equal(humanAuthError(undefined), null);
  assert.equal(humanAuthError(''), null);
  assert.equal(humanAuthError('   '), null);
});

test('it never returns an empty string — silence is worse than a generic line', () => {
  for (const raw of ['{}', 'x', '???', 'validation_failed', 'Invalid login credentials']) {
    const out = humanAuthError(raw);
    assert.ok(out && out.trim().length > 0, `"${raw}" produced nothing to read`);
  }
});

test('isHumanReadable judges shape, not a list of known values', () => {
  assert.equal(isHumanReadable('That email and password do not match.'), true);
  assert.equal(isHumanReadable('{}'), false);
  assert.equal(isHumanReadable('123456'), false);
  assert.equal(isHumanReadable('a'), false);
});

/* ── WIRING — a pure helper nobody calls is decoration ───────────────────── */
const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const code = (rel: string) =>
  readFileSync(join(WEB, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n');

test('the banner renders through the gate, not the raw value', () => {
  const card = code('app/login/_components/sign-in-card.tsx');
  assert.match(
    card,
    /const shownError = humanAuthError\(/,
    'The sign-in card stopped routing its message through humanAuthError — ' +
      'every source can print junk again, which is the reported bug.',
  );
});

test('the OAuth callback forwards the refusal instead of swallowing it', () => {
  const cb = code('app/auth/callback/route.ts');
  assert.match(
    cb,
    /searchParams\.get\('error_description'\)/,
    'The callback ignores error_description. A provider refusal then bounces ' +
      'the person back signed-out with nothing said — measured live as a ' +
      'silent 307 to "/".',
  );
  assert.match(
    cb,
    /searchParams\.set\('error',/,
    'The callback reads the refusal but never passes it on.',
  );
});
