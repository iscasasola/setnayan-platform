/**
 * ONE PASSWORD FIELD — owner 2026-10-29: "also on password allow them to see the
 * password they typed in with an eye icon or whatever icon is appropriate for
 * seeing the typed password."
 *
 * The eye lives in ONE component, `app/_components/password-field.tsx`. This
 * guard holds three things:
 *   1. no raw password box anywhere else in the app — a new `type="password"`
 *      (or a `type={… 'password' …}` spelling) would ship without the eye;
 *   2. the component keeps its promises (Eye/EyeOff, words, 44 px target,
 *      aria-pressed, focus + caret kept, masks again on submit);
 *   3. every user-facing door uses it AND keeps its password-manager hint.
 *
 * A case that truly needs a raw box goes in ALLOWED with its reason. Adding a
 * line there is a decision, not a fix.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOME = 'app/_components/password-field.tsx';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** path → why it may keep a raw password box. */
const ALLOWED = new Map<string, string>([]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(entry) && !/\.(test|spec)\./.test(entry)) out.push(full);
  }
  return out;
}

/** Every spelling of "this box is a password box". */
const RAW_PASSWORD = [
  /\btype\s*=\s*["'{`]\s*["'`]?password["'`]?/, // type="password" · type={'password'}
  /\btype\s*=\s*\{[^}]*["'`]password["'`][^}]*\}/, // type={x ? 'text' : 'password'}
  /\btype\s*:\s*["'`]password["'`]/, // createElement('input', { type: 'password' })
  /\.type\s*=\s*["'`]password["'`]/, // el.type = 'password'
  /setAttribute\(\s*["'`]type["'`]\s*,\s*["'`]password["'`]/,
];

function rawPasswordBoxes(code: string): string[] {
  const hits: string[] = [];
  for (const re of RAW_PASSWORD) {
    const m = code.match(re);
    if (m) hits.push(m[0]);
  }
  return hits;
}

test('the matcher catches every spelling (and not the component call)', () => {
  for (const s of [
    '<input type="password" />',
    "<input type='password' />",
    "<input type={'password'} />",
    "<input type={show ? 'text' : 'password'} />",
    "document.createElement('input', { type: 'password' })",
    "el.type = 'password'",
    "el.setAttribute('type', 'password')",
  ]) {
    assert.ok(rawPasswordBoxes(s).length > 0, `missed: ${s}`);
  }
  for (const s of ['<PasswordField name="password" autoComplete="current-password" />', 'name="password"', "accountType: 'password'"]) {
    assert.deepEqual(rawPasswordBoxes(s), [], `false alarm: ${s}`);
  }
});

test('no raw password box outside the one PasswordField', () => {
  const offenders: string[] = [];
  for (const root of ['app', 'components', 'lib']) {
    for (const file of sourceFiles(join(WEB, root))) {
      const rel = relative(WEB, file);
      if (rel === HOME || ALLOWED.has(rel)) continue;
      const hits = rawPasswordBoxes(stripComments(readFileSync(file, 'utf8')));
      if (hits.length) offenders.push(`${rel}: ${hits.join(' · ')}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `A password box without the eye. Use <PasswordField> from ${HOME} (it passes every input prop through), or add the file to ALLOWED with its reason.`,
  );
});

test('every ALLOWED entry still exists and still needs it', () => {
  for (const [rel, why] of ALLOWED) {
    assert.ok(why.trim().length > 10, `${rel}: give the reason`);
    assert.ok(rawPasswordBoxes(read(rel)).length > 0, `${rel}: no raw password box left — drop it from ALLOWED`);
  }
});

test('the component keeps its promises', () => {
  const code = read(HOME);
  assert.match(code, /import \{[^}]*\bEye\b[^}]*\bEyeOff\b[^}]*\} from 'lucide-react'/, 'lucide Eye + EyeOff');
  assert.match(code, /revealed \? EyeOff : Eye/, 'Eye while hidden, EyeOff while shown');
  assert.match(code, /revealed \? 'Hide password' : 'Show password'/, 'the two words');
  assert.match(code, /type=\{revealed \? 'text' : 'password'\}/, 'only the type flips');
  assert.match(code, /aria-label=\{label\}/);
  assert.match(code, /aria-pressed=\{revealed\}/);
  assert.match(code, /aria-controls=\{id\}/);
  assert.match(code, /type="button"/, 'the eye must never submit the form');
  assert.match(code, /\bh-11\b[^"]*\bw-11\b|\bw-11\b[^"]*\bh-11\b/, '44 px tap target');
  assert.match(code, /onMouseDown=\{\(e\) => e\.preventDefault\(\)\}/, 'a press keeps focus in the box');
  assert.match(code, /setSelectionRange\(/, 'the caret is put back');
  assert.match(code, /addEventListener\('submit', mask/, 'masks again on submit');
  assert.match(code, /'pageshow'/, 'masks again on a back/forward restore');
  assert.doesNotMatch(code, /\.value\s*=(?!=)/, 'the eye never writes the value');
  assert.match(code, /\{\.\.\.input\}/, 'every input prop passes through');
});

/** The user-facing doors, each with the password-manager hint it must keep. */
const DOORS: Array<[string, string[]]> = [
  ['app/login/_components/sign-in-card.tsx', ['current-password']],
  ['app/signup/page.tsx', ['new-password']],
  ['app/open-shop/_components/open-shop-wizard.tsx', ['new-password']],
  ['app/reset-password/page.tsx', ['new-password', 'new-password']],
  ['app/join/[eventId]/set-password/page.tsx', ['new-password']],
  ['app/dashboard/(account)/profile/page.tsx', ['current-password', 'new-password', 'new-password']],
  ['app/onboarding/wedding/_components/onboarding-shell.tsx', ['new-password']],
];

test('every password door uses PasswordField and keeps its autocomplete hint', () => {
  for (const [rel, hints] of DOORS) {
    const code = read(rel);
    assert.match(code, /import \{ PasswordField \} from '@\/app\/_components\/password-field'/, `${rel}: import PasswordField`);
    const tags = [...code.matchAll(/<PasswordField\b[\s\S]*?\/>/g)].map((m) => m[0]);
    assert.equal(tags.length, hints.length, `${rel}: expected ${hints.length} password field(s), found ${tags.length}`);
    tags.forEach((tag, i) => {
      assert.match(tag, new RegExp(`autoComplete="${hints[i]}"`), `${rel} field ${i + 1}: keep autoComplete="${hints[i]}"`);
    });
  }
});
