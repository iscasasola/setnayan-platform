/**
 * a-popup-darkens-what-is-behind.test.ts — THE MAKER'S SHEET FOLLOWS THE POP-UP RULE.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9): *"when there is a pop up. the
 * rest of the screen darkens (except for when there is preview) i think you know
 * what I mean. The darkened area will be blurred and nothing behind it will work.
 * pressing on the dark part removes the pop up. the background will not be
 * scrollable when darkened blurred"*.
 *
 * Held, each where it can be EXECUTED:
 *   (1) the dark is cut around a live preview — and left whole where there is none;
 *   (2) nothing behind works: every branch but the pop-up's own is `inert`, and
 *       closing puts back exactly what it changed (driven over a small tree);
 *   (3) the look: dark AND blurred, and dark alone where blur is not supported or
 *       the device asks for less transparency (the stylesheet's own rules);
 *   (4) rendered: one button under the dark closes it, the dark itself takes no
 *       tap, the sheet is a modal dialog no taller than the screen;
 *   (5) the wiring: inert + scroll lock + the preview's box on open, all undone on
 *       close; Studio › Look's sample wears the mark that keeps it clear.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { POPUP_CLEAR_ATTR, inertBehind, popupClearRect, popupHolePath } from './popup-behind';

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
const L = 'app/dashboard/[eventId]/launch/_components';

/* ── (1) the preview stays clear ──────────────────────────────────────── */

test('(1) the dark is cut around a live preview — the whole screen less its box — and left whole where there is none', () => {
  const phone = { width: 375, height: 812 };
  // The sample under the Maker's top bar: one outer ring (the screen), one inner (the box), `evenodd`.
  const path = popupHolePath({ left: 0, top: 102, right: 375, bottom: 352 }, phone);
  assert.equal(path, 'polygon(evenodd, 0px 0px, 375px 0px, 375px 812px, 0px 812px, 0px 0px, 0px 102px, 0px 352px, 375px 352px, 375px 102px, 0px 102px)');
  // THE CLAIM, measured: a point inside the box is NOT covered, a point outside is (even-odd over the two rings).
  const covered = (p: string, x: number, y: number) => {
    const pts = p.replace(/^polygon\(evenodd, |\)$/g, '').split(', ').map((s) => s.split(' ').map((n) => parseFloat(n)) as [number, number]);
    // The two rings are each closed by repeating their first point.
    const rings: Array<Array<[number, number]>> = [];
    let ring: Array<[number, number]> = [];
    for (const pt of pts) {
      ring.push(pt);
      if (ring.length > 1 && pt[0] === ring[0]![0] && pt[1] === ring[0]![1]) {
        rings.push(ring);
        ring = [];
      }
    }
    let crossings = 0;
    for (const r of rings)
      for (let i = 0; i + 1 < r.length; i += 1) {
        const [x1, y1] = r[i]!;
        const [x2, y2] = r[i + 1]!;
        if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) crossings += 1;
      }
    return crossings % 2 === 1;
  };
  assert.equal(covered(path!, 180, 200), false, 'the preview is darkened');
  assert.equal(covered(path!, 180, 60), true, 'the top bar above the preview is not darkened');
  assert.equal(covered(path!, 180, 600), true, 'the panel under the preview is not darkened');
  // A box wider than the screen is cut at the screen's edge; a box part-way in is cut as it stands.
  const side = popupHolePath({ left: 24, top: 80, right: 399, bottom: 330 }, { width: 900, height: 700 })!;
  assert.equal(covered(side, 200, 200), false);
  assert.equal(covered(side, 600, 200), true, 'the controls beside the preview are not darkened');
  assert.match(popupHolePath({ left: -20, top: -10, right: 500, bottom: 300 }, phone)!, /0px 0px, 0px 300px, 375px 300px, 375px 0px, 0px 0px\)$/, 'the hole runs past the screen');
  // NO PREVIEW, or none of it on screen: no hole — the dark is whole.
  assert.equal(popupHolePath(null, phone), null);
  assert.equal(popupHolePath({ left: 0, top: 900, right: 375, bottom: 1100 }, phone), null, 'a preview scrolled off the screen cuts a hole');
  assert.equal(popupHolePath({ left: 10, top: 10, right: 10, bottom: 200 }, phone), null);
  assert.equal(popupHolePath({ left: 0, top: 0, right: 100, bottom: 100 }, { width: 0, height: 0 }), null);

  // Which box: the first element wearing the mark that has something on screen.
  const box = (w: number, h: number, top = 100) => ({ getBoundingClientRect: () => ({ left: 0, top, right: w, bottom: top + h, width: w, height: h }) });
  const doc = (els: unknown[]) => ({ querySelectorAll: (sel: string) => (assert.equal(sel, '[data-popup-clear]'), els) }) as unknown as Document;
  assert.equal(POPUP_CLEAR_ATTR, 'data-popup-clear');
  assert.deepEqual(popupClearRect(doc([box(0, 0), box(375, 250)])), { left: 0, top: 100, right: 375, bottom: 350 }, 'a hidden preview is taken for the one on screen');
  assert.equal(popupClearRect(doc([box(0, 0)])), null);
  assert.equal(popupClearRect(doc([])), null);
});

