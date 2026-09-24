/**
 * the-upload-names-its-button.test.ts — every upload that feeds a form says
 * which button will save it, in that button's own words.
 *
 * THE DEFECT (owner, 2026-09-23, /open-shop step 1, logo just uploaded):
 * "asking me to press save when there is no save." The chip read "NOT SAVED
 * YET — PRESS SAVE BELOW" and the button on that step is Continue. The
 * sentence was written for /dashboard/profile and then rendered, verbatim, on
 * every one of the widget's form-bound mounts — the You card (Done), the
 * receipt log (Log), the dispute (File flag), the checkout (Submit request).
 *
 * THE MECHANISM. `FileUploadFormBinding` makes `unsavedHint` REQUIRED the
 * moment `name` is passed, so tsc refuses a new form-bound mount with no
 * hint. This test is the part tsc cannot do: it walks the tree so the count is
 * printed, it refuses a hint that repeats the widget's own claim, and it
 * refuses the old one-size sentence from ever returning to the widget.
 *
 * 🛡 Sabotage watched red: a fresh `name=` mount with no `unsavedHint` (tsc
 * AND this file); `unsavedHint=""`; the widget's literal restored to
 * "press Save below".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { unsavedTail } from '@/lib/upload-unsaved-line';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..');
const WIDGET = resolve(HERE, 'file-upload.tsx');

type Mount = { file: string; line: number; block: string; tag: string };

/** Every `<FileUpload` / `<ShowcaseMediaFields` mount in app/ and lib/, as its JSX block. */
function mounts(): Mount[] {
  const out: Mount[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx$/.test(entry) && full !== WIDGET && !/showcase-media-fields\.tsx$/.test(full) === false) out.push(...scan(full));
      else if (/\.tsx$/.test(entry) && full !== WIDGET) out.push(...scan(full));
    }
  };
  const scan = (full: string): Mount[] => {
    const src = stripComments(readFileSync(full, 'utf8'));
    const found: Mount[] = [];
    const re = /<(FileUpload|ShowcaseMediaFields)\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      // the block runs to the first `/>` or `>` that closes the opening tag
      let depth = 0;
      let i = m.index;
      for (; i < src.length; i++) {
        const c = src[i];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '>' && depth === 0) break;
      }
      const block = src.slice(m.index, i + 1);
      const line = src.slice(0, m.index).split('\n').length;
      found.push({ file: relative(WEB, full), line, block, tag: m[1] ?? 'FileUpload' });
    }
    return found;
  };
  walk(resolve(WEB, 'app'));
  walk(resolve(WEB, 'lib'));
  // de-dupe (the walk's two branches above are equivalent; kept simple)
  const seen = new Set<string>();
  return out.filter((x) => {
    const k = `${x.file}:${x.line}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const ALL = mounts();
const BOUND = ALL.filter((m) => /\bname=/.test(m.block) || m.tag === 'ShowcaseMediaFields');

test(`every form-bound mount names its button (${BOUND.length} of ${ALL.length} mounts are form-bound)`, () => {
  assert.ok(ALL.length >= 30, `expected the widget to be mounted across the tree, found ${ALL.length} — is the walk broken?`);
  assert.ok(BOUND.length >= 30, `expected ≥30 form-bound mounts, found ${BOUND.length}`);
  const missing = BOUND.filter((m) => !/\bunsavedHint=/.test(m.block));
  assert.deepEqual(
    missing.map((m) => `${m.file}:${m.line}`),
    [],
    'a mount passes `name` (it feeds a form) without saying which button saves it — the widget would have to guess, and it guessed "Save" for a Continue button once already',
  );
  const unbound = ALL.filter((m) => m.tag === 'FileUpload' && !/\bname=/.test(m.block) && /\bunsavedHint=/.test(m.block));
  assert.deepEqual(unbound.map((m) => `${m.file}:${m.line}`), [], 'a hint on a widget that feeds no form describes nothing');
});

test('a hint is the NEXT STEP, never the claim — and never empty', () => {
  for (const m of BOUND) {
    const lit = /\bunsavedHint="([^"]*)"/.exec(m.block);
    if (!lit) continue; // {null} or a threaded {unsavedHint}
    const tail = lit[1] ?? '';
    assert.notEqual(tail.trim(), '', `${m.file}:${m.line} — an empty hint`);
    assert.doesNotMatch(tail, /^\s*not saved yet/i, `${m.file}:${m.line} — the widget already says "Not saved yet"; the hint must not repeat it`);
    assert.equal(unsavedTail(tail), tail.trim(), `${m.file}:${m.line} — the pure tail rule must pass this hint through unchanged`);
  }
});

test('a silent mount ({null}) is one that saves the upload itself, on change', () => {
  // The three that pass null all call a save inside onChange (verification docs,
  // verification pairs, the story cover). Read, not assumed: the block must
  // carry an onChange, and the file must call a save/transition in it.
  for (const m of BOUND.filter((x) => /\bunsavedHint=\{null\}/.test(x.block))) {
    assert.match(m.block, /\bonChange=/, `${m.file}:${m.line} passes null but has no onChange — nothing saves this upload, so it is NOT saved and must say so`);
    const src = stripComments(readFileSync(resolve(WEB, m.file), 'utf8'));
    assert.match(src, /startTransition\(|\bsave\(/, `${m.file} — a null hint promises the parent saves on its own; no transition or save() found`);
  }
});

test('🔴 the widget itself: the binding is required by type and the one-size sentence is gone', () => {
  const src = stripComments(readFileSync(WIDGET, 'utf8'));
  assert.match(src, /\{ name: string; unsavedHint: string \| null \}/, 'a `name` must REQUIRE `unsavedHint` — that is what makes tsc the first guard');
  assert.match(src, /\{ name\?: undefined; unsavedHint\?: undefined \}/, 'and a widget with no name must refuse a hint');
  assert.match(src, /Not saved yet — \{unsavedTail\(unsavedHint\)\}/, 'the widget prints its own claim and the caller’s tail through the pure rule');
  assert.doesNotMatch(src, /press Save below/, 'the sentence written for /dashboard/profile is back in the widget — it will be wrong on every page whose button is not Save');
  assert.match(src, /unsavedHint === null \? null :/, 'a null hint must render NOTHING, not the claim with an empty tail');
});
