/**
 * a-bare-form-post-never-replaces-the-maker.test.ts — 🧷 A FORM POST THAT NEVER ANSWERED KEEPS THE SCREEN AND WHAT WAS
 * TYPED — AND NO FORM IN THE MAKER'S TWO FOLDERS POSTS BARE.
 *
 * `lib/a-failed-press-never-replaces-the-maker.test.ts` holds every `await` in a transition. It cannot see
 * `<form action={serverAction}>`: React runs that in a transition of its own and our source has no `await` to find.
 * Counted 2026-10-11: 64 such forms under `launch/` and `website/` — the section rows, the scene slots, the custom
 * section's title and words, the Love Story's moment sheet, the music and hero uploads, the privacy switches. Offline
 * or on a 5xx each one's action rejected, React rethrew it, and `app/error.tsx` replaced the Maker with the form in
 * it. They are all `SafeForm` now (`app/dashboard/[eventId]/_components/safe-form.tsx`).
 *
 * ── WHAT IT CLAIMS ──────────────────────────────────────────────────────────────────────────────────────────────────
 *   1. `guardFormAction` (run): an action that ANSWERS runs once and nothing is said; one that rejects for a real
 *      failure is swallowed and handed to `onFailed`; Next's own control flow — a redirect, a not-found — is rethrown
 *      untouched and nothing is said (a save that ends in `redirect()` must never read as "did not save").
 *   2. `keepWhatWasTyped` (run, on a real EventTarget): it cancels the ONE reset that follows, then never another;
 *      it disarms by itself; a null form is a no-op.
 *   3. `SafeForm` is those two and a line: read with the parser, its form's action is the guarded one, the failure
 *      arms the keep, says `FORM_NOT_SAVED` in a `role="alert"` and tells the Maker's status line.
 *   4. NO BARE FORM: under `launch/` and `website/`, every `<form>` whose `action` is an expression is one of the
 *      string posts named in `STRING_POSTS` (each proved to be a string constant); every other form with an action
 *      is `<SafeForm>`. A NEW `<form action={serverAction}>` fails here.
 *   5. `formAction` on a button is not wrapped by `SafeForm` — the ones that exist are counted, with a ceiling.
 *
 * ── NOT CLAIMED ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *   · That React really resets a form after its action returns, or that cancelling `reset` stops it, in a browser —
 *     read in react-dom's source (`fiber.stateNode.reset()`), not driven here.
 *   · Forms outside the two folders (seating, guests, the supplier pages).
 *   · `launch/_components/print-menu-editor.tsx` posts NATIVELY to an API route that only answers with a redirect:
 *     a failed post there is the browser's own error page and the typed menu is lost. Listed in `STRING_POSTS`, not
 *     fixed — the route has to learn to answer JSON first, as the words form's does (`SoftPost`).
 *   · The four `formAction` buttons in `website/editor/_components/editor-shell.tsx` (another builder's file).
 *   · An unanswered post may have been SAVED; the line says "did not save" (see `safe-form.tsx`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { FORM_NOT_SAVED, KEEP_TYPED_MS, guardFormAction, isNextControlFlow, keepWhatWasTyped } from './safe-form';
import { stripComments } from './strip-comments';

const WEB = path.resolve(__dirname, '..');
const EVENT = 'app/dashboard/[eventId]';
const SAFE_FORM = `${EVENT}/_components/safe-form.tsx`;

const redirectError = () => Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;push;/dashboard/e1/launch?saved=1;303;' });
const fd = () => new FormData();

test('1 · an action that answers runs once, and nothing is said', async () => {
  let ran = 0;
  const said: unknown[] = [];
  await guardFormAction(async () => void (ran += 1), (e) => said.push(e))(fd());
  await guardFormAction(() => void (ran += 1), (e) => said.push(e))(fd());
  assert.equal(ran, 2);
  assert.deepEqual(said, []);
});

test('1 · a post that never answered is swallowed and SAID — it does not reach React', async () => {
  for (const failure of [new TypeError('Failed to fetch'), new Error('An unexpected response was received from the server.'), 'a string']) {
    const said: unknown[] = [];
    await assert.doesNotReject(
      guardFormAction(async () => {
        throw failure;
      }, (e) => said.push(e))(fd()),
    );
    assert.deepEqual(said, [failure], 'the failure was swallowed in silence');
  }
});

test('1 · a redirect (and a not-found) is Next’s answer, not a failure: rethrown untouched, nothing said', async () => {
  const signals = [
    redirectError(),
    Object.assign(new Error('NEXT_NOT_FOUND'), { digest: 'NEXT_NOT_FOUND' }),
    Object.assign(new Error('NEXT_HTTP_ERROR_FALLBACK;404'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' }),
    { digest: 'NEXT_REDIRECT;replace;/login;307;' }, // as it crosses a boundary: a plain object with the digest
  ];
  for (const signal of signals) {
    assert.equal(isNextControlFlow(signal), true);
    const said: unknown[] = [];
    await assert.rejects(
      guardFormAction(async () => {
        throw signal;
      }, (e) => said.push(e))(fd()),
      (e: unknown) => e === signal,
    );
    assert.deepEqual(said, [], 'a redirect was reported as "did not save"');
  }
  for (const not of [new TypeError('Failed to fetch'), new Error('redirect failed'), { digest: '3284377371' }, null, 'NEXT_REDIRECT', new Error('MY_NEXT_REDIRECT_IDEA')]) {
    assert.equal(isNextControlFlow(not), false, String(not));
  }
});

test('2 · what was typed is kept through the ONE reset that follows — and no reset after it', () => {
  const form = new EventTarget();
  const reset = () => {
    const e = new Event('reset', { cancelable: true });
    form.dispatchEvent(e);
    return e.defaultPrevented; // cancelled → the browser does not clear the fields
  };
  assert.equal(reset(), false, 'a form that was never armed must reset as usual');
  keepWhatWasTyped(form);
  assert.equal(reset(), true, 'React’s reset after the caught failure was not cancelled — the typed words are wiped');
  assert.equal(reset(), false, 'a LATER reset is blocked too — the form can never be cleared again');
});

test('2 · it disarms by itself, and by hand; a missing form is a no-op', () => {
  const form = new EventTarget();
  const cancelled = () => {
    const e = new Event('reset', { cancelable: true });
    form.dispatchEvent(e);
    return e.defaultPrevented;
  };
  let fire: (() => void) | null = null;
  const waits: number[] = [];
  const timers = { set: (fn: () => void, ms: number) => ((fire = fn), waits.push(ms), 1), clear: () => void (fire = null) };
  keepWhatWasTyped(form, timers);
  assert.deepEqual(waits, [KEEP_TYPED_MS]);
  fire!();
  assert.equal(cancelled(), false, 'still armed after its time — a reset the person asks for later would be swallowed');
  const disarm = keepWhatWasTyped(form, timers);
  disarm();
  assert.equal(cancelled(), false);
  assert.equal(fire, null, 'the timer outlives the disarm');
  assert.doesNotThrow(() => keepWhatWasTyped(null)());
});

const read = (rel: string) => fs.readFileSync(path.join(WEB, rel), 'utf8');

test('3 · SafeForm is those two and a line', () => {
  const src = stripComments(read(SAFE_FORM));
  assert.match(src, /^\s*'use client';/);
  assert.match(src, /return guardFormAction\(action, \(\) => \{\s*keepWhatWasTyped\(own\.current\);\s*setFailed\(true\);\s*announceMakerSave\(\{ state: 'error', text: FORM_NOT_SAVED \}\);\s*\}\)\(formData\);/);
  assert.match(src, /<form \{\.\.\.rest\} ref=\{setRef\} action=\{guarded\}>/, 'the form posts the bare action');
  assert.match(src, /\{failed \? \(\s*<p role="alert" data-form-not-saved=""[^>]*>\s*\{FORM_NOT_SAVED\}\s*<\/p>\s*\) : null\}/);
  assert.equal(FORM_NOT_SAVED, 'That did not save. Please try again.');
});

function walkDir(rel: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(path.join(WEB, rel), { withFileTypes: true })) {
    const next = `${rel}/${e.name}`;
    if (e.isDirectory()) walkDir(next, out);
    else if (/\.tsx$/.test(e.name) && !/\.(test|spec)\.tsx$/.test(e.name)) out.push(next);
  }
  return out;
}

/** A form that posts to an ADDRESS, not a function: `file` → the constant it posts to, and how a failed post is met. */
const STRING_POSTS: Record<string, { to: string; failed: string }> = {
  [`${EVENT}/launch/_components/maker-details.tsx`]: { to: 'PRINT_WORDS_ENDPOINT', failed: 'SoftPost takes its submit over and catches the fetch (`soft-post.tsx`).' },
  [`${EVENT}/launch/_components/print-menu-editor.tsx`]: { to: 'PRINT_MENU_ENDPOINT', failed: 'NOT MET — a native post; see NOT CLAIMED.' },
};
/** `formAction` on a submit button — React gives it to the button, so `SafeForm` cannot wrap it. A ceiling per file. */
const BUTTON_ACTIONS: Record<string, number> = { [`${EVENT}/website/editor/_components/editor-shell.tsx`]: 4 };

