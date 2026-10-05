/**
 * suppliers-keeps-the-shell-bar.test.ts — THE SUPPLIERS TAB MAY NOT HIDE THE
 * APP'S ONLY TOP BAR, AND MAY NOT CLAW BACK THE SPACE IT SITS IN.
 *
 * Owner, live on maria-and-jose at 375 px (2026-10-05): the top bar — menu ·
 * search · messages · bell · account — was on Home, Guests, Hub and More, and
 * missing on Suppliers. `ServicesTakeover` injected
 * `@media (max-width:1023px){.shell-topbar{display:none}}` from a 2026-06-09
 * review, written when this page was a full-screen "focus mode". It became a
 * plain tab of the bottom bar; the hide stayed. Guests had the identical
 * defect and lost it on 2026-08-21 (`guests-keeps-the-shell-bar.test.ts`) —
 * this is that guard, for the tab next door.
 *
 * Source scan of every Suppliers component, comment-stripped: the hazard is a
 * rule that is PRESENT, and the files' own comments name the old rule.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const DIR = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors');
const code = (...p: string[]) => stripComments(readFileSync(join(DIR, ...p), 'utf8'));

test('no Suppliers file hides the shared top bar', () => {
  const files = [
    'page.tsx',
    ...readdirSync(join(DIR, '_components'))
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => join('_components', f)),
  ];
  assert.ok(files.includes(join('_components', 'services-takeover.tsx')), 'the takeover moved — re-anchor');
  const offenders = files.filter((f) => /shell-topbar\s*\{[^}]*display\s*:\s*none/.test(code(f)));
  assert.deepEqual(
    offenders,
    [],
    'A Suppliers file hides `.shell-topbar` again. That class is the app\'s ONLY ' +
      'top bar — menu, search, messages, the bell and the account switcher.',
  );
});

test('the takeover does not pull itself up under the bar or pad for the notch', () => {
  const src = code('_components', 'services-takeover.tsx');
  const open = /<section\b[^>]*data-budget-build-takeover=""[^>]*>/.exec(src)?.[0] ?? '';
  assert.ok(open, 'the takeover <section> is gone — re-anchor on its data attribute');
  assert.doesNotMatch(
    open,
    /-mt-6/,
    'The section cancels the layout\'s top padding again. That existed only to fill ' +
      'the hole the hidden bar left; with the bar there it pulls the page under it.',
  );
  assert.doesNotMatch(open, /safe-area-inset-top/, 'The section reserves the notch itself; the shared bar owns it.');
});

test('a bench doorway lands its row BELOW the bar on a phone, by reading the bar\'s height', () => {
  const src = code('_components', 'shortlist-categories.tsx');
  const phone = /\.slcat \[id\^="slfold-"\],\.slcat \[id\^="sltile-"\]\{scroll-margin-top:([^}]*)\}/.exec(src);
  assert.ok(phone, 'the bench anchors lost their landing offset');
  assert.match(phone[1]!, /var\(--fd-bar/, 'the phone anchor offset no longer clears the shared top bar');
});
