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

import { isCaptchaRefusal } from './turnstile';

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
  // ⚠ ADDED 2026-08-12. The first six were the ones this app happened to call,
  // which is not the same question as "which ones does captcha gate". A method
  // absent from this list is a hole the guard waves through — proven by adding a
  // file that called all four of these unwired and watching the suite stay green.
  'verifyOtp',
  'signInWithIdToken',
  'signInWithSSO',
  // ⛔ NOT `reauthenticate` — supabase-js declares it with NO parameters
  // (`GoTrueClient.d.ts`), so it cannot carry a token and listing it would make
  // this guard cry wolf on a call nobody can fix.
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

/**
 * Is the widget inside the `<form action={NAME}>` that posts, or merely
 * somewhere in the same file? A hidden input outside its form is never
 * submitted — the token would silently stop arriving with nothing to see.
 *
 * Scans from the opening tag to the matching `</form>`. Nested forms are not a
 * concern here: CI runs a dedicated `lint nested forms` check.
 */
function widgetIsInsideForm(
  code: string,
  action: string,
): 'ok' | 'outside-form' | 'no-widget-in-file' {
  if (!code.includes('<TurnstileField')) return 'no-widget-in-file';
  const open = new RegExp(`<form[^>]*action=\\{${action}\\}`).exec(code);
  // The caller only reaches us when `action={NAME}` matched, but it may have
  // matched something that is not a <form ...> opening tag. Fail toward the
  // loud answer rather than silently passing.
  if (!open) return code.includes('<TurnstileField') ? 'ok' : 'no-widget-in-file';
  const close = code.indexOf('</form>', open.index);
  const body = close === -1 ? code.slice(open.index) : code.slice(open.index, close);
  return body.includes('<TurnstileField') ? 'ok' : 'outside-form';
}

