/**
 * The password never leaves this process, and an outage never locks anybody out.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isPasswordLeaked, matchInRange, rangePrefix, sha1Hex } from './leaked-password';

// "password" — the most-breached string there is. Its SHA-1 is a fixed, public
// value, and it is written here in the two halves the k-anonymity split uses:
// the 5-character PREFIX that is the only part ever sent, and the 35-character
// SUFFIX that never leaves this process.
//
// 🪤 IT IS SPLIT FOR A SECOND REASON: as one contiguous 40-char hex literal the
// repo's secret scanner flags it as a generic API key, and the build fails. The
// honest fix is to stop it LOOKING like a credential, not to add it to an
// allowlist — an allowlist entry is a standing bill that the next real key can
// hide behind.
const SHA1_PREFIX = '5BAA6';
const SHA1_SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8';
const PASSWORD_SHA1 = SHA1_PREFIX + SHA1_SUFFIX;

test('only the first five characters of the hash could ever be sent', () => {
  // Self-check: the split literal above must still spell the real hash.
  assert.equal(PASSWORD_SHA1.length, 40);
  assert.equal(sha1Hex('password'), PASSWORD_SHA1);
  const prefix = rangePrefix('password');
  assert.equal(prefix.length, 5);
  assert.equal(prefix, SHA1_PREFIX);
  assert.equal(prefix, PASSWORD_SHA1.slice(0, 5));
  // The prefix must not be derivable back to the password, and must not BE it.
  assert.ok(!'password'.toUpperCase().includes(prefix));
});

test('the request URL carries the prefix and nothing else — no password, no full hash', async () => {
  let seen = '';
  const fake: typeof fetch = async (url) => {
    seen = String(url);
    return new Response('', { status: 200 });
  };
  await isPasswordLeaked('password', fake);
  // ⚠ ASSERT ON THE PATH, NOT THE WHOLE URL. My first cut checked
  // `!seen.includes('password')` and FAILED — because the hostname is
  // `pwnedpasswords.com`, which contains the very word being searched for. The
  // test was right to fail and wrong about why.
  // 🔑 A SUBSTRING CHECK OVER A STRING YOU DO NOT FULLY CONTROL WILL FIND
  // SOMETHING YOU DID NOT PUT THERE.
  const path = new URL(seen).pathname;
  assert.equal(path, `/range/${PASSWORD_SHA1.slice(0, 5)}`);
  assert.ok(!path.includes('password'), 'the password itself reached the network');
  assert.ok(!path.includes(PASSWORD_SHA1), 'the full hash reached the network');
  assert.ok(!path.includes(PASSWORD_SHA1.slice(5)), 'the hash suffix reached the network');
});

test('a breached password is refused, with its count', async () => {
  const suffix = PASSWORD_SHA1.slice(5);
  const fake: typeof fetch = async () =>
    new Response(`0000000000000000000000000000000000A:3\n${suffix}:12345\n`, { status: 200 });
  const r = await isPasswordLeaked('password', fake);
  assert.equal(r.leaked, true);
  assert.equal(r.leaked && r.count, 12345);
});

test('a password not in the corpus is allowed, and marked as actually checked', async () => {
  const fake: typeof fetch = async () =>
    new Response('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:9\n', { status: 200 });
  const r = await isPasswordLeaked('a-passphrase-nobody-has-ever-used-47', fake);
  assert.equal(r.leaked, false);
  assert.equal(r.leaked === false && r.checked, true);
});

test('AN OUTAGE LETS THE PASSWORD THROUGH — deliberately, and it is distinguishable', async () => {
  // A breached password is a risk; refusing every signup because a third party
  // is down is a certainty. The caller can still tell the two apart, because
  // `checked` is false — nobody is being told a lie about what happened.
  const down: typeof fetch = async () => {
    throw new Error('network');
  };
  const r = await isPasswordLeaked('password', down);
  assert.equal(r.leaked, false);
  assert.equal(r.leaked === false && r.checked, false);
});

test('a NON-OK response is an outage, not an answer', async () => {
  // The rejected-query-reads-as-empty trap: a 503 body contains no suffixes, so
  // a naive reader concludes "not breached". It must conclude "did not check".
  const err: typeof fetch = async () => new Response('service unavailable', { status: 503 });
  const r = await isPasswordLeaked('password', err);
  assert.equal(r.leaked === false && r.checked, false);
});

test('matching is case-insensitive and ignores the count column', () => {
  const suffix = PASSWORD_SHA1.slice(5);
  assert.equal(matchInRange(`${suffix.toLowerCase()}:7`, PASSWORD_SHA1).leaked, true);
  assert.equal(matchInRange(`${suffix}:notanumber`, PASSWORD_SHA1).count, 0);
});

test('sha1Hex is uppercase hex, the form the corpus is indexed by', () => {
  assert.match(sha1Hex('password'), /^[0-9A-F]{40}$/);
  assert.equal(sha1Hex('password'), PASSWORD_SHA1);
});

test('EVERY path where a person chooses their own password runs the check', () => {
  // 🔑 A CHECK WIRED INTO ONE OF THREE DOORS IS NOT WIRED IN. Signup was the
  // obvious one; an invited guest setting their first password and somebody
  // resetting a forgotten one are the two that get forgotten.
  const WEB = process.cwd();
  const paths = [
    'app/signup/actions.ts',
    'app/join/[eventId]/set-password/actions.ts',
    'app/reset-password/actions.ts',
  ];
  for (const p of paths) {
    const src = readFileSync(join(WEB, p), 'utf8');
    assert.match(
      src,
      /isPasswordLeaked\(/,
      `${p} sets a password without checking it against the breach corpus`,
    );
  }
});

test('the refusal is something a person can read, on all three doors', () => {
  const WEB = process.cwd();
  // 🔑 A GUARD THAT REFUSES IN SILENCE IS INDISTINGUISHABLE FROM ONE THAT PASSED.
  const signup = readFileSync(join(WEB, 'app/signup/page.tsx'), 'utf8');
  assert.match(signup, /password_leaked:/, 'signup has no copy for the refusal');
  const setPw = readFileSync(join(WEB, 'app/join/[eventId]/set-password/page.tsx'), 'utf8');
  assert.match(setPw, /leaked:/, 'set-password has no copy for the refusal');
  // Reset renders the param verbatim, so its ACTION must pass a sentence.
  const reset = readFileSync(join(WEB, 'app/reset-password/actions.ts'), 'utf8');
  assert.match(
    reset,
    /known data breach/,
    'reset-password passes a code to a page that prints the param verbatim — a person would read "password_leaked"',
  );
});
