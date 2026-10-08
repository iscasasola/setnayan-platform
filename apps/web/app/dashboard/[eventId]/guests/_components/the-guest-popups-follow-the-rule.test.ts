/**
 * the-guest-popups-follow-the-rule.test.ts — STEP 2C of the guest list onto the shared controls.
 *
 * THE CLAIM (owner 2026-10-08, `INTERACTION_RULES.md` § 9, "Anything popped up over the page"): every pop-up the guest list
 * draws is dark and blurred behind it (`.sn-popup-dark`), a tap on the dark closes it, nothing behind it works or scrolls,
 * Escape closes, Tab stays inside, focus comes in and goes back — and it is drawn on <body>, above the app's bottom bar.
 * That is `GuestPopup` (`usePopupBehind`), once. The add-a-guest sheet, quick add, the ticket view, the New QR / Unlink
 * confirm, "Add from your people", the Delete warning and the New-group sheet are drawn by it, mounted only while open;
 * none writes a wash, a blur, a `fixed inset-0` layer, a `Drawer` or the shared `Sheet` of its own.
 *
 * The shared `Sheet` (`app/_components/sheet.tsx`) does NOT follow the rule (its dark is `bg-ink/40 backdrop-blur-sm`, it is
 * drawn inside the page's transformed box and so sits under the bottom bar) — it is listed, not changed here.
 *
 * SABOTAGE (each seen RED, then restored): the dark removed from `GuestPopup` · the Delete warning back on `<Sheet` · a
 * pop-up mounted without its open condition · a hand-made `bg-ink/40` layer back in quick add · quick add's own Escape /
 * scroll lock back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const POPUP = read('guest-popup.tsx');

/** [file, how its pop-up is mounted only while open]. */
const USES: Array<[string, RegExp]> = [
  ['add-guest-sheet.tsx', /if \(!open\) return null;\s*return \(\s*<GuestPopup/],
  ['quick-add-sheet.tsx', /\{open \? \(\s*<GuestPopup/],
  ['guest-ticket-parts.tsx', /\{open && mounted \? \(\s*<GuestPopup/],
  ['guest-ticket-parts.tsx', /\{confirm !== null \? \(\s*<GuestPopup/],
  ['add-from-people-sheet.tsx', /if \(!open\) return null;\s*return \(\s*<GuestPopup/],
  ['guest-delete.tsx', /if \(!open\) return null;\s*return <OpenDeleteGuestSheet/],
  ['guests-screen.tsx', /\{newGroup \? \(\s*<GuestPopup/],
];

test('GuestPopup carries the whole rule: dark + blur, a tap on the dark closes, nothing behind works, on <body>', () => {
  assert.match(POPUP, /usePopupBehind\(\{ root, panel, onClose \}\);/, 'nothing behind is made inert, no scroll lock, no Escape/Tab');
  assert.match(POPUP, /<span aria-hidden className=\{POPUP_DARK\} \/>/, 'no .sn-popup-dark behind the panel');
  assert.match(POPUP, /<button type="button" aria-label="Close" onClick=\{onClose\} className=\{POPUP_SCRIM\} \/>/, 'a tap on the dark does not close it');
  assert.match(POPUP, /role="dialog"\s*aria-modal="true"/, 'the panel is not a modal dialog');
  assert.match(POPUP, /createPortal\([\s\S]*document\.body,?\s*\)/, 'it is not drawn on <body>');
  /* The dark is under the panel and over the scrim: scrim, dark, then panel, in that order. */
  assert.ok(POPUP.indexOf('className={POPUP_SCRIM}') < POPUP.indexOf('className={POPUP_DARK}') && POPUP.indexOf('className={POPUP_DARK}') < POPUP.indexOf('role="dialog"'), 'the layers are out of order');
  assert.doesNotMatch(POPUP, /backdrop-blur|bg-ink\/|useToast/, 'GuestPopup writes a dark of its own');
});

test('every guest-list pop-up is a GuestPopup, mounted only while open', () => {
  for (const [file, mount] of USES) {
    const src = read(file);
    assert.match(src, /from '\.\/guest-popup'/, `${file} does not import the shared pop-up`);
    assert.match(src, mount, `${file}: the pop-up is not mounted only while open (${mount})`);
  }
});

test('none of them draws a layer, wash, blur, Drawer or Sheet of its own', () => {
  const files = ['add-guest-sheet.tsx', 'quick-add-sheet.tsx', 'guest-ticket-parts.tsx', 'add-from-people-sheet.tsx', 'guest-delete.tsx', 'guests-screen.tsx'];
  for (const f of files) {
    const src = read(f);
    assert.doesNotMatch(src, /backdrop-blur-|(?<![:\w-])bg-ink\/(?:[3-9]\d|\[0\.[3-9])/, `${f} writes a wash or blur of its own`);
    assert.doesNotMatch(src, /<Drawer\b|<Sheet\b|overlay-primitives|@\/app\/_components\/sheet/, `${f} is back on the Drawer / shared Sheet`);
    assert.doesNotMatch(src, /className="[^"]*\bfixed inset-0\b/, `${f} draws a full-screen layer of its own`);
  }
  /* …except through GuestPopup's rootClassName. */
  const q = read('quick-add-sheet.tsx');
  assert.doesNotMatch(q, /document\.body\.style\.overflow|addEventListener\('keydown'/, 'quick add runs its own scroll lock / Escape again');
});

test('the Delete warning (any width) rises above the bottom bar with the safe-area padding', () => {
  const del = read('guest-delete.tsx');
  assert.match(del, /rootClassName="fixed inset-0 z-\[96\] flex items-end justify-center lg:items-center"/);
  assert.match(del, /pb-\[max\(env\(safe-area-inset-bottom\),16px\)\]/, 'Cancel can sit under the home indicator');
});

test('the ticket pop-up keeps its marker and its Save ticket', () => {
  const t = read('guest-ticket-parts.tsx');
  assert.match(t, /rootData=\{\{ 'data-guest-ticket-view': '' \}\}/);
  assert.match(t, /Save ticket/);
});

test('in the Delete warning the sentence keeps its gap above Delete (a box, not a `contents` span, carries the mark)', () => {
  const del = read('guest-delete.tsx');
  const warning = del.slice(del.indexOf('export function DeleteGuestWarning('));
  assert.match(warning, /<div data-guest-delete-confirm="">\s*<ActionButton/, 'the Delete button sits in a `contents` span — space-y gives it no gap');
  assert.doesNotMatch(warning, /className="contents"/, 'a `contents` wrapper in the spaced warning has no margin box');
  assert.match(warning, /<div className="space-y-4 p-5" data-guest-delete-warning="">/, 'the warning lost its one gap');
});
