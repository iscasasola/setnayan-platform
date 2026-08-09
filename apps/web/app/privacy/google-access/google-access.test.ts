/**
 * GUARD — the public "what connecting Google does" page cannot describe a scope
 * we do not request, and cannot go stale when a scope changes.
 *
 * WHY THIS EXISTS. This page is submitted to Google's OAuth verification review.
 * If it names a permission string that no longer matches the one the code asks
 * for, the submission is refused and every resubmission costs days. The two
 * scope constants are maintained for their own reasons — they are what the
 * authorize URLs are built from — so this is not two hand-typed lists agreeing
 * with each other.
 *
 * It also pins the two claims that would be UNTRUE if the code changed under
 * them: that Setnayan never sends video, and that the Drive permission is
 * limited to files Setnayan created.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PAGE = path.join(import.meta.dirname, 'page.tsx');
const WEB_ROOT = path.join(import.meta.dirname, '..', '..', '..');

/**
 * The scope constants, read as TEXT out of the modules that declare them.
 * Both modules open with `import 'server-only'`, which throws the moment a node
 * test requires them, so importing the symbols is not available here. Reading
 * the real declaration is still reading the thing the authorize URLs are built
 * from — it is not a second hand-typed list.
 */
function declaredScopes(): string[] {
  const files = [
    path.join(WEB_ROOT, 'lib', 'panood-youtube.ts'),
    path.join(WEB_ROOT, 'lib', 'papic-drive.ts'),
  ];
  const out: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const decl = /export const (?:YOUTUBE|DRIVE)_OAUTH_SCOPES\s*=\s*\[([\s\S]*?)\]/.exec(src);
    assert.ok(
      decl,
      `Could not find the *_OAUTH_SCOPES array in ${path.basename(file)}. It is what ` +
        'the consent URL is built from; if it moved, move this guard with it.',
    );
    const scopes = decl[1]!.match(/https:\/\/www\.googleapis\.com\/auth\/[\w.]+/g) ?? [];
    assert.ok(
      scopes.length > 0,
      `${path.basename(file)} declares an *_OAUTH_SCOPES array with no scope in it.`,
    );
    out.push(...scopes);
  }
  return out;
}

/** Comment-stripped source: the page's own docblock quotes both scope strings. */
function renderedSource(): string {
  return readFileSync(PAGE, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

test('every scope the code requests is named on the public page', () => {
  const src = renderedSource();
  for (const scope of declaredScopes()) {
    assert.ok(
      src.includes(scope),
      `/privacy/google-access does not name the scope "${scope}", which the code ` +
        'actually requests at consent time. Google reviews the homepage/disclosure ' +
        'against the scopes on the consent screen; an unnamed scope is a refusal.',
    );
  }
});

test('the page names no Google scope the code does not request', () => {
  const src = renderedSource();
  const declared = new Set<string>(declaredScopes());
  const named = src.match(/https:\/\/www\.googleapis\.com\/auth\/[\w.]+/g) ?? [];
  for (const scope of named) {
    assert.ok(
      declared.has(scope),
      `/privacy/google-access claims Setnayan asks for "${scope}", but no OAuth ` +
        'constant requests it. Promising a permission we do not hold — or naming ' +
        'a retired one such as auth/youtube.upload, dropped 2026-07-25 — is a false ' +
        'statement in a document handed to a regulator-facing reviewer.',
    );
  }
});

test('the two load-bearing factual claims are still on the page', () => {
  const src = renderedSource();

  assert.match(
    src,
    /does not send the video itself/,
    'The page must keep saying Setnayan does not send the video itself. Setnayan ' +
      'never transmits a video byte — the couple\'s own encoder pushes to the ' +
      'stream key — and Google\'s sensitive-scope review asks exactly this.',
  );
  assert.match(
    src,
    /restricts Setnayan to\s+files and folders the Setnayan app itself\s+created/,
    'The page must keep the "only files and folders the Setnayan app itself ' +
      'created" limit on the Drive permission. That limit is the whole reason ' +
      'drive.file is safe to grant, and it is the sentence a reviewer looks for.',
  );
});
