/**
 * button-a11y-keyboard.test.ts — ⌨️ EVERY PRESS IN THESE FILES HAS A KEYBOARD WAY IN, AND EVERY ICON-ONLY BUTTON A NAME.
 *
 * The buttons audit of 27 Nov 2026 (`docs/audits/2026-11-27/buttons.md`, Bugs) found `onClick` on a `<div>`, `<img>`,
 * `<canvas>`, SVG `<g>`/`<path>` and `<tr>` with no role, no tabIndex and no key handler: a keyboard user could not
 * press them. These files were fixed together; this test keeps them fixed.
 *
 * ── WHAT IT CLAIMS ──────────────────────────────────────────────────────────────────────────────────────────────────
 *   1. `onPressKeys` (run): Enter and Space press, and the default is prevented; any other key does nothing; a key
 *      aimed at a child control is left to the child.
 *   2. (parsed) In every file of `FILES`, an intrinsic element that is not natively pressable (`button`, `a`, `input`,
 *      `select`, `textarea`, `summary`, `label`) and carries `onClick` is ONE of:
 *        · a pressable: `role` + `tabIndex` + `onKeyDown` on the same element;
 *        · a delegation wrapper: `role="none"` or `"presentation"` around a control that is itself reachable (a
 *          press on its padding is the pointer's shortcut, not its only way in);
 *        · a backdrop: `aria-hidden`, in a file where Escape closes what it closes;
 *        · a listbox option: `role="option"` in a file whose `role="listbox"` has `onKeyDown` and
 *          `aria-activedescendant` (the keyboard rolls the list; the option press is the pointer's shortcut).
 *   3. (parsed) In the same files, a `<button>` whose only content is a picture or an icon (no words, no expression)
 *      carries `aria-label`, `aria-labelledby` or `title`.
 *
 * ── NOT CLAIMED ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *   · That a screen reader announces them well — not driven in a browser here.
 *   · Files outside `FILES`. `app/_components/proposal-maker.tsx` (its drag handle) was in the audit but sat in an
 *     open PR when this landed, so it is left to a later pass.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { onPressKeys } from './press-keys';

const WEB = path.resolve(__dirname, '..');

const FILES = [
  'app/_components/ticker.tsx',
  'app/_components/picked/picked-shell.tsx',
  'components/thumb-row.tsx',
  'app/pay/[reference]/_components/pay-panel.tsx',
  'app/dashboard/[eventId]/studio/mood-board/_components/recolor-studio.tsx',
  'app/onboarding/wedding/_components/location-step.tsx',
  'app/onboarding/wedding/_components/welcome-moments.tsx',
  'app/admin/ugat/_components/ugat-console.tsx',
  'app/admin/moodboard-library/_components/color-range-manipulator.tsx',
  'app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/couple-story-shares-card.tsx',
];

const NATIVE = new Set(['button', 'a', 'input', 'select', 'textarea', 'summary', 'label']);

type Opening = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

function attrs(el: Opening): Map<string, ts.JsxAttribute> {
  const m = new Map<string, ts.JsxAttribute>();
  for (const p of el.attributes.properties) if (ts.isJsxAttribute(p)) m.set(p.name.getText(), p);
  return m;
}

function literal(a: ts.JsxAttribute | undefined): string | null {
  if (!a?.initializer) return null;
  if (ts.isStringLiteral(a.initializer)) return a.initializer.text;
  return null;
}

function parse(rel: string) {
  const src = fs.readFileSync(path.join(WEB, rel), 'utf8');
  return ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function openings(sf: ts.SourceFile): Opening[] {
  const out: Opening[] = [];
  const walk = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) out.push(n);
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

const where = (sf: ts.SourceFile, n: ts.Node) => `${sf.fileName}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;

function fakeKey(key: string, sameTarget = true) {
  const target = {};
  let prevented = false;
  return {
    e: {
      key,
      target,
      currentTarget: sameTarget ? target : {},
      preventDefault: () => (prevented = true),
      stopPropagation: () => {},
    } as unknown as Parameters<ReturnType<typeof onPressKeys>>[0],
    prevented: () => prevented,
  };
}

test('1. onPressKeys: Enter and Space press; other keys and child-aimed keys do not', () => {
  let n = 0;
  const h = onPressKeys(() => n++);
  for (const k of ['Enter', ' ']) {
    const f = fakeKey(k);
    h(f.e);
    assert.equal(f.prevented(), true, `${JSON.stringify(k)} prevents the default`);
  }
  assert.equal(n, 2);
  h(fakeKey('a').e);
  h(fakeKey('Tab').e);
  h(fakeKey('Enter', false).e);
  assert.equal(n, 2, 'a letter, Tab, or a key aimed at a child does not press');
});

test('2. every onClick on a non-native element in these files has a keyboard way in', () => {
  const bad: string[] = [];
  let checked = 0;
  for (const rel of FILES) {
    const sf = parse(rel);
    const all = openings(sf);
    const escCloses = /key === 'Escape'/.test(sf.text);
    const listboxDriven = all.some((el) => {
      const a = attrs(el);
      return literal(a.get('role')) === 'listbox' && a.has('onKeyDown') && a.has('aria-activedescendant');
    });
    for (const el of all) {
      const tag = el.tagName.getText();
      if (!/^[a-z]/.test(tag) || NATIVE.has(tag)) continue;
      const a = attrs(el);
      if (!a.has('onClick')) continue;
      checked++;
      const role = literal(a.get('role'));
      const hasRole = a.has('role');
      if (hasRole && a.has('tabIndex') && a.has('onKeyDown')) continue;
      if ((role === 'none' || role === 'presentation') && ts.isJsxOpeningElement(el)) continue;
      if (role === 'option' && listboxDriven) continue;
      if (a.has('aria-hidden') && escCloses) continue;
      bad.push(`${where(sf, el)} <${tag} onClick> has no keyboard way in (role + tabIndex + onKeyDown)`);
    }
  }
  assert.ok(checked >= 12, `the scan found the pressable elements it guards (found ${checked})`);
  assert.deepEqual(bad, []);
});

/** Words a person reads inside a JSX child: text, an expression (it may print words), or either one nested deeper.
 *  A JSX comment is an empty expression, so it is not words. */
function wordsIn(c: ts.JsxChild): boolean {
  if (ts.isJsxText(c)) return c.text.trim() !== '';
  if (ts.isJsxExpression(c)) return !!c.expression;
  if (ts.isJsxElement(c) || ts.isJsxFragment(c)) return c.children.some(wordsIn);
  return false;
}

test('3. a picture- or icon-only <button> in these files has an accessible name', () => {
  const bad: string[] = [];
  for (const rel of FILES) {
    const sf = parse(rel);
    const walk = (n: ts.Node) => {
      if (ts.isJsxElement(n) && n.openingElement.tagName.getText() === 'button') {
        const a = attrs(n.openingElement);
        const named = a.has('aria-label') || a.has('aria-labelledby') || a.has('title');
        const hasWords = n.children.some(wordsIn);
        if (!named && !hasWords) bad.push(`${where(sf, n)} <button> with only a picture or icon has no aria-label`);
      }
      ts.forEachChild(n, walk);
    };
    walk(sf);
  }
  assert.deepEqual(bad, []);
});
