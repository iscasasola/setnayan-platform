/**
 * one-oauth-wording.test.ts — ONE wording for every Google / Apple button, and the agreement said on that path of
 * every sign-up door (sweep C9, 2026-10-19).
 *
 * The defect: /signup said "Sign in with Google / Apple" and /login "Continue with Google / Apple" — one button, two
 * names. And on /signup the Terms box is the email path's (`data-password-only`), so a person who tapped Google or
 * Apple — or typed a Gmail address, which folds the box away — met no agreement at all.
 *
 * The property, not a phrasing: every OAuth button component reads its words from `OAUTH_VERB` and accepts none of
 * its own; no page spells "Sign in with Google/Apple" by hand; every form that posts to `signUp` mounts
 * `<OAuthTermsLine />` next to its Google / Apple row and asks its typed-address door for the same line.
 *
 * SABOTAGE: give `NativeOAuthButtons` back a `verb = 'Sign in with'` prop → RED (test 2).
 * SABOTAGE: type "Sign in with Google" into /signup → RED (test 3).
 * SABOTAGE: delete `<OAuthTermsLine />` from /signup → RED (test 4).
 * SABOTAGE: drop `withTerms` from the onboarding's GoogleAddressDoor → RED (test 4).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OAUTH_VERB } from './oauth-words';
import { stripComments } from './strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Every component that draws a Google / Apple sign-in button, and the providers it draws. */
const BUTTON_ROWS: Array<{ file: string; providers: string[] }> = [
  { file: 'app/_components/oauth-button-row.tsx', providers: ['Google', 'Apple'] },
  { file: 'app/_components/desktop-oauth-buttons.tsx', providers: ['Google', 'Apple'] },
  { file: 'app/_components/native-oauth-buttons.tsx', providers: ['Google', 'Apple'] },
  { file: 'app/_components/auth/google-address-door.tsx', providers: ['Google'] },
];

function tsxUnder(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsxUnder(full, out);
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

test('1 · the one wording is "Continue with" — what /login always said', () => {
  assert.equal(OAUTH_VERB, 'Continue with');
});

test('2 · every button row says OAUTH_VERB and takes no words of its own', () => {
  const offenders: string[] = [];
  for (const { file, providers } of BUTTON_ROWS) {
    const src = read(file);
    if (!/import \{ OAUTH_VERB \} from '@\/lib\/oauth-words'/.test(src)) offenders.push(`${file}: does not import OAUTH_VERB`);
    for (const p of providers) {
      if (!new RegExp(`\\{OAUTH_VERB\\} ${p}|\\$\\{OAUTH_VERB\\} ${p}`).test(src)) offenders.push(`${file}: the ${p} button does not say OAUTH_VERB`);
    }
    if (/\bverb\??\s*[:=]/.test(src)) offenders.push(`${file}: declares a \`verb\` of its own — a second wording waiting to happen`);
    if (/(Sign in|Continue|Sign up) with (Google|Apple)/.test(src)) offenders.push(`${file}: spells the button's words by hand`);
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});

test('3 · no page outside the back office spells "Sign in with Google / Apple" by hand', () => {
  const offenders: string[] = [];
  for (const full of tsxUnder(join(WEB, 'app'))) {
    const rel = relative(WEB, full);
    if (rel.startsWith(join('app', 'admin'))) continue; // the ops reminder names Apple's product, "Sign in with Apple"
    if (/Sign in with (Google|Apple)/.test(stripComments(readFileSync(full, 'utf8')))) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `hand-typed OAuth wording in:\n${offenders.join('\n')}`);
});

test('4 · every sign-up door states the agreement on its Google / Apple path', () => {
  const doors = tsxUnder(join(WEB, 'app'))
    .map((full) => ({ rel: relative(WEB, full), src: stripComments(readFileSync(full, 'utf8')) }))
    .filter((f) => f.src.includes('<form action={signUp}'));
  assert.ok(doors.length >= 2, `found ${doors.length} sign-up door(s) — /signup and the onboarding account screen expected`);
  const offenders: string[] = [];
  for (const { rel, src } of doors) {
    if (!src.includes('<OAuthButtonRow')) continue;
    if (!/<OAuthTermsLine\s*\/>/.test(src)) offenders.push(`${rel}: Google / Apple row with no <OAuthTermsLine />`);
    for (const m of src.matchAll(/<GoogleAddressDoor\b[^>]*>/g)) {
      if (!/\bwithTerms\b/.test(m[0])) offenders.push(`${rel}: its typed-address door folds the Terms box away and says nothing`);
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
  const line = read('app/_components/auth/oauth-terms-line.tsx');
  assert.match(line, /href="\/terms"/, 'the line must link the Terms');
  assert.match(line, /href="\/privacy"/, 'the line must link the Privacy Policy');
});
