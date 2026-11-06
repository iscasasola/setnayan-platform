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

/**
 * The user-facing doors, each field with the password-manager hint it must keep
 * and whether it is a box where the person CREATES a password (`new` → it must
 * carry `mode="new"`: the strength bar + three rules, owner 2026-11-06). A
 * "type it once more" confirm box is `same` (no second bar); sign-in is never new.
 */
type Kind = 'new' | 'same' | 'current';
const DOORS: Array<[string, Array<[string, Kind]>]> = [
  ['app/login/_components/sign-in-card.tsx', [['current-password', 'current']]],
  ['app/signup/page.tsx', [['new-password', 'new']]],
  ['app/open-shop/_components/open-shop-wizard.tsx', [['new-password', 'new']]],
  ['app/reset-password/page.tsx', [['new-password', 'new'], ['new-password', 'same']]],
  ['app/join/[eventId]/set-password/page.tsx', [['new-password', 'new']]],
  [
    'app/dashboard/(account)/profile/page.tsx',
    [['current-password', 'current'], ['new-password', 'new'], ['new-password', 'same']],
  ],
  ['app/onboarding/wedding/_components/onboarding-shell.tsx', [['new-password', 'new']]],
];

const tagsIn = (code: string) => [...code.matchAll(/<PasswordField\b[\s\S]*?\/>/g)].map((m) => m[0]);

test('every password door uses PasswordField and keeps its autocomplete hint', () => {
  for (const [rel, fields] of DOORS) {
    const code = read(rel);
    assert.match(code, /import \{ PasswordField \} from '@\/app\/_components\/password-field'/, `${rel}: import PasswordField`);
    const tags = tagsIn(code);
    assert.equal(tags.length, fields.length, `${rel}: expected ${fields.length} password field(s), found ${tags.length}`);
    tags.forEach((tag, i) => {
      const [hint] = fields[i]!;
      assert.match(tag, new RegExp(`autoComplete="${hint}"`), `${rel} field ${i + 1}: keep autoComplete="${hint}"`);
    });
  }
});

test('every box where a person CREATES a password carries mode="new" — and no other box does', () => {
  for (const [rel, fields] of DOORS) {
    tagsIn(read(rel)).forEach((tag, i) => {
      const [, kind] = fields[i]!;
      if (kind === 'new') {
        assert.match(tag, /\bmode="new"/, `${rel} field ${i + 1}: a create-password box shows the strength bar — add mode="new"`);
      } else {
        assert.doesNotMatch(
          tag,
          /\bmode=/,
          `${rel} field ${i + 1}: ${kind === 'current' ? 'sign-in / current-password boxes never judge strength' : 'a confirm box repeats the first one — one bar per form'}`,
        );
      }
    });
  }
});

test('no create-password box anywhere in the app is missing from DOORS', () => {
  // A NEW door (a new-password box in a file DOORS does not name) would ship
  // without the bar and without anyone noticing. Name it above instead.
  const named = new Set(DOORS.map(([rel]) => rel));
  const strays: string[] = [];
  for (const root of ['app', 'components']) {
    for (const file of sourceFiles(join(WEB, root))) {
      const rel = relative(WEB, file);
      if (rel === HOME || named.has(rel)) continue;
      for (const tag of tagsIn(stripComments(readFileSync(file, 'utf8')))) {
        if (/autoComplete="new-password"|\bmode="new"/.test(tag)) strays.push(rel);
      }
    }
  }
  assert.deepEqual(strays, [], 'a create-password box outside DOORS — add it there with its kinds');
});

test('mode="new" keeps its promises: bar, three rules, server-answered leak rule, no forced composition', () => {
  const code = read(HOME);
  assert.match(code, /mode\?: 'new'/, 'the prop');
  assert.match(code, /assessNewPassword\(/, 'the bar reads lib/password-strength.ts — one judgement');
  assert.match(code, /8 or more characters/);
  assert.match(code, /Not your name or email/);
  assert.match(code, /Not a known leaked password/);
  assert.match(code, /checked when you continue/, 'the leak rule says WHEN it is checked');
  assert.match(code, /aria-live="polite"/, 'the level is announced');
  assert.match(code, /'aria-describedby'/, 'the box points at its rules');
  // The refusal outlives the URL: <ToastFromParams> strips `?error=` right after
  // load, so the field must not forget the refusal when `leaked` drops.
  assert.doesNotMatch(code, /setLeakedValue\(\s*leaked\s*\?|setLeakedValue\(null\)/, 'the leak refusal is cleared only by a new value');
  // The field never phones the leak service itself — the server action does.
  assert.doesNotMatch(code, /pwnedpasswords|leaked-password'|fetch\(/, 'the leak check stays on the server');
  // No composition rule: no "uppercase", "symbol" or "number" requirement copy.
  assert.doesNotMatch(code, /\b(uppercase|capital letter|a symbol|special character)\b/i, 'no forced symbols or capitals');
});
