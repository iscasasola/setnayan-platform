/**
 * every-stages-popup-follows-the-rule.test.ts — THE STAGES PANEL'S OTHER POP-UPS FOLLOW THE POP-UP RULE.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9): *"when there is a pop up. the rest of the screen darkens (except
 * for when there is preview) … The darkened area will be blurred and nothing behind it will work. pressing on the
 * dark part removes the pop up. the background will not be scrollable when darkened blurred"*.
 *
 * `MakerSheet` carries the rule (`a-popup-darkens-what-is-behind`). Three pop-ups the panel opens could not be that
 * sheet; each follows the rule with the SAME pieces — one dark (`.sn-popup-dark`), `inertBehind`, `useModalA11y` —
 * and none with a backdrop of its own:
 *   (1) THE TWO BEHAVIOURS, ONCE — `usePopupBehind`: every other branch inert (and put back), the app's one modal
 *       contract; no listener, lock or timer of its own.
 *   (2) THE COLOUR SHEET WHERE THERE IS NO MAKER SHEET (a computer; the Mood Board, the Logo) — rendered: one button
 *       under the dark closes it, the dark takes no tap, a modal dialog no taller than the screen.
 *   (3) "A SCENE OF YOUR OWN" — the shipped template picker with the dark put under its own close button, the page
 *       behind out of reach; its first-load file is untouched.
 *   (4) THE APPLY SHEET — rendered: its backdrop is the element the stylesheet's dark names (`div:has(> […])`), in
 *       every rule of the dark, outweighing the sheet's own wash — and its first-load file gains no import.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { POPUP_DARK, POPUP_SCRIM } from './use-popup-behind';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const D = 'app/dashboard/[eventId]';
const CSS = read('app/globals.css');

test('(1) the two behaviours come from the app’s own pieces — every other branch inert and put back, the one modal contract — and nothing new', () => {
  const src = read('lib/use-popup-behind.ts');
  assert.match(src, /useLayoutEffect\(\(\) => \{\s*const el = root\.current;\s*return el \? inertBehind\(el\) : undefined;\s*\}, \[root\]\);/, 'the page behind is not put out of reach — or is never put back');
  assert.match(src, /useModalA11y\(\{ open: true, onClose, containerRef: panel \}\);/, 'no scroll lock / Escape / focus trap');
  assert.doesNotMatch(src, /addEventListener|overflow|setTimeout|setInterval|querySelector/, 'a second mechanism beside the app’s two');
  assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]), ['react', './popup-behind', './use-modal-a11y']);
  /* The dark is the ONE look and takes no tap; the button under it is the whole screen. */
  assert.deepEqual(POPUP_DARK.split(' '), ['sn-popup-dark', 'pointer-events-none', 'absolute', 'inset-0']);
  for (const c of ['absolute', 'inset-0', 'h-full', 'w-full']) assert.ok(POPUP_SCRIM.split(' ').includes(c));
  assert.doesNotMatch(POPUP_DARK + POPUP_SCRIM, /\bbg-|backdrop-/, 'a backdrop colour or blur of its own');
});

test('(2) the colour sheet outside the Maker’s sheet: one button under the dark closes it, the dark takes no tap, a modal dialog no taller than the screen', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StudioPopup } = await import(`../${D}/studio/mood-board/_components/colour-picker-sheet`);
  const html = renderToStaticMarkup(React.createElement(StudioPopup, { label: 'Colour', onClose: () => {} }, React.createElement('p', null, 'swatches')));
  assert.match(html, /^<div class="fixed inset-0 z-\[95\] [^"]*" data-studio-sheet="">/);
  /* In order: the close button (the whole screen), the dark over it (no tap), the panel over both. */
  assert.match(
    html,
    /<button type="button" aria-label="Close" data-studio-sheet-scrim="" class="absolute inset-0 h-full w-full cursor-default touch-none"><\/button><span aria-hidden="true" class="sn-popup-dark pointer-events-none absolute inset-0"><\/span><div role="dialog" aria-modal="true" aria-label="Colour" tabindex="-1" class="relative [^"]*">/,
    'the fallback sheet is not: a close button, the one dark, a modal dialog',
  );
  assert.match(html, /max-h-\[80dvh\]/, 'the sheet can be taller than the screen');
  assert.doesNotMatch(html, /bg-ink\/\d+/, 'a hand-made wash is back');
  const src = read(`${D}/studio/mood-board/_components/colour-picker-sheet.tsx`);
  const popup = src.slice(src.indexOf('export function StudioPopup('));
  assert.match(popup, /usePopupBehind\(\{ root, panel, onClose \}\);/);
  assert.match(popup, /<div ref=\{root\} className="fixed inset-0[^"]*" data-studio-sheet="">/);
  assert.match(popup, /<button type="button" aria-label="Close" data-studio-sheet-scrim="" onClick=\{onClose\} className=\{POPUP_SCRIM\} \/>/, 'a tap on the dark does not close it');
  assert.match(popup, /<div\s+ref=\{panel\}\s+role="dialog"\s+aria-modal="true"/);
  /* Inside the Maker on a phone it is still the Maker's one sheet; everywhere else, this one — never a third. */
  const sheet = src.slice(src.indexOf('export function StudioSheet('), src.indexOf('export function StudioPopup('));
  assert.match(sheet, /if \(sheet && pickOpensAsSheet\(true, wide\)\) return <>\{sheet\(\{ label, onClose, children \}\)\}<\/>;/);
  assert.match(sheet, /return createPortal\(\s*<StudioPopup label=\{label\} onClose=\{onClose\}>/);
  assert.doesNotMatch(sheet, /addEventListener\('keydown'/, 'a second Escape listener beside the modal contract’s');
});

