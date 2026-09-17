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

/* ── THE PARAGRAPH THAT REACHED A CUSTOMER (2026-09-18) ──────────────────── */
// Verbatim from production:
//   curl -sD - "https://www.setnayan.com/auth/callback?code=probe&next=%2Freset-password"
const SDK_PARAGRAPH =
  'PKCE code verifier not found in storage. This can happen if the auth flow ' +
  'was initiated in a different browser or device, or if the storage was ' +
  'cleared. For SSR frameworks (Next.js, SvelteKit, etc.), use @supabase/ssr ' +
  'on both the server and client to store the code verifier in cookies.';

test('the SDK paragraph never reaches the sign-in card', () => {
  const out = humanAuthError(SDK_PARAGRAPH);
  assert.ok(out, 'silence is worse than a generic line');
  assert.doesNotMatch(out, /@supabase|SvelteKit|code verifier|SSR/i,
    'the raw SDK prose was shown to a person — this is the reported bug');
  // And it says the ACTIONABLE thing, not just the generic fallback: an
  // expired link has one fix and the sentence should name it.
  assert.match(out, /new one/i);
});

test('developer prose is refused by SHAPE, not by its wording', () => {
  // Each of these is grammatical English — the old gate passed all of them —
  // and each is addressed to whoever can edit the code, not to the customer.
  const reworded = [
    'Install @supabase/ssr and try again.',
    'The call to exchangeCodeForSession did not return a session.',
    'Check that getUser() is awaited before the redirect.',
  ];
  for (const s of reworded) {
    assert.equal(isHumanReadable(s), false, `leaked developer prose: ${s}`);
  }
  // A long paragraph is documentation, whatever it says.
  assert.equal(isHumanReadable('We could not sign you in. '.repeat(12)), false);
});

test('the new shape tests do not convict an ordinary refusal', () => {
  // The floor that fails the mistake this rule could itself make. Every
  // sentence the module already promises to pass must still pass.
  const innocent = [
    'That email and password do not match. Check both and try again.',
    'Password should be at least 6 characters.',
    'Your account is locked. Contact support.',
    GENERIC_SIGN_IN_ERROR,
  ];
  for (const s of innocent) {
    assert.equal(isHumanReadable(s), true, `convicted an innocent message: ${s}`);
  }
});