/* ── (2) nothing behind works ─────────────────────────────────────────── */

class El {
  children: El[] = [];
  parentElement: El | null = null;
  attrs = new Map<string, string>();
  constructor(public tagName: string, public id = '') {}
  add(...kids: El[]) {
    for (const k of kids) {
      k.parentElement = this;
      this.children.push(k);
    }
    return this;
  }
  hasAttribute(n: string) {
    return this.attrs.has(n);
  }
  setAttribute(n: string, v: string) {
    this.attrs.set(n, v);
  }
  removeAttribute(n: string) {
    this.attrs.delete(n);
  }
}

test('(2) nothing behind works: every branch but the pop-up’s own is inert, and closing puts back exactly what it changed', () => {
  const page = () => {
    const html = new El('HTML');
    const head = new El('HEAD');
    const body = new El('BODY');
    const app = new El('DIV', 'app').add(new El('NAV', 'topbar'), new El('MAIN', 'maker'));
    const toasts = new El('DIV', 'toasts');
    const drawer = new El('DIV', 'closed-drawer');
    drawer.setAttribute('inert', '');
    const script = new El('SCRIPT');
    const sheet = new El('DIV', 'sheet');
    html.add(head, body);
    body.add(app, toasts, drawer, script, sheet);
    return { html, head, body, app, toasts, drawer, script, sheet };
  };
  const inert = (e: El) => e.hasAttribute('inert');

  // PORTALLED TO <body> (the shell's sheet): the whole app, and everything else beside it.
  let p = page();
  let undo = inertBehind(p.sheet);
  assert.deepEqual([inert(p.app), inert(p.toasts)], [true, true], 'the page behind the sheet can still be pressed');
  assert.equal(inert(p.sheet), false, 'the sheet itself is inert');
  assert.equal(inert(p.body), false);
  assert.equal(inert(p.head), false, 'the walk left <body>');
  assert.equal(inert(p.script), false);
  undo();
  assert.deepEqual([inert(p.app), inert(p.toasts)], [false, false], 'closing leaves the page inert');
  assert.equal(inert(p.drawer), true, 'closing woke a branch that was already inert before the sheet opened');
  undo();
  assert.equal(inert(p.drawer), true, 'a second undo changed something');

  // DRAWN INLINE, deep in the app: its ancestors stay live; every sibling on the way up does not.
  p = page();
  const panel = new El('SECTION', 'panel');
  const inline = new El('DIV', 'inline-sheet');
  const rows = new El('DIV', 'rows');
  panel.add(rows, inline);
  p.app.children[1]!.add(panel, new El('DIV', 'canvas'));
  undo = inertBehind(inline);
  const maker = p.app.children[1]!;
  assert.deepEqual([inert(inline), inert(panel), inert(maker), inert(p.app)], [false, false, false, false], 'an ancestor of the sheet is inert — the sheet would be dead too');
  assert.deepEqual([inert(rows), inert(maker.children[1]!), inert(p.app.children[0]!), inert(p.toasts), inert(p.sheet)], [true, true, true, true, true], 'a branch beside the sheet can still be pressed');
  undo();
  assert.equal([rows, maker.children[1]!, p.app.children[0]!, p.toasts, p.sheet].some(inert), false);

  // TWO SHEETS, one over the other: the second makes the first inert and gives it back; the first then gives the page back.
  p = page();
  const second = new El('DIV', 'second-sheet');
  const undoFirst = inertBehind(p.sheet);
  p.body.add(second);
  const undoSecond = inertBehind(second);
  assert.equal(inert(p.sheet), true, 'the sheet underneath still answers');
  undoSecond();
  assert.equal(inert(p.sheet), false, 'the sheet underneath stays dead after the top one closes');
  assert.equal(inert(p.app), true, 'the top sheet woke the page the first sheet had put to sleep');
  undoFirst();
  assert.equal(inert(p.app), false);
});