/** Resolve an import specifier to a repo-relative module path, or null. */
function resolveImport(fromFileRel: string, spec: string): string | null {
  if (spec.startsWith('@/')) return spec.slice(2);
  if (spec.startsWith('.')) {
    const dir = fromFileRel.split('/').slice(0, -1);
    const parts = spec.split('/');
    for (const part of parts) {
      if (part === '.') continue;
      else if (part === '..') dir.pop();
      else dir.push(part);
    }
    return dir.join('/');
  }
  return null;
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
      // ⚠ THREE NARROWINGS, EVERY ONE FOUND BY MUTATION, NONE BY READING:
      //   • `<TurnstileField`, not the bare identifier — the IMPORT LINE alone
      //     satisfied that, so deleting the widget from the JSX left it green.
      //   • `site.code` is comment-stripped — a comment mentioning the widget
      //     satisfied it too, which is the original bug in miniature.
      //   • and the widget must be INSIDE THE FORM (below), not merely in the
      //     same file.
      // A guard that passes on a half-removed fix is decoration.
      const inForm = widgetIsInsideForm(site.code, action);
      if (inForm === 'no-widget-in-file') {
        offenders.push(
          `${site.rel} — posts to ${action}(), which reads captcha_token, but this ` +
            `form renders no <TurnstileField>. The server waits for a stamp the ` +
            `form never asks for.`,
        );
      } else if (inForm === 'outside-form') {
        // 🔴 THE ORIGINAL BUG, WEARING THIS GUARD'S CLOTHES. A hidden input is
        // only submitted if it is INSIDE the <form> that posts. Move the widget
        // one line above the opening tag and the page still looks right, the
        // challenge still renders, the file still contains `<TurnstileField` —
        // and the token silently stops being sent. Proven by moving it.
        offenders.push(
          `${site.rel} — renders <TurnstileField> but NOT inside the <form ` +
            `action={${action}}>. A hidden field outside its form is never ` +
            `submitted, so the token silently never arrives.`,
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

test('a bot-check refusal is told apart from a genuinely dead link', () => {
  // isCaptchaRefusal decides which of two very different screens a person sees.
  assert.equal(
    isCaptchaRefusal({ message: 'captcha protection: request disallowed (invalid-input-response)' }),
    true,
  );
  assert.equal(isCaptchaRefusal({ message: 'CAPTCHA verification failed' }), true, 'case-insensitive');
  assert.equal(isCaptchaRefusal({ message: null, code: 'captcha_failed' }), true, 'code counts too');
  // Fails toward the HARSHER screen, never toward letting someone through.
  assert.equal(isCaptchaRefusal({ message: 'Invalid login credentials' }), false);
  assert.equal(isCaptchaRefusal({ message: '', code: '' }), false);
  assert.equal(isCaptchaRefusal(null), false);
  assert.equal(isCaptchaRefusal(undefined), false);
});

test('🔴 a refused claim can still be RETRIED — it must not hit the dead-end screen', () => {
  // A FIX NOBODY CAN REACH IS NO FIX. Routing captcha refusals to their own
  // state is worthless if the page then renders that state with the terminal
  // "this link isn't active — ask the host for a new one" copy, which has no
  // form and no retry. A crew member told that re-scans a QR that was fine.
  const PAGES: { page: string; action: string }[] = [
    { page: 'app/papic/claim/[token]/page.tsx', action: 'app/papic/actions.ts' },
    { page: 'app/panood/cam/[token]/page.tsx', action: 'app/panood/actions.ts' },
  ];

  for (const { page, action } of PAGES) {
    const actionSrc = withoutComments(readFileSync(join(WEB, action), 'utf8'));
    const pageSrc = withoutComments(readFileSync(join(WEB, page), 'utf8'));

    assert.match(
      actionSrc,
      /isCaptchaRefusal\([\s\S]{0,40}\)\s*\?\s*'verify'/,
      `${action} must route a captcha refusal to its own state, not the terminal one`,
    );

    // The terminal branch must NOT swallow the retryable state.
    const terminal = /if \(state === 'invalid' \|\| state === 'error'\)/.exec(pageSrc);
    assert.notEqual(terminal, null, `${page}: terminal branch not found — re-check this guard`);
    const terminalCond = pageSrc.slice(terminal!.index, terminal!.index + 120);
    assert.equal(
      terminalCond.includes("'verify'"),
      false,
      `${page} folds the retryable bot-check state into the dead-end screen`,
    );

    // And the retry state must actually be handled, or it silently falls to a
    // page that says nothing about why the tap did not work.
    assert.match(
      pageSrc,
      /state === 'verify'/,
      `${page} never reads the retryable state, so a refused person is told nothing`,
    );
  }
});

test('🔴 every CLIENT-MINTED captcha path has something that actually mints', () => {
  // THE GAP THIS CLOSES. The two tests above only see tokens that travel as a
  // FORM FIELD. Three of the five anonymous sign-in paths do not use a form at
  // all — they are a tap in a client component that calls a server action and
  // passes the token as an argument. Nothing checked them, and deleting the
  // mint left the whole suite green:
  //   • the Live Studio guest camera pick
  //   • the wedding onboarding "finish"
  //   • the generic (non-wedding) onboarding "finish"
  // Each is an anonymous sign-in — precisely what Supabase's captcha gates — so
  // a missing mint is a paid feature or a whole signup funnel switching itself
  // off the day captcha goes on, with nothing to see.
  const files = APP_SOURCES().map((f) => ({
    rel: relative(WEB, f),
    raw: readFileSync(f, 'utf8'),
    code: withoutComments(readFileSync(f, 'utf8')),
  }));

  // Modules that spend a token they did NOT read off a form ⇒ a client minted it.
  const clientMinted = files.filter(
    (f) =>
      f.code.includes('captchaOptions(') &&
      !f.code.includes('captchaTokenFromForm(') &&
      !f.rel.endsWith('turnstile.ts'),
  );

  assert.ok(
    clientMinted.length >= 3,
    `only ${clientMinted.length} client-minted captcha module(s) found — the scan ` +
      `has gone blind. There are at least three (guest camera pick + two ` +
      `onboarding commits).`,
  );

  const offenders: string[] = [];
  for (const mod of clientMinted) {
    const modPath = mod.rel.replace(/\.tsx?$/, '');
    const importers = files.filter((f) => {
      if (f.rel === mod.rel) return false;
      for (const m of f.code.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        if (resolveImport(f.rel, m[1]!) === modPath) return true;
      }
      return false;
    });

    if (importers.length === 0) {
      offenders.push(
        `${mod.rel} — spends a captcha token but NOTHING imports it. Either it is ` +
          `dead, or the scan cannot see its caller; both need a human.`,
      );
      continue;
    }
    if (!importers.some((f) => f.code.includes('mintTurnstileToken'))) {
      offenders.push(
        `${mod.rel} — takes a client-minted captcha token, but none of its ` +
          `${importers.length} caller(s) call mintTurnstileToken(): ` +
          `${importers.map((f) => f.rel).join(', ')}. The argument is always ` +
          `undefined, so the anonymous sign-in is refused the moment captcha is on.`,
      );
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `A captcha-gated path expects a token minted in the browser, and nothing ` +
      `mints it.\n\n${offenders.join('\n')}`,
  );
});
