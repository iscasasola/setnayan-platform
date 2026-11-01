/**
 * enter-still-adds.test.ts — ⏎ ENTER STILL ADDS IN ONE-LINE ADD BOXES (owner ruling 1 Nov 2026, DECISION_LOG).
 *
 * #7142 moved Admin › Categories' "＋ Add" row (group, category and service share one `AddRow`) and the supplier's
 * "Your custom domain" onto the one Field template (`TypedRow`). There Enter only KEPT the words; it no longer added
 * them, as the raw boxes had. The template now takes an opt-in `onEnter`: Enter keeps, then hands the kept words to the
 * add. Every other field does not opt in, so its Enter only keeps (and a phone's "next" still goes on).
 *
 * Same PR: the You card's "Display name" got its autofill hint back (`autoComplete="nickname"`), through a template prop.
 *
 *   (1) WHAT ENTER HANDS THE ADD — the kept words on Enter; nothing on any other exit, nothing empty, nothing wrong.
 *   (2) THE TEMPLATE — a row's keep on Enter calls `onEnter` with them; an add box's Enter key says "go" and never tabs on.
 *   (3) THE TWO ADD BOXES — each TypedRow's `onEnter` is the very function that adds (it reaches the add action).
 *   (4) THE DISPLAY NAME — its open field carries autocomplete="nickname"; the template draws what it is given.
 *
 * Mutations seen RED (1 Nov), each restored: `onEnter={add}` removed from `AddRow` → (3); `onEnter={handleAdd}` removed
 * from the domain box → (3); the template's `onEnter?.(adds)` dropped → (2); `enterAdds` answering on 'tap-out' → (1);
 * `autoComplete="nickname"` removed → (4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';
import { enterAdds, keepOutcome, type FieldExit } from './form-row';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const h = React.createElement;

/** The `<TypedRow …/>` element whose attributes include `marker` (the one row we mean, not any row of the file). */
function typedRowWith(src: string, marker: RegExp): string {
  const rows = src.match(/<TypedRow\b[\s\S]*?\/>/g) ?? [];
  const hit = rows.filter((r) => marker.test(r));
  assert.equal(hit.length, 1, `expected exactly one TypedRow matching ${marker}, found ${hit.length}`);
  return hit[0]!;
}
/** The body of `function name(…) { … }` — by brace depth, so a nested block does not end it early. */
function fnBody(src: string, name: string): string {
  const at = src.search(new RegExp(`function ${name}\\s*\\(`));
  assert.ok(at >= 0, `no function ${name}`);
  /* Past the parameter list (by paren depth: a typed parameter has its own parens), to the body's `{`. */
  let p = src.indexOf('(', at);
  for (let d = 0; p < src.length; p++) {
    if (src[p] === '(') d++;
    else if (src[p] === ')' && --d === 0) break;
  }
  const open = src.indexOf('{', p);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`unbalanced ${name}`);
}

test('(1) what Enter hands the add: the kept words on Enter only — never on a tap away, Tab, ✕ or Esc; never empty or wrong', () => {
  const before = '';
  const leave = (exit: FieldExit, typed: string, prior = before, check: ((t: string) => string | null) | null = null) =>
    enterAdds(exit, keepOutcome({ exit, typed, before: prior, check }), prior);
  assert.equal(leave('enter', '  Lights   and sound '), 'Lights and sound', 'Enter does not hand the kept words to the add');
  for (const exit of ['tap-out', 'tab', 'tab-back', 'x', 'escape'] as const) {
    assert.equal(leave(exit, 'Lights'), null, `${exit} adds — only Enter may (a tap away must never add a row by accident)`);
  }
  assert.equal(leave('enter', '   '), null, 'an empty box adds');
  assert.equal(leave('enter', 'bad', '', (t) => (t === 'bad' ? 'Not a name' : null)), null, 'wrong words are added');
  // The words were already kept (a tap away, then the field reopened): Enter on the unchanged words still adds them.
  assert.equal(leave('enter', 'sny.myshop.com', 'sny.myshop.com'), 'sny.myshop.com', 'Enter on kept, unchanged words does not add');
});

