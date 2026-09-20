/**
 * The setup sheet must reopen after a server action. Prod, 2026-09-20: redirect()
 * from a server action DROPPED the `#screens` hash, so after "Add a screen" the
 * sheet stayed shut and the new screen's pairing code was hidden.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sheetAnchorFrom, SHEET_PARAM } from './setup-sheet';

test('?sheet=<anchor> opens the sheet — the form that survives a server-action redirect', () => {
  assert.equal(sheetAnchorFrom('', `?screen_added=1&${SHEET_PARAM}=screens`), 'screens');
});

test('#<anchor> still opens it, and wins over the query', () => {
  assert.equal(sheetAnchorFrom('#watch', `?${SHEET_PARAM}=screens`), 'watch');
});

test('an unknown anchor opens nothing', () => {
  assert.equal(sheetAnchorFrom('#nope', `?${SHEET_PARAM}=evil`), null);
  assert.equal(sheetAnchorFrom('', ''), null);
});

test('every screen action redirects with ?sheet=screens, never a bare #hash', () => {
  const src = readFileSync(join(__dirname, '..', 'screens-actions.ts'), 'utf8');
  const helper = src.match(/const SCREENS = [^\n]+/)?.[0] ?? '';
  assert.ok(helper.length > 0, 'precondition: found the SCREENS redirect helper');
  assert.match(helper, /sheet=screens/);
  assert.doesNotMatch(helper, /#screens/);
  const redirects = src.match(/redirect\(SCREENS\(/g) ?? [];
  assert.ok(redirects.length >= 6, `every screen action goes through the helper (found ${redirects.length})`);
});
