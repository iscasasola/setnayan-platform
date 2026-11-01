import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { topBarSearch } from './shell-page-search';

/**
 * 🔍 A SIGNED-IN TOP BAR DRAWS NO SEARCH BOX — whoever mounts the shell (walk 2026-11-01).
 *
 * The walk found the stranger's marketplace field squeezed to ~74 px ("Sup") in the signed-in bar of four labs and in
 * iPhone Safari. The product hosts each passed `false`; the shell's own default was the signed-out box, so every
 * mount that did not repeat the line drew it. The rule now lives in `topBarSearch`, and the shell reads it.
 *
 * Property, not phrasing: (1) the rule's four arms, (2) the shell resolves its search THROUGH the rule with the
 * account's signed-in flag — not the raw prop.
 */

const BOX = 'a-search-control';

test('signed in, nothing handed in → no search box', () => {
  assert.equal(topBarSearch({ handed: undefined, signedIn: true, pageHasOwnSearch: false }), false);
});

test('signed out, nothing handed in → the shell’s marketplace box (undefined)', () => {
  assert.equal(topBarSearch({ handed: undefined, signedIn: false, pageHasOwnSearch: false }), undefined);
});

test('a handed-in search wins, signed in or out (the console’s own box)', () => {
  assert.equal(topBarSearch({ handed: BOX, signedIn: true, pageHasOwnSearch: false }), BOX);
  assert.equal(topBarSearch({ handed: BOX, signedIn: false, pageHasOwnSearch: false }), BOX);
});

test('a page with its own search row → no box, whatever was handed in', () => {
  assert.equal(topBarSearch({ handed: BOX, signedIn: false, pageHasOwnSearch: true }), false);
  assert.equal(topBarSearch({ handed: undefined, signedIn: false, pageHasOwnSearch: true }), false);
});

test('FrontDoorShell resolves its search through topBarSearch with the account’s signed-in flag', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = stripComments(readFileSync(join(here, 'front-door-shell.tsx'), 'utf8'));
  const decl = src.match(/const search = ([\s\S]*?);\n/);
  assert.ok(decl, 'FrontDoorShell must declare `const search = …` (the one place the bar decides its search)');
  assert.match(decl[1]!, /topBarSearch\(/, 'the bar’s search must come from topBarSearch, not the raw prop');
  assert.match(decl[1]!, /signedIn:\s*account\.signedIn/, 'topBarSearch must be told whether the viewer is signed in');
});