/* ── (3) the look ─────────────────────────────────────────────────────── */

test('(3) the dark is dark AND blurred — and dark alone where blur is not supported or less transparency is asked for', () => {
  const css = stripComments(readFileSync(join(WEB, 'app/globals.css'), 'utf8'));
  const at = css.indexOf('.sn-popup-dark {');
  assert.ok(at > 0, 'anti-vacuity: `.sn-popup-dark` is not in the stylesheet');
  const base = css.slice(at, css.indexOf('}', at) + 1);
  const alpha = Number(/background-color: rgb\(var\(--color-ink\) \/ (0?\.\d+)\);/.exec(base)?.[1]);
  assert.ok(alpha >= 0.35 && alpha <= 0.6, `the dark is ${alpha} — not a darkening`);
  assert.match(base, /backdrop-filter: blur\((\d+)px\);/);
  assert.match(base, /-webkit-backdrop-filter: blur\(\d+px\);/, 'iOS Safari would not blur');
  assert.ok(Number(/backdrop-filter: blur\((\d+)px\)/.exec(base)![1]) >= 4);
  // NOT SUPPORTED: still dark (deeper), no reliance on the blur.
  const unsupported = /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\) \{\s*\.sn-popup-dark \{([^}]*)\}/.exec(css)?.[1] ?? '';
  const deep = Number(/background-color: rgb\(var\(--color-ink\) \/ (0?\.\d+)\);/.exec(unsupported)?.[1]);
  assert.ok(deep >= alpha, 'where the backdrop cannot blur the page behind is not even dark');
  // LESS TRANSPARENCY ASKED FOR: the blur is taken off, the dark stays.
  const reduced = /@media \(prefers-reduced-transparency: reduce\) \{\s*\.sn-popup-dark \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(reduced, /backdrop-filter: none;/, 'the blur stays under "reduce transparency"');
  assert.match(reduced, /-webkit-backdrop-filter: none;/);
  assert.ok(Number(/background-color: rgb\(var\(--color-ink\) \/ (0?\.\d+)\);/.exec(reduced)?.[1]) >= alpha, 'under "reduce transparency" the page behind is not dark');
  // Nothing here moves.
  assert.doesNotMatch(base + unsupported + reduced, /animation|transition/);
});

/* ── (4) rendered ─────────────────────────────────────────────────────── */

test('(4) rendered: one button under the dark closes it, the dark takes no tap, and the sheet is a modal dialog no taller than the screen', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const P = await import(`../${L}/stages-studio-parts`);
  const html = renderToStaticMarkup(React.createElement(P.MakerSheet, { label: 'Background', onClose: () => {} }, React.createElement('ul', { 'data-rows': '' })));
  // Order matters: the close button, then the dark over it, then the sheet over both.
  const order = ['data-maker-sheet-scrim=""', 'data-maker-sheet-dark="whole"', 'role="dialog"'].map((s) => html.indexOf(s));
  assert.ok(order.every((i) => i > 0) && [...order].sort((a, b) => a - b).join() === order.join(), `the layers are out of order: ${order.join(', ')}`);
  const scrim = /<button[^>]*data-maker-sheet-scrim=""[^>]*>/.exec(html)![0];
  assert.match(scrim, /aria-label="Close"/);
  assert.match(scrim, /class="absolute inset-0 h-full w-full[^"]*"/, 'the close button does not cover the whole screen — a tap on the dark could miss it');
  const dark = /<span[^>]*data-maker-sheet-dark="whole"[^>]*>/.exec(html)![0];
  assert.match(dark, /class="sn-popup-dark pointer-events-none absolute inset-0"/, 'the dark is not the one pop-up look, or it swallows the tap that should close');
  assert.match(dark, /aria-hidden="true"/);
  assert.doesNotMatch(dark, /style=/, 'a hole is cut with no preview measured');
  const dialog = /<div[^>]*role="dialog"[^>]*>/.exec(html)![0];
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /aria-label="Background"/);
  assert.match(dialog, /max-h-\[62dvh\]/, 'the sheet can grow taller than the screen');
  assert.match(html, /<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain"><ul data-rows="">/, 'long content does not scroll inside the sheet');
  assert.match(html, /^<div data-maker-sheet="" class="fixed inset-0 z-\[95\] lg:hidden">/);
});

