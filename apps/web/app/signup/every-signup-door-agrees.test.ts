/**
 * every-signup-door-agrees.test.ts — EVERY form that posts to `signUp` carries
 * the Terms box and "Stay signed in", and shows Google / Apple ABOVE the email.
 *
 * ── THE DEFECT (audit GUEST_SIGNUP_FLOW_MAP_2026-09-25 §C, bug C.3) ─────────
 * The wedding onboarding's `account` screen — the screen at the end of the
 * homepage's "Start your celebration" flow — posted to `signUp` with NO
 * `terms_agreed` and NO `remember`. `signUp` refuses a submission without the
 * agreement (CTRL-B3), so EVERY couple who chose email there was bounced to
 * `/signup?error=terms_required` and had to retype their email and password;
 * and without `remember` the login only lasted until the browser closed.
 *
 * 🔑 THE SAME SHAPE AS `consent-is-affirmative.test.ts`: the rule was written
 * down and obeyed on `/signup` (`terms-are-agreed-not-assumed.test.ts` pins
 * that ONE file), and nothing noticed the second door. So this guard is keyed on
 * the ACTION, not on a file: any form anywhere under `app/` whose action is
 * `signUp` is a sign-up door and is held to the same contract. The next door to
 * post there is held automatically.
 *
 * ── THE ORDER (owner 2026-09-25: "When a new account is created via website
 * must be similar to the event invitation") ────────────────────────────────
 * Google / Apple first — a provider redirect under a half-filled form loses the
 * form (DECISION_LOG 2026-09-10) — through the one shared verb, so the two
 * website doors cannot drift into two wordings of the same button.
 *
 * 🛡 Comments stripped before matching (`lib/strip-comments.ts`), so a fix's
 * own explanation is never the finding.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HERE, '..');

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

type Door = { where: string; code: string; form: string; formAt: number };

/** Every `<form action={signUp}` … `</form>` block in app/, comments stripped. */
function doors(): Door[] {
  const out: Door[] = [];
  for (const file of sources(APP_ROOT)) {
    const code = stripComments(readFileSync(file, 'utf8'));
    let from = 0;
    for (;;) {
      const at = code.indexOf('<form action={signUp}', from);
      if (at < 0) break;
      const end = code.indexOf('</form>', at);
      assert.ok(end > at, `${relative(APP_ROOT, file)}: an unclosed signUp form`);
      out.push({ where: relative(APP_ROOT, file), code, form: code.slice(at, end), formAt: at });
      from = end;
    }
  }
  return out;
}

const ALL = doors();

// SABOTAGE: rename the action → RED (a guard over nothing passes).
test('the sweep finds the doors — /signup and the wedding onboarding account screen', () => {
  const where = ALL.map((d) => d.where).sort();
  assert.ok(where.includes(join('signup', 'page.tsx')), `/signup not found among ${where.join(', ')}`);
  assert.ok(
    where.includes(join('onboarding', 'wedding', '_components', 'onboarding-shell.tsx')),
    `the onboarding account screen not found among ${where.join(', ')}`,
  );
});

// SABOTAGE: delete the Terms <label> from onboarding-shell.tsx → RED.
// SABOTAGE: add `defaultChecked` to it → RED.
// SABOTAGE: turn it into `type="hidden"` → RED.
test('every sign-up door carries the Terms box — a checkbox, required, UNTICKED, above the button', () => {
  const offenders: string[] = [];
  for (const d of ALL) {
    const tags = [...d.form.matchAll(/<input\b[^>]*\bname=\{TERMS_FIELD\}[^>]*>/g)].map((m) => m[0]);
    const literal = [...d.form.matchAll(/<input\b[^>]*\bname="terms_agreed"[^>]*>/g)].map((m) => m[0]);
    if (literal.length) offenders.push(`${d.where}: posts "terms_agreed" by hand — use TERMS_FIELD`);
    if (tags.length !== 1) {
      offenders.push(`${d.where}: ${tags.length} Terms inputs (want exactly 1) — signUp refuses without it`);
      continue;
    }
    const tag = tags[0]!;
    if (!/\btype="checkbox"/.test(tag)) offenders.push(`${d.where}: the Terms field is not a checkbox — ${tag}`);
    if (!/\brequired\b/.test(tag)) offenders.push(`${d.where}: the Terms box is not \`required\``);
    if (/\b(defaultChecked|checked)\b/.test(tag)) offenders.push(`${d.where}: the Terms box is pre-ticked`);
    const box = d.form.indexOf('name={TERMS_FIELD}');
    const submit = d.form.indexOf('<SubmitButton');
    if (submit < 0 || box > submit) offenders.push(`${d.where}: the Terms box is not ABOVE the submit`);
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});

// SABOTAGE: delete the remember checkbox from onboarding-shell.tsx → RED.
test('every sign-up door posts "Stay signed in", ticked by default, as a checkbox', () => {
  const offenders: string[] = [];
  for (const d of ALL) {
    const tags = [...d.form.matchAll(/<input\b[^>]*\bname="remember"[^>]*>/g)].map((m) => m[0]);
    if (tags.length !== 1) {
      offenders.push(`${d.where}: ${tags.length} remember inputs — without one the login ends when the browser closes`);
      continue;
    }
    if (!/\btype="checkbox"/.test(tags[0]!)) offenders.push(`${d.where}: remember is not a checkbox`);
    if (!/\bdefaultChecked\b/.test(tags[0]!)) offenders.push(`${d.where}: remember must start ticked, as on /signup`);
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});

// SABOTAGE: move <OAuthButtonRow> below the form on either door → RED.
// SABOTAGE: hand-type verb="Continue with" on one door → RED.
test('Google / Apple come FIRST, in the one shared wording, on every sign-up door', () => {
  const offenders: string[] = [];
  for (const d of ALL) {
    const oauth = d.code.indexOf('<OAuthButtonRow');
    if (oauth < 0) {
      offenders.push(`${d.where}: no <OAuthButtonRow> — the door offers no Google / Apple`);
      continue;
    }
    if (oauth > d.formAt) offenders.push(`${d.where}: Google / Apple sit BELOW the email form`);
    for (const m of d.code.matchAll(/<(OAuthButtonRow|DesktopOAuthButtons)\b[^>]*>/g)) {
      if (!/verb=\{SIGNUP_OAUTH_VERB\}/.test(m[0])) {
        offenders.push(`${d.where}: ${m[1]} does not use SIGNUP_OAUTH_VERB — ${m[0]}`);
      }
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});