test('(3) “A scene of your own”: the dark sits under the picker’s own close button, the page behind is out of reach — and the picker’s first-load file is untouched', () => {
  const edits = read(`${D}/launch/_components/add-part-sheet.tsx`);
  const wrap = edits.slice(edits.indexOf('function OwnScenePicker('), edits.indexOf('function AddPartSheet('));
  assert.ok(wrap.length > 200, 'anti-vacuity: the wrap was not found');
  assert.match(wrap, /usePopupBehind\(\{ root, panel: root, onClose \}\);/, 'the page behind the picker still works');
  const dark = /<span aria-hidden data-part-own-picker-dark="" className="sn-popup-dark pointer-events-none fixed inset-0 z-\[(\d+)\]" \/>/.exec(wrap);
  assert.ok(dark, 'the picker has no dark behind it (or a wash of its own)');
  /* THE ORDER, from the numbers each file draws: the part's frame < the dark < the picker's close button < its box. */
  const picker = read(`${D}/website/editor/_components/scene-template-picker.tsx`);
  const scrim = Number(/className="fixed inset-0 z-\[(\d+)\] cursor-default/.exec(picker)?.[1]);
  const box = Number(/'fixed z-\[(\d+)\] mx-auto max-w-3xl/.exec(picker)?.[1]);
  const frame = Number(/className="pointer-events-none fixed inset-0 z-\[(\d+)\] lg:hidden"/.exec(edits)?.[1]);
  assert.ok(frame > 0 && scrim > 0 && box > 0, 'anti-vacuity: a layer’s number was not read');
  assert.ok(frame < Number(dark[1]) && Number(dark[1]) < scrim && scrim < box, `the layers are out of order: frame ${frame} · dark ${dark[1]} · close ${scrim} · box ${box}`);
  /* A tap on the dark closes: the picker's own full-screen button is over it, and the dark takes no tap. */
  assert.match(picker, /aria-label="Close the templates"\s+onClick=\{\(\) => setOpen\(false\)\}/);
  /* It is mounted only while open, around the shipped picker — whose own trigger stays hidden. */
  assert.match(edits, /<OwnScenePicker onClose=\{\(\) => setOwnOpen\(false\)\}>\s*<SceneTemplatePicker\s+overlay\s+draft\s+open/);
  assert.match(wrap, /\[&>div>button:first-child\]:hidden/);
  /* The picker's file rides the Maker's first load: it gains nothing. */
  assert.doesNotMatch(picker, /popup-behind|use-popup-behind|sn-popup-dark|inertBehind/, 'the first-load picker was given the rule’s code');
});

test('(4) the Apply sheet’s own backdrop wears the one dark from the STYLESHEET — every rule of it — and its first-load file gains no import', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ApplyProSheet } = await import(`../${D}/website/_components/apply-pro-sheet`);
  const html = renderToStaticMarkup(
    React.createElement(ApplyProSheet as never, { effects: [], priceLabel: null, proHref: null, pending: false, onGo: () => {}, onRemove: () => {}, onApplyFree: () => {}, onClose: () => {}, changeCount: 2 }),
  );
  /* The mark is on the DIRECT child of the backdrop — what `div:has(> [data-apply-pro-sheet])` selects. */
  const open = /^<div class="([^"]*)"><div [^>]*>/.exec(html);
  assert.ok(open, `the sheet’s shape changed: ${html.slice(0, 160)}`);
  assert.match(open[0], /^<div class="fixed inset-0 [^"]*"><div [^>]*data-apply-pro-sheet=""/, 'the stylesheet’s selector no longer finds the backdrop');
  assert.match(open[0], /role="dialog"[^>]*aria-modal="true"|aria-modal="true"[^>]*role="dialog"/);
  assert.ok(open[1]!.split(' ').includes('fixed') && open[1]!.split(' ').includes('inset-0'), 'the backdrop does not cover the screen — the page behind could be pressed');
  /* EVERY rule of the dark names it, so it is dark AND blurred, and dark alone where blur is not wanted. */
  const lists = [...CSS.matchAll(/([^{}]*)\.sn-popup-dark \{/g)].map((m) => m[1]!.slice(m[1]!.lastIndexOf(';') + 1).slice(m[1]!.lastIndexOf('}') + 1));
  assert.equal(lists.length, 3, 'anti-vacuity: the dark’s three rules were not found');
  for (const l of lists) assert.match(l, /div:has\(> \[data-apply-pro-sheet\]\),\s*$/, 'a rule of the dark does not reach the Apply sheet');
  /* It carries a type selector, so it outweighs the sheet's own `bg-ink/30` utility wherever that is emitted. */
  assert.match(html, /bg-ink\/30/, 'anti-vacuity: the sheet no longer carries the wash this rule has to outweigh');
  /* The file itself — in the Maker's first load — is as it was: its own modal contract, a tap on the dark closes, no new import. */
  const src = read(`${D}/website/_components/apply-pro-sheet.tsx`);
  assert.match(src, /useModalA11y\(\{ open: true, onClose, containerRef: dialogRef \}\);/);
  assert.match(src, /onClick=\{\(e\) => \{\s*if \(e\.target === e\.currentTarget\) onClose\(\);\s*\}\}/);
  assert.deepEqual(
    [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort(),
    ['@/app/_components/info-tip', '@/app/_components/paid-mark', '@/lib/format-number', '@/lib/hub-draft', '@/lib/hub-pro-effect-view', '@/lib/use-modal-a11y', 'lucide-react', 'next/link', 'react'],
    'the Apply sheet imports something new — it rides the Maker’s first load',
  );
});