test('(2) the template: Enter keeps and then hands the words to `onEnter`; an add box says "go" and never moves on', async () => {
  const src = read('app/_components/form-row.tsx');
  const typed = src.slice(src.indexOf('export function TypedRow('), src.indexOf('export function FormRowField('));
  const end = typed.slice(typed.indexOf('const end = (exit: FieldExit, typed: string)'), typed.indexOf('const closed = ()'));
  assert.ok(end.length > 0, 'TypedRow has no end()');
  const call = end.match(/(\w+)\s*=\s*onEnter\s*\?\s*enterAdds\(\s*exit\s*,\s*out\s*,\s*shown\s*\)/);
  assert.ok(call, 'TypedRow.end does not ask enterAdds what Enter adds');
  assert.match(end, new RegExp(`if\\s*\\(\\s*${call[1]}\\s*!==\\s*null\\s*\\)\\s*onEnter\\??\\.?\\(\\s*${call[1]}\\s*\\)`), 'TypedRow.end never calls onEnter');
  assert.match(typed, /entersAdd=\{Boolean\(onEnter\)\}/, 'the open field is not told it is an add box');

  const field = src.slice(src.indexOf('export function FormRowField('));
  assert.match(field, /e\.key === 'Enter'[\s\S]{0,400}end\(\s*!entersAdd\s*&&\s*onwards/, "an add box's Enter can be turned into Tab on a phone");

  const { FormRowField } = await import('../app/_components/form-row');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const open = (extra: Record<string, unknown>) =>
    renderToStaticMarkup(
      h(FormRowField as React.FC<Record<string, unknown>>, { handle: { current: null }, name: 'Name it', nameId: 'n1', start: '', placeholder: 'Name it', long: false, maxLength: 80, mark: null, leaving: false, onEnd: () => {}, onGone: () => {}, ...extra }),
    );
  assert.match(open({ entersAdd: true, onwards: true }), /enterKeyHint="go"/i, 'an add box does not say "go"');
  assert.match(open({ onwards: true }), /enterKeyHint="next"/i, 'an ordinary field lost its "next"');
  assert.match(open({}), /enterKeyHint="done"/i, 'an ordinary last field lost its "done"');
});

test('(3) the two add boxes: Enter in each calls the very function that adds', () => {
  // Admin › Categories — the ONE AddRow serves group, category and service.
  const map = read('app/admin/categories/_components/four-level-map.tsx');
  const addRow = fnBody(map, 'AddRow');
  const row = typedRowWith(addRow, /data=\{`add-\$\{kind\}`\}/);
  const fn = row.match(/onEnter=\{(\w+)\}/)?.[1];
  assert.ok(fn, 'the "＋ Add" row has no onEnter — Enter only keeps, it does not add');
  assert.match(fnBody(addRow, fn), /\bonAdd\(/, `the "＋ Add" row's onEnter (${fn}) does not add`);

  // Supplier › Website — "Your custom domain".
  const dom = read('app/vendor-dashboard/website/_domain-manager.tsx');
  const drow = typedRowWith(dom, /name="Your custom domain"/);
  const dfn = drow.match(/onEnter=\{(\w+)\}/)?.[1];
  assert.ok(dfn, '"Your custom domain" has no onEnter — Enter only keeps, it does not add');
  const body = fnBody(dom, dfn);
  assert.match(body, /addVendorDomain\(\s*(\w+)\s*\)/, `"Your custom domain"'s onEnter (${dfn}) does not add the domain`);
  // It adds the words Enter hands it — not the state, which has not caught up with the keep yet.
  const arg = body.match(/addVendorDomain\(\s*(\w+)\s*\)/)![1];
  assert.match(dom, new RegExp(`function ${dfn}\\s*\\(\\s*${arg}\\b`), `"Your custom domain" adds the stale state, not the words Enter handed it`);
});

test('(4) the display name keeps its autofill hint (nickname), drawn by the template', async () => {
  const you = read('app/signup/you/_components/display-name-field.tsx');
  assert.match(typedRowWith(you, /fieldName="display_name"/), /autoComplete="nickname"/, 'the display name lost autoComplete="nickname"');
  const { FormRowField } = await import('../app/_components/form-row');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const html = renderToStaticMarkup(
    h(FormRowField as React.FC<Record<string, unknown>>, { handle: { current: null }, name: 'Display name', nameId: 'n1', start: 'Ice', placeholder: 'Display name', long: false, maxLength: 128, mark: null, leaving: false, autoComplete: 'nickname', onEnd: () => {}, onGone: () => {} }),
  );
  assert.match(html, /<input[^>]*autoComplete="nickname"/i, 'the open field does not carry the autofill hint it is given');
});