type Found = { file: string; line: number; tag: string; action: string };
function formsIn(file: string): { forms: Found[]; buttonActions: number } {
  const src = read(file);
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const forms: Found[] = [];
  let buttonActions = 0;
  const visit = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName.getText(sf);
      for (const p of n.attributes.properties) {
        if (!ts.isJsxAttribute(p)) continue;
        const name = p.name.getText(sf);
        if (name === 'formAction') buttonActions += 1;
        if (name === 'action' && (tag === 'form' || tag === 'SafeForm') && p.initializer && ts.isJsxExpression(p.initializer) && p.initializer.expression) {
          forms.push({ file, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, tag, action: p.initializer.expression.getText(sf) });
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { forms, buttonActions };
}

const FILES = [...walkDir(`${EVENT}/launch`), ...walkDir(`${EVENT}/website`)];
const SCAN = FILES.map((file) => ({ file, ...formsIn(file) }));

test('4 · no form under launch/ or website/ posts a bare action', () => {
  const all = SCAN.flatMap((s) => s.forms);
  const safe = all.filter((f) => f.tag === 'SafeForm');
  assert.ok(FILES.length >= 150 && safe.length >= 60, `only ${safe.length} SafeForms in ${FILES.length} files — the scan is not reading the Maker`);
  const bare = all.filter((f) => f.tag === 'form' && STRING_POSTS[f.file]?.to !== f.action).map((f) => `${f.file}:${f.line}  <form action={${f.action}}>`);
  assert.deepEqual(
    bare,
    [],
    `A plain <form action={…}> in the Maker. Offline or on a 5xx its action rejects, React rethrows it, and the whole Maker — with what was typed — is replaced by the app's error screen. Use <SafeForm> (${SAFE_FORM}):\n  ${bare.join('\n  ')}`,
  );
  // Each named string post really is a string constant, in the file that names it — never a function that slipped in.
  for (const [file, { to }] of Object.entries(STRING_POSTS)) {
    assert.ok(all.some((f) => f.file === file && f.tag === 'form' && f.action === to), `${file} no longer posts to ${to} — take it off STRING_POSTS`);
    const src = stripComments(read(file));
    const here = new RegExp(`const ${to} = '/api/[^']+';`).test(src);
    const imported = new RegExp(`import \\{[^}]*\\b${to}\\b[^}]*\\} from '([^']+)'`).exec(src);
    assert.ok(here || imported, `${to} is neither declared in ${file} nor imported — it may be a function now`);
    if (!here && imported) {
      const from = imported[1]!.startsWith('@/') ? imported[1]!.slice(2) : path.join(path.dirname(file), imported[1]!);
      const lib = ['.ts', '.tsx'].map((x) => `${from}${x}`).find((x) => fs.existsSync(path.join(WEB, x)));
      assert.ok(lib && new RegExp(`export const ${to} = '/api/[^']+';`).test(stripComments(read(lib))), `${to} is not a string address in ${imported[1]}`);
    }
  }
});

test('5 · a button’s own formAction is not wrapped — none is added beyond the ones counted', () => {
  const over = SCAN.filter((s) => s.buttonActions > (BUTTON_ACTIONS[s.file] ?? 0)).map((s) => `${s.file}: ${s.buttonActions} formAction (ceiling ${BUTTON_ACTIONS[s.file] ?? 0})`);
  assert.deepEqual(over, [], `A submit button with its own formAction: SafeForm cannot catch it. Give the form ONE action, or call the action from a caught transition:\n  ${over.join('\n  ')}`);
});
