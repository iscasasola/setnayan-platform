/**
 * Admin FOCUS | FULL holds its approved rulings (owner 14 Nov 2026, DECISION_LOG "ADMIN FOCUS | FULL — APPROVED (v6)" +
 * "THE SIX CALLS ANSWERED"; prototype M2EWM32A9Y9LrJBsYXgagq).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { focusKindOf, needsYouLine, readAdminMode } from '@/lib/admin/admin-mode';
import { ADMIN_AVATAR_ROWS } from '@/lib/admin/admin-tabs';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

test('(1) admin opens in Focus — only an explicit "full" is Full', () => {
  assert.equal(readAdminMode(undefined), 'focus');
  assert.equal(readAdminMode(''), 'focus');
  assert.equal(readAdminMode('FULL'), 'focus');
  assert.equal(readAdminMode('full'), 'full');
});

test('(1) the toggle sits in the top bar: icons only on a phone, the word from the dock point up', () => {
  const layout = read('app/admin/layout.tsx');
  const topBar = layout.slice(layout.indexOf('const topBar = ('), layout.indexOf('const termsAsk'));
  assert.match(topBar, /<AdminModeToggle mode=\{mode\} \/>/, 'the toggle left the top bar');
  const toggle = read('app/admin/_components/admin-mode-toggle.tsx');
  assert.match(toggle, /<span className="hidden lg:inline">\{label\}<\/span>/, 'the word shows on a phone, or never');
  assert.match(toggle, /aria-checked=\{on\}/, 'the filled half no longer says which mode you are in');
});

test('(2) Focus has no bottom nav and no thumb row; Full keeps the shipped five tabs', () => {
  const layout = read('app/admin/layout.tsx');
  assert.match(layout, /mode === 'full' \? \(\s*<AdminBottomNav/, 'the bottom nav shows in Focus, or never');
  assert.match(layout, /mode === 'full' \? <AdminThumbRow \/> : null/, 'the thumb row shows in Focus');
  const home = read('app/admin/_components/focus-home.tsx');
  assert.doesNotMatch(home, /View all pages/, '"View all pages" is back (removed by the ruling)');
  assert.match(home, /<AdminAskPill place="thumb" \/>/, 'the phone lost its thumb-zone ask box');
  assert.match(home, /<AdminAskPill place="top" \/>/, 'the computer lost its top ask box');
  assert.match(home, /<RequestCardView card=\{opened\.item\.card\}/, 'Focus no longer opens the approved request card');
});

test('(2) the decide list counts what Work counts and never calls an unread list clear', () => {
  assert.equal(needsYouLine(0), 'Nothing needs you');
  assert.equal(needsYouLine(1), '1 thing needs you');
  assert.equal(needsYouLine(5), '5 things need you');
  assert.equal(focusKindOf('email-bounces'), 'fix');
  assert.equal(focusKindOf('payments'), 'reply');
  const home = read('app/admin/_components/focus-home.tsx');
  assert.match(home, /getAdminQueueDigest\(\)/);
  assert.match(home, /BASE_ROWS\.map/);
  assert.match(home, /this is not an\s+all-clear/, 'an unread queue is folded into the count silently');
});

test('(3)(4) "What can I ask?" is the ? of the pill, the last suggestion, and an avatar row; the field docks at the bottom', () => {
  const pill = read('app/admin/_components/admin-ask-pill.tsx');
  assert.match(pill, /href="\/admin\/ask"[\s\S]*?\?\s*<\/Link>/, 'the ? left the pill');
  assert.match(pill, /dock: place === 'thumb' \? 'bottom' : 'top'/, 'the phone pill no longer docks the panel at the bottom');
  const palette = read('app/admin/_components/admin-command-palette.tsx');
  assert.match(palette, /flex flex-col-reverse/, 'a bottom-docked panel no longer keeps the field below its suggestions');
  assert.match(palette, /href="\/admin\/ask"[\s\S]{0,400}What can I ask\?/, '"What can I ask?" is no longer a suggestion');
  assert.ok(ADMIN_AVATAR_ROWS.some((r) => r.href === '/admin/ask'), '"What can I ask?" left the avatar menu');
});

test('the cheat sheet promises only what the box does today, and Download is on it', () => {
  const sheet = read('app/admin/ask/page.tsx');
  assert.match(sheet, /<PrintButton \/>/, 'Download left the cheat sheet');
  for (const unbuilt of [/tell me about/i, /Acacia|address/i, /progress/i]) {
    assert.doesNotMatch(sheet, unbuilt, `the sheet promises ${unbuilt} — the box cannot answer it yet`);
  }
});
