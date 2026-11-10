/**
 * equal-weight-choices-sit-at-equal-widths.test.ts — 🔘 T19 RULE 5: EQUAL-WEIGHT CHOICES SIT IN ONE ROW AT EQUAL WIDTHS.
 *
 * Owner 9 Nov (memory `buttons-uniform-rows-balanced`): uniform ActionButtons, equal-weight choices at equal widths;
 * DECISION_LOG 2026-11-10 🔘 "UNIFORM ACTIONBUTTONS"; HOUSE_TEMPLATES T19 said "NO GUARD — needs one for equal widths of
 * equal-weight choices". This is that guard (Build 5 · Lane A slice 2), on the two rows the owner's review named:
 *   · the QR card (Today's step 6 "Download your QR", every Your-QR-codes card): Share · Copy link · Download QR;
 *   · the risen Share door on Shop: Copy · Save · Share (three odd-width chips until now).
 *
 * ── THE PROPERTIES ──────────────────────────────────────────────────────────
 *   1. ONE shape for such a row — `EqualRow` (components/action-button.tsx): a grid of equal columns that fits as one
 *      (`useFitRow`); the chat cards' `EqualRow` IS it (re-exported, no second copy); the CSS lets every button fill its
 *      cell, an icon-only one too (after `.ab.icon-only`, one class stronger).
 *   2. The QR card's three doors are the direct cells of one EqualRow — and still Share · Copy link · Download, in order.
 *   3. The Share door's Copy · Save · Share are presses of ONE width — no odd chip left.
 *
 * SABOTAGE (each run once, each went red): put the QR row back in `flex flex-wrap` → 2; give Save its old chip → 3;
 * move the CSS rule above `.ab.icon-only` → 1.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(import.meta.dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('1 · ONE EqualRow: equal grid columns that fit as one; the chat cards use it; every button fills its cell', async () => {
  const ab = code('components/action-button.tsx');
  const { EQUAL_ROW_CLASS } = await import('@/components/action-button');
  assert.equal(EQUAL_ROW_CLASS, 'grid auto-cols-fr grid-flow-col gap-2', 'the row is not a grid of equal columns');
  const fn = ab.slice(ab.indexOf('export function EqualRow('));
  assert.match(fn, /useFitRow\(ref\);/, 'the row does not fit as one');
  assert.match(fn, /data-equal-row=/);
  const defs = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'components'))]
    .filter((p) => /function EqualRow\b/.test(stripComments(readFileSync(p, 'utf8'))))
    .map((p) => relative(WEB, p));
  assert.deepEqual(defs, ['components/action-button.tsx'], 'a second EqualRow');
  assert.match(code('app/_components/chat/cards/card-bits.tsx'), /export \{ EqualRow \} from '@\/components\/action-button';/, 'the chat cards no longer use the house row');

  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  const iconOnly = css.indexOf('.ab.icon-only { width: 40px; padding: 0; }');
  const fill = css.indexOf('[data-equal-row] > .ab.icon-only { width: 100%; min-width: 0; }');
  assert.ok(iconOnly > 0, 'anti-vacuity: the icon-only rule moved');
  assert.ok(fill > iconOnly, 'an EqualRow’s icon-only button shrinks back to 40 px (the cell rule is missing or above `.icon-only`)');
  assert.match(css, /\[data-equal-row\] > \.ab,\s*\[data-equal-row\] > \.ab\.icon-only \{ width: 100%; min-width: 0; \}/);
});

test('2 · the QR card: Share · Copy link · Download are the cells of ONE equal row', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { QrCard } = await import('@/app/_components/qr-card');
  for (const primary of ['share', 'download'] as const) {
    const html = renderToStaticMarkup(
      React.createElement(QrCard, { svg: '<svg></svg>', url: 'https://setnayan.com/v/setnaprod', title: 'Your shop code', filename: 'q.svg', primary }),
    );
    const at = html.indexOf('data-equal-row="qr-card"');
    assert.ok(at > 0, `the QR card’s doors are not one EqualRow (${primary})`);
    const open = html.lastIndexOf('<div', at);
    assert.match(html.slice(open, at), /class="grid auto-cols-fr grid-flow-col gap-2 /, 'the QR row is not the equal grid');
    // The row's own children, in order, each an ActionButton.
    const row = html.slice(html.indexOf('>', at) + 1);
    const cells: string[] = [];
    let depth = 0;
    for (const m of row.matchAll(/<(\/?)(button|a|div|span)\b[^>]*>/g)) {
      if (m[1]) {
        if (depth === 0) break;
        depth -= 1;
        continue;
      }
      if (depth === 0) cells.push(m[0]);
      depth += 1;
    }
    assert.equal(cells.length, 3, `the QR row holds ${cells.length} cells, not Share · Copy link · Download`);
    assert.match(cells[0]!, /data-qr-share=""/);
    assert.match(cells[1]!, /data-qr-copy=""/);
    assert.match(cells[2]!, /data-qr-download=""/);
    for (const c of cells) assert.match(c, /class="ab ab-/, `a QR door is not an ActionButton: ${c}`);
  }
});

test('3 · the Share door: Copy · Save · Share are presses of ONE width', () => {
  const cover = code('app/vendor-dashboard/shop/_components/shop-cover.tsx');
  const sheet = cover.slice(cover.indexOf('function ShareSheet('), cover.indexOf('\n}\n', cover.indexOf('function ShareSheet(')));
  assert.ok(sheet.length > 0, 'anti-vacuity: the Share door moved');
  assert.match(cover, /const SHARE_DOOR_W = 'w-\[[\d.]+rem\] shrink-0';/, 'the door’s one width is gone');
  assert.match(cover, /SHARE_DOOR_PRESS = actionButtonClass\('neutral', \{ extra: SHARE_DOOR_W \}\)/);
  assert.match(sheet, /<CopyButton [^>]*className=\{SHARE_DOOR_PRESS\}/, 'Copy is not the door’s one press');
  assert.match(sheet, /<SaveFileLink [^>]*className=\{SHARE_DOOR_PRESS\}/, 'Save is not the door’s one press');
  // Share keeps the shipped `<Share aria-hidden …/> Share` shape that lib/share-buttons-use-one-icon.test.ts anchors on.
  assert.match(sheet, /<button\s+type="button"\s+className=\{SHARE_DOOR_PRESS\}[\s\S]{0,400}?<Share aria-hidden[^/]*\/>\s*Share\s*<\/button>/, 'Share is not the door’s one press');
  assert.doesNotMatch(sheet, /rounded-full bg-ink\/\[0\.06\]/, 'an odd-width chip is back in the Share door');
  assert.equal([...sheet.matchAll(/SHARE_DOOR_(?:PRESS|W)\}/g)].length, 3, 'the door does not have exactly three presses of one width');
});

test('4 · an equal row fits only when every word sits inside its own button (the 375 px "Download QR" spill)', () => {
  // Equal cells never make the ROW overflow, and a centred word eats the padding before `scrollWidth` notices — so
  // the fit pass measures each button's content box. Without it the row stays "full" while the word runs into the edge.
  const src = code('components/action-button.tsx');
  const fits = src.slice(src.indexOf('function fits('), src.indexOf('export function fitRow'));
  assert.match(fits, /hasAttribute\?\.\('data-equal-row'\)[\s\S]*spillsItsPadding\(b\)/, 'fits() no longer checks each button of an equal row');
  const spill = src.slice(src.indexOf('function spillsItsPadding'));
  assert.match(spill, /paddingLeft[\s\S]*paddingRight/, 'the spill measure ignores the padding');
  assert.match(spill, /getBoundingClientRect\(\)[\s\S]*r\.left < left[\s\S]*r\.right > right/, 'the spill measure does not compare the icon and word to the content box');
});
