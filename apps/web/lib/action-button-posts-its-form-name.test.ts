/**
 * action-button-posts-its-form-name.test.ts — the field a submit POSTS and the name it is READ ALOUD by are two props.
 *
 * Controller, 16 Nov 2026, answering #7874's question ("ActionButton uses `name` as its accessible name. Should it
 * gain a separate form-name prop?"): *"yes, add a separate form-name prop so buttons that post name/value keep
 * working. Keep it minimal and add a test."*
 *
 * Before it, `name` did both: `<ActionButton name="action" value="confirm_fraud" label="Confirm fraud" />` posted
 * `action=confirm_fraud` AND was announced as "action" (twelve admin buttons on integrity-watch, repost-watch and the
 * queue cards). So the admin sweep left the data-privacy and launch-offer presses as raw `<button>`s.
 *
 *   T1  RENDERED: `formName` + `value` reach the `<button>` as `name` / `value`; the accessible name stays the word.
 *   T2  RENDERED: an accessible `name` is never posted — the `<button>` carries no `name` attribute.
 *   T3  THE TREE: every `<ActionButton …>` that posts a `value` names its field with `formName`. A `value` with no
 *       `formName` posts nothing, so the server action would read an empty field — silently.
 *
 * SABOTAGE, each seen red before this shipped:
 *   T1 render `name={p.name}` again in the <button> branch
 *   T2 render `name={p.formName ?? name}`
 *   T3 put `name="action"` back on one integrity-watch button
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { APP_ROOT, collectSourceFiles } from './security/shadowed-export-scan';

// The component files use the automatic JSX runtime; under tsx they need `React` in scope.
(globalThis as unknown as { React: unknown }).React = React;
const { ActionButton } = require('../components/action-button') as typeof import('../components/action-button');

const Icon = () => React.createElement('svg', { 'aria-hidden': true });
const button = (html: string) => /<button\b[^>]*>/.exec(html)?.[0] ?? '';

test('T1 · formName + value are posted; the button is still read aloud by its word', () => {
  const html = renderToStaticMarkup(
    React.createElement(ActionButton, {
      tone: 'danger',
      icon: Icon,
      type: 'submit',
      formName: 'action',
      value: 'confirm_fraud',
      label: 'Confirm fraud',
    }),
  );
  const tag = button(html);
  assert.ok(tag, 'no <button> rendered');
  assert.match(tag, /\bname="action"/, 'the form field name is not posted');
  assert.match(tag, /\bvalue="confirm_fraud"/, 'the value is not posted');
  assert.match(tag, /\baria-label="Confirm fraud"/, 'the accessible name is not the word');
  assert.doesNotMatch(tag, /aria-label="action"/, 'the form field name leaked into the accessible name');
});

test('T2 · an accessible name is never posted as a form field', () => {
  const html = renderToStaticMarkup(
    React.createElement(ActionButton, {
      tone: 'neutral',
      icon: Icon,
      type: 'submit',
      label: 'Invite',
      name: 'Invite Maria Santos — sent Sep 30',
    }),
  );
  const tag = button(html);
  assert.match(tag, /\baria-label="Invite Maria Santos — sent Sep 30"/, 'the accessible name is lost');
  assert.doesNotMatch(tag, /\sname=/, 'the accessible name is posted as a form field');
});

/** Every opening `<ActionButton …>` tag in a source file, with the line it starts on. */
function actionButtonTags(source: string): { line: number; tag: string }[] {
  const out: { line: number; tag: string }[] = [];
  let i = 0;
  while ((i = source.indexOf('<ActionButton', i)) >= 0) {
    let depth = 0;
    let j = i + 1;
    for (; j < source.length; j++) {
      const c = source[j];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (depth === 0 && c === '>') break;
    }
    out.push({ line: source.slice(0, i).split('\n').length, tag: source.slice(i, j) });
    i = j;
  }
  return out;
}

test('T3 · every ActionButton that posts a value names its field with formName', () => {
  const files = [...collectSourceFiles(path.join(APP_ROOT, 'app')), ...collectSourceFiles(path.join(APP_ROOT, 'components'))]
    .filter((f) => f.endsWith('.tsx'));
  assert.ok(files.length > 1000, `the walk found only ${files.length} .tsx files — it has gone blind`);
  const bad: string[] = [];
  let posting = 0;
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    if (!src.includes('<ActionButton')) continue;
    for (const { line, tag } of actionButtonTags(src)) {
      if (!/\svalue=/.test(tag)) continue;
      posting++;
      if (!/\sformName=/.test(tag)) bad.push(`${path.relative(APP_ROOT, f)}:${line}`);
    }
  }
  assert.ok(posting >= 12, `only ${posting} posting ActionButtons found — the scan has gone blind`);
  assert.deepEqual(bad, [], `an ActionButton posts a value with no formName (it posts nothing):\n  ${bad.join('\n  ')}`);
});
