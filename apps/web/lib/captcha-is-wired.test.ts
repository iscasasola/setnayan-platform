/**
 * captcha-is-wired.test.ts — the bot check must not lock out the people it protects.
 *
 * WHAT IT COST (2026-08-11, found before anyone flipped the switch — the only
 * cheap time to find it). Supabase's captcha is a SINGLE GLOBAL SWITCH. The hour
 * it is turned on, GoTrue refuses every sign-in, sign-up, password reset and
 * anonymous sign-in that does not carry a valid token. Three auth paths were not
 * carrying one:
 *
 *   • /forgot-password — no token, no widget. The page someone reaches BECAUSE
 *     they are already locked out was the page that would refuse them.
 *   • /papic/claim/[token] and /panood/cam/[token] — their server actions had
 *     read `captcha_token` off the form since captcha landed, under a comment
 *     stating "the claim form carries a <TurnstileField>". The forms did not.
 *
 * 🔑 THE SHAPE OF THE BUG: one half of a handshake shipped, the other half was
 * described in a comment. A comment is not the other half. And a doc said all of
 * it was wired (OWNER_ACTIONS.md), which is how it stayed unexamined.
 *
 * 🔑 WHY NO TEST COULD HAVE CAUGHT IT BEFORE: with no site key set, the widget
 * renders nothing, `captchaOptions()` returns `{}`, and every one of these calls
 * is byte-identical to its pre-captcha self. The feature is INVISIBLE until the
 * day it is switched on, and on that day it is invisible in the other direction —
 * a refusal, with no error anyone reads. Same family as a phantom column, a
 * phantom enum value, a phantom RPC argument and a blocked iframe: the request is
 * DECLINED, and the only symptom is an absence.
 *
 * So this guard reads the SOURCE, which is the only thing that is true today.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

function sources(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next' || name === 'tests') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (
      (p.endsWith('.ts') || p.endsWith('.tsx')) &&
      !p.endsWith('.test.ts') &&
      !p.endsWith('.test.tsx') &&
      !p.endsWith('.d.ts')
    ) {
      out.push(p);
    }
  }
  return out;
}

const APP_SOURCES = () => sources(join(WEB, 'app')).concat(sources(join(WEB, 'lib')));

/**
 * The GoTrue calls Supabase's captcha switch gates. Every one of them takes a
 * `captchaToken`; every one of them is refused without it once captcha is on.
 */
const GATED_CALLS = [
  'signUp',
  'signInWithPassword',
  'signInWithOtp',
  'signInAnonymously',
  'resetPasswordForEmail',
  'resend',
] as const;

/**
 * Call sites that deliberately do NOT pass a token, each with the reason and the
 * consequence. A line here is a BILL, not a decision — you are signing off on
 * what happens to a real person when captcha is on. Keep it costed.
 */
const ACCEPTED_UNWIRED: Record<string, string> = {
  'app/signup/actions.ts:signInWithPassword':
    'The auto-sign-in immediately AFTER a successful signUp. A Turnstile token is ' +
    'SINGLE-USE and signUp just spent this form’s one token, so there is nothing ' +
    'left to pass — a second token would mean a second widget on the highest-intent ' +
    'form in the product. Cost when captcha is on: this call fails and the code ' +
    'falls through to its existing /login?ready=<email> redirect, which carries a ' +
    'working widget. A brand-new member types their password once more. Annoying, ' +
    'bounded, and NOT a lockout — which is why it is a line here and not a fix.',
};

/**
 * Source with comments removed.
 *
 * ⚠ NOT COSMETIC. The claim pages carry a comment quoting the very thing this
 * guard looks for (`<TurnstileField>`), so a plain `.includes()` over the raw
 * file is satisfied by PROSE ABOUT the widget while the widget itself is gone.
 * That is the original bug wearing the guard's clothes — a comment claiming the
 * form carries a widget was exactly what let the hole ship. Strip first, then
 * look. `{/* … *​/}` JSX comments are covered by the block-comment rule.
 */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** The text between a call's opening paren and its match. */
function callArgs(code: string, openParen: number): string {
  let depth = 0;
  for (let i = openParen; i < code.length; i++) {
    const ch = code[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return code.slice(openParen, i + 1);
    }
  }
  return code.slice(openParen);
}

