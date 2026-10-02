/**
 * EXECUTES lib/sign-in-door.ts, and READS app/login/actions.ts for the one thing
 * a pure test cannot execute: that the lookup happens only AFTER the password
 * refusal, on both entry points, and never from a client.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  explainFailedSignIn,
  parseProviderParam,
  providerNextStep,
  SIGN_IN_DOOR_MESSAGES,
} from './sign-in-door';
import { humanAuthError } from './human-auth-error';
import { stripComments } from './strip-comments';

const REFUSAL = 'Invalid login credentials';

test('a Google-only account is told its door — not "wrong password"', () => {
  const r = explainFailedSignIn({ authMessage: REFUSAL, door: { kind: 'account', hasPassword: false, providers: ['google'] } });
  assert.deepEqual(r, { message: SIGN_IN_DOOR_MESSAGES.google, provider: 'google' });
  assert.equal(humanAuthError(r.message), r.message, 'the sentence must pass the banner gate unchanged');
});

test('Apple too; and an account with BOTH a password and Google gets the ordinary sentence', () => {
  assert.equal(
    explainFailedSignIn({ authMessage: REFUSAL, door: { kind: 'account', hasPassword: false, providers: ['apple'] } }).provider,
    'apple',
  );
  const both = explainFailedSignIn({ authMessage: REFUSAL, door: { kind: 'account', hasPassword: true, providers: ['email', 'google'] } });
  assert.deepEqual(both, { message: REFUSAL, provider: null }, 'a password exists, so the mismatch is real');
});

test('no password and no known provider → "no password yet", pointed at the reset', () => {
  const r = explainFailedSignIn({ authMessage: REFUSAL, door: { kind: 'account', hasPassword: false, providers: [] } });
  assert.deepEqual(r, { message: SIGN_IN_DOOR_MESSAGES.noPasswordYet, provider: null });
});

test('🔴 a lookup that could not run is NOT "wrong password" — it says it could not tell', () => {
  const r = explainFailedSignIn({ authMessage: REFUSAL, door: { kind: 'unknown' } });
  assert.deepEqual(r, { message: SIGN_IN_DOOR_MESSAGES.couldNotTell, provider: null });
  assert.notEqual(r.message, SIGN_IN_DOOR_MESSAGES.mismatch);
});

test('an email with NO account gets the ordinary sentence — the door never confirms an absence', () => {
  const r = explainFailedSignIn({ authMessage: REFUSAL, door: { kind: 'none' } });
  assert.deepEqual(r, { message: REFUSAL, provider: null });
});

test('every OTHER refusal passes through untouched, whatever the door says', () => {
  for (const msg of ['Email not confirmed', 'Too many requests', 'captcha verification failed']) {
    const r = explainFailedSignIn({ authMessage: msg, door: { kind: 'account', hasPassword: false, providers: ['google'] } });
    assert.deepEqual(r, { message: msg, provider: null }, msg);
  }
});

test('the next step names a button the person can actually see', () => {
  assert.equal(providerNextStep('google', true), 'Use the Google button above.');
  assert.equal(providerNextStep('apple', true), 'Use the Apple button above.');
  // Where no button is visible (the phone app) there is NOTHING to point at — the card
  // offers the set-password button instead of the old "Open setnayan.com in Safari" dead end.
  assert.equal(providerNextStep('google', false), null);
  assert.equal(providerNextStep('apple', false), null);
});

test('the ?provider= param honours only the two doors the card has', () => {
  assert.equal(parseProviderParam('google'), 'google');
  assert.equal(parseProviderParam('apple'), 'apple');
  assert.equal(parseProviderParam('facebook'), null);
  assert.equal(parseProviderParam(['google']), null);
  assert.equal(parseProviderParam(undefined), null);
});

// ── the ordering is a source fact, so it is read ────────────────────────────
const ACTIONS = stripComments(readFileSync('app/login/actions.ts', 'utf8'));

test('🔴 the lookup runs only AFTER signInWithPassword refused, and only for the credentials refusal', () => {
  const call = ACTIONS.indexOf('lookupSignInDoor(');
  const auth = ACTIONS.indexOf('.auth.signInWithPassword(');
  const refused = ACTIONS.indexOf('if (error)', auth);
  assert.ok(call > 0, 'the lookup is not called at all');
  assert.ok(auth > 0 && refused > auth, 'the refusal branch was not found after the auth call');
  assert.ok(call > refused, 'the lookup runs BEFORE the password was refused — that reveals the provider to anyone who types an email');
  assert.match(ACTIONS, /CREDENTIALS_REFUSAL\.test\(error\.message\)[\s\S]{0,120}lookupSignInDoor\(/, 'the lookup must be gated on the credentials refusal, not on any error');
  assert.equal((ACTIONS.match(/lookupSignInDoor\(/g) || []).length, 1, 'exactly one call site');
});

test('🔴 BOTH entry points route through the one helper that does the lookup', () => {
  // exchangeCredentials is the shared helper; the route action and the in-place action both call it.
  const helper = /async function exchangeCredentials\(/.exec(ACTIONS);
  assert.ok(helper, 'exchangeCredentials is gone — the two doors no longer share a path');
  const callers = (ACTIONS.match(/await exchangeCredentials\(formData\)/g) || []).length;
  assert.equal(callers, 2, `expected the route action AND signInInPlace to call exchangeCredentials, found ${callers}`);
  assert.match(ACTIONS, /export async function signInWithPassword\(/);
  assert.match(ACTIONS, /export async function signInInPlace\(/);
  // and both carry the provider out
  assert.match(ACTIONS, /provider: result\.provider/, 'signInInPlace must return the provider');
  assert.match(ACTIONS, /provider=\$\{/, 'the route redirect must carry ?provider=');
});

test('🔴 no client file imports the server lookup, and the RPC is service-role only', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry) && !entry.includes('.test.')) {
        const code = readFileSync(full, 'utf8');
        if (code.includes('sign-in-door.server') && /^\s*['"]use client['"]/m.test(code)) offenders.push(full);
      }
    }
  };
  walk('app'); walk('lib');
  assert.deepEqual(offenders, [], 'a client component imports the service-role lookup');
  const migrationsDir = join(process.cwd(), '..', '..', 'supabase', 'migrations');
  const file = readdirSync(migrationsDir).find((f) => f.endsWith('_sign_in_door_for_email.sql'));
  assert.ok(file, 'the migration is missing');
  const sql = readFileSync(join(migrationsDir, file!), 'utf8');
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.sign_in_door_for_email\(text\) FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.sign_in_door_for_email\(text\) TO service_role;/);
  assert.doesNotMatch(sql, /GRANT EXECUTE ON FUNCTION public\.sign_in_door_for_email\(text\) TO (anon|authenticated)/);
});

// ── "Email me a link to set a password" (a Google-only account that typed a password) ──
const CARD = stripComments(readFileSync('app/login/_components/sign-in-card.tsx', 'utf8'));

test('🔴 the set-password button is rendered ONLY inside the provider-refusal gate — never on first render', () => {
  // shownProvider is derived from shownError, so it is null until a password attempt failed.
  assert.match(CARD, /const shownProvider: KnownProvider \| null = shownError \? /, 'shownProvider is no longer tied to a refusal');
  const gate = CARD.indexOf('{shownProvider ? (\n        <form action={sendReset}');
  assert.ok(gate > 0, 'the set-password form is not behind the shownProvider gate');
  assert.equal((CARD.match(/SET_PASSWORD_WORDS\.button/g) || []).length, 1, 'the button text must appear exactly once, inside the gate');
  assert.ok(CARD.indexOf('SET_PASSWORD_WORDS.button') > gate, 'the button text sits outside the gate');
  assert.match(CARD, /<input type="hidden" name="intent" value="reset" \/>/);
});

test('🔴 the button calls the EXISTING send (signInInPlace, intent=reset) — and the dead end is gone', () => {
  assert.equal((CARD.match(/useActionState\(\s*signInInPlace/g) || []).length, 2, 'the reset must reuse signInInPlace, not a new action');
  assert.doesNotMatch(CARD, /Safari or Chrome/);
  assert.doesNotMatch(readFileSync('lib/sign-in-door.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''), /Safari or Chrome/, 'the dead-end sentence is still in the door');
  // the email is never carried in the URL
  assert.doesNotMatch(CARD, /email=\$\{|\?email=/);
});

test('🔴 intent=reset runs the shipped recovery send, behind captcha + rate limit, and adds NO exported action', () => {
  const branch = ACTIONS.indexOf("formData.get('intent') === 'reset'");
  const exchange = ACTIONS.indexOf('await exchangeCredentials(formData);', branch);
  assert.ok(branch > 0 && exchange > branch, 'the reset intent must be handled BEFORE any password exchange');
  const send = ACTIONS.slice(ACTIONS.indexOf('async function sendSetPasswordLink('), ACTIONS.indexOf('export async function signInInPlace('));
  const order = ['verifyTurnstileToken(', "rateLimit(`pwreset:email:", 'sendPasswordRecoveryLink('].map((t) => send.indexOf(t));
  const [captcha, limit, mail] = order as [number, number, number];
  assert.ok(order.every((n) => n > 0) && captcha < limit && limit < mail, 'captcha → rate limit → send, in that order');
  // anti-enumeration: the send result must never choose between two messages
  assert.doesNotMatch(send, /if \(!sent\)[\s\S]{0,160}return refuse/, 'the send result must not change what the person is told');
  const exported = [...ACTIONS.matchAll(/^export\s+async\s+function\s+(\w+)/gm)].map((m) => m[1]).sort();
  assert.deepEqual(exported, ['signInInPlace', 'signInWithPassword'], 'a new exported server action was added (route budget)');
});