/* ── (5) the wiring ───────────────────────────────────────────────────── */

test('(5) on open: inert behind, no scroll behind, the preview measured; on close: all of it undone — and the sample wears the mark', () => {
  const src = read(`${L}/stages-studio-parts.tsx`);
  const sheet = src.slice(src.indexOf('export function MakerSheet('), src.indexOf('export function LowerThirdGrab('));
  assert.ok(sheet.length > 400, 'anti-vacuity: MakerSheet was not found');
  const effect = sheet.slice(sheet.indexOf('useLayoutEffect(() => {'), sheet.indexOf('}, []);'));
  // Open: the page behind is put out of reach, and the preview's box is measured.
  assert.match(effect, /const undo = inertBehind\(el\);/, 'the page behind is not put out of reach');
  assert.match(effect, /const measure = \(\) => setHole\(popupHolePath\(popupClearRect\(document\), \{ width: window\.innerWidth, height: window\.innerHeight \}\)\);\s*measure\(\);/);
  // Close: everything put back.
  const cleanup = effect.slice(effect.indexOf('return () => {'));
  for (const back of ['undo();', "window.removeEventListener('resize', measure);"]) {
    assert.ok(cleanup.includes(back), `closing the sheet does not run \`${back}\``);
  }
  // No scroll behind, Escape, the Tab trap: the app's ONE modal contract — CALLED, on the dialog (a sheet over a
  // modal shares its scroll-lock count and only the one on top answers Escape). `modal-a11y-adoption` holds the call.
  assert.match(sheet, /useModalA11y\(\{ open: true, onClose, containerRef: panel, initialFocusRef: kept \}\);/, 'the sheet claims to be modal without the app’s modal contract');
  assert.match(sheet, /ref=\{panel\}\s*role="dialog"\s*aria-modal="true"/);
  const hook = read('lib/use-modal-a11y.ts');
  assert.match(hook, /if \(lockScroll\) lockBodyScroll\(\);/, 'anti-vacuity: the contract no longer locks the page’s scroll');
  assert.match(hook, /if \(event\.key === 'Escape'\) \{/);
  // The focus a list gave its picked row is KEPT (the contract would otherwise move it to the sheet itself)…
  assert.match(sheet, /return a instanceof HTMLElement && root\.current\?\.contains\(a\) \? a : null;/);
  // …and goes back to what opened the sheet once it is gone.
  assert.match(sheet, /from\.current = document\.activeElement instanceof HTMLElement \? document\.activeElement : null;/);
  assert.match(sheet, /if \(lost && from\.current\?\.isConnected\) from\.current\.focus\(\{ preventScroll: true \}\);/, 'the focus is not given back to what opened the sheet');
  // Measured at open and on a resize — never polled.
  assert.doesNotMatch(sheet, /setInterval|requestAnimationFrame/, 'the preview’s box is polled');
  // The tap outside closes; the hole is cut in the DARK only (the close button under it stays whole).
  assert.match(sheet, /data-maker-sheet-scrim="" onClick=\{onClose\}/);
  assert.match(sheet, /data-maker-sheet-dark=\{hole \? 'around-preview' : 'whole'\}\s*className="sn-popup-dark pointer-events-none absolute inset-0"\s*style=\{hole \? \{ clipPath: hole \} : undefined\}/);
  assert.equal((sheet.match(/clipPath/g) ?? []).length, 1);
  // Studio › Look's sample is the live preview that stays clear.
  const sample = read(`${L}/look-sample.tsx`);
  assert.match(sample, /data-look-sample=""\s*data-popup-clear=""/, 'the sample is darkened behind a Look sheet');
  // One look for the dark: the sheet writes no colour or blur of its own.
  const behind = sheet.slice(sheet.indexOf('<button type="button" aria-label="Close"'), sheet.indexOf('ref={panel}'));
  assert.ok(behind.includes('data-maker-sheet-scrim') && behind.includes('sn-popup-dark'), 'anti-vacuity: the layers behind the sheet were not found');
  assert.doesNotMatch(behind, /backdrop-blur|\bbg-[a-z]|rgba?\(/, 'the sheet draws its own dark instead of the one pop-up look');
});
