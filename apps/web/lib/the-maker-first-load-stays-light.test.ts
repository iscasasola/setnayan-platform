/**
 * GUARD: two kinds of code a signed-in event page never needs on its first tap stay out of the event
 * layout's first load, and so out of the Event Hub Maker's (`scripts/check-maker-js-budget.mjs`).
 *
 * Measured 2026-11-26 on main f14a1c387 (next build + the budget script): the Maker sat at 507.8 KB against
 * its 508 KB ceiling, flipping pass/fail on unrelated PRs. Two pieces of its event layout chunk did no work there:
 *
 *   1. THE `buffer` POLYFILL (~7 KB gz). `lib/print-mark.ts` is the logo layers' matrix maths, imported in
 *      the browser through `lib/logo-layers.ts`; one `Buffer.from(…, 'base64')` in its server-side raster
 *      helper made webpack ship the polyfill to every event page. It decodes with `atob` now.
 *   2. THE SIGN-IN PANEL (the form, the common-password list, the door words: ~7 KB gz). `FrontDoorShell`
 *      wraps every signed-in page and owns `useSignInPanel`, which imported the panel statically. It
 *      loads on the first press of Sign in now (`loadSignInHerePanel`).
 *
 * Source-level on purpose: the unit suite has no build. The budget script is the measured guard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · lib/print-mark.ts (also a browser module) never names Buffer', () => {
  assert.doesNotMatch(code('lib/print-mark.ts'), /\bBuffer\b/, 'naming Buffer ships the buffer polyfill to every event page');
});

test('2 · the sign-in panel is its own chunk, fetched when Sign in is pressed', () => {
  const src = code('app/_components/auth/sign-in-here.tsx');
  assert.doesNotMatch(src, /import\s*\{[^}]*\bSignInHerePanel\b[^}]*\}\s*from\s*['"]\.\/sign-in-here-panel['"]/, 'no static import of the panel');
  assert.match(src, /import\(\s*['"]\.\/sign-in-here-panel['"]\s*\)/, 'the panel loads by import()');
});