test('every captcha-gated auth call passes a captcha token', () => {
  const offenders: string[] = [];
  const accepted: string[] = [];
  const seenMethods = new Set<string>();
  let sites = 0;

  for (const file of APP_SOURCES()) {
    const code = readFileSync(file, 'utf8');
    if (!code.includes('.auth.')) continue;
    const rel = relative(WEB, file);

    for (const method of GATED_CALLS) {
      const pattern = new RegExp(`\\.auth\\.${method}\\s*\\(`, 'g');
      for (const m of code.matchAll(pattern)) {
        const open = m.index! + m[0].length - 1;
        const args = callArgs(code, open);
        sites += 1;
        seenMethods.add(method);
        if (args.includes('captchaOptions(') || args.includes('captchaToken')) continue;
        const key = `${rel}:${method}`;
        if (key in ACCEPTED_UNWIRED) {
          accepted.push(`${key} — ${ACCEPTED_UNWIRED[key]}`);
          continue;
        }
        offenders.push(`${rel} — .auth.${method}() with no captcha token`);
      }
    }
  }

  // 🔑 A GUARD THAT FINDS NOTHING PASSES FOREVER. If a refactor moves auth behind
  // a wrapper and this regex stops matching, the sweep goes silently green on an
  // app-wide lockout. Both of these are load-bearing.
  assert.ok(
    sites >= 6,
    `only ${sites} captcha-gated auth call(s) found — this scan has gone blind. ` +
      `Auth was refactored, or the method names changed. Fix the scan, do not ` +
      `delete it.`,
  );
  for (const required of ['signUp', 'signInWithPassword', 'signInAnonymously', 'resetPasswordForEmail']) {
    assert.ok(
      seenMethods.has(required),
      `no .auth.${required}() call found anywhere — this app definitely has one, ` +
        `so the scan is broken rather than the app being clean`,
    );
  }

  // NO SILENT CAP: everything waved through is printed, every run.
  if (accepted.length > 0) {
    console.log(`captcha: ${accepted.length} accepted unwired call(s):\n  ${accepted.join('\n  ')}`);
  }

  assert.deepEqual(
    offenders,
    [],
    `An auth call will be REFUSED the moment Supabase captcha is switched on, and ` +
      `it will fail as silence — no error a person reads, no log, just a form that ` +
      `does nothing. Pass a token: from a form via captchaTokenFromForm(formData), ` +
      `or from a client tap via mintTurnstileToken(). If it genuinely cannot carry ` +
      `one, add a costed line to ACCEPTED_UNWIRED saying what a real person ` +
      `experiences.\n\n${offenders.join('\n')}`,
  );
});

test('🔴 every action that READS a form token has a form that SUPPLIES one', () => {
  // THE EXACT BUG. Both claim screens' server actions read `captcha_token` and
  // neither form rendered a widget, so the server waited on a stamp nothing
  // printed. A read with no writer is the same shape as `papic_face_mode` — a
  // column nothing reachable ever wrote — and it hides just as well.
  const readers: { action: string; file: string }[] = [];

  for (const file of APP_SOURCES()) {
    const code = readFileSync(file, 'utf8');
    if (!code.includes('captchaTokenFromForm(')) continue;
    const rel = relative(WEB, file);
    // Per FUNCTION, not per file: a module can export several actions and only
    // one of them reads the form.
    const chunks = code.split(/export\s+async\s+function\s+/).slice(1);
    for (const chunk of chunks) {
      const name = /^([A-Za-z_$][\w$]*)/.exec(chunk)?.[1];
      if (!name) continue;
      const body = chunk.split(/\nexport\s/)[0] ?? chunk;
      if (body.includes('captchaTokenFromForm(')) readers.push({ action: name, file: rel });
    }
  }

  assert.ok(
    readers.length >= 4,
    `only ${readers.length} form-token reader(s) found — the scan has gone blind`,
  );

  const offenders: string[] = [];
  const files = APP_SOURCES().map((f) => ({
    rel: relative(WEB, f),
    code: withoutComments(readFileSync(f, 'utf8')),
  }));

  for (const { action, file } of readers) {
    const formSites = files.filter((f) =>
      new RegExp(`action=\\{${action}\\}`).test(f.code),
    );
    if (formSites.length === 0) {
      offenders.push(
        `${file} — ${action}() reads captcha_token but NO <form action={${action}}> ` +
          `exists anywhere. Either it is dead, or it is posted to some other way ` +
          `that will not carry the token.`,
      );
      continue;
    }
    for (const site of formSites) {
      // ⚠ TWO NARROWINGS, BOTH FOUND BY MUTATION, NEITHER BY READING:
      //   • `<TurnstileField`, not the bare identifier — the IMPORT LINE alone
      //     satisfied that, so deleting the widget from the JSX left the guard
      //     green.
      //   • `site.code` is comment-stripped — a comment mentioning the widget
      //     satisfied it too, which is the original bug in miniature.
      // A guard that passes on a half-removed fix is decoration.
      if (!site.code.includes('<TurnstileField')) {
        offenders.push(
          `${site.rel} — posts to ${action}(), which reads captcha_token, but this ` +
            `form renders no <TurnstileField>. The server waits for a stamp the ` +
            `form never asks for.`,
        );
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `A server action reads a captcha token off a form that does not supply one. ` +
      `With captcha on, that form is refused every time and shows nothing to ` +
      `explain why.\n\n${offenders.join('\n')}`,
  );
});
