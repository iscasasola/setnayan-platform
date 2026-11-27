/**
 * ✋ NO TEXT SELECTION, APP-WIDE (owner 27 Nov 2026, MASTER-PLAN R1 + R5 · DECISION_LOG 2026-11-27 "No text
 * highlighting or copying app-wide; remove placeholder copy").
 *
 *   1. The whole app takes selection and the long-press callout off (`body`), `/admin` included (R5).
 *   2. The person's own words stay selectable: every text box, every editor, and the one opt-in mark
 *      `[data-selectable]` — with the explicit `-webkit-user-select: text` that keeps an iOS box typeable.
 *   3. Chat messages wear the mark (the stream every role reads: hosts, suppliers, admin).
 *   4. A blocked clipboard on `CopyButton` shows the value in a selectable box (it can no longer say "select it").
 *   5. Nothing exempts a surface — no `/admin`, no `.app-surface`, no page-scoped `user-select: text`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const css = stripComments(read('app/globals.css'));

const ruleFor = (selectorList: string): string => {
  const at = css.indexOf(`${selectorList} {`);
  assert.ok(at >= 0, `no rule for “${selectorList}”`);
  return css.slice(at, css.indexOf('}', at));
};

test('(1) the whole app takes selection and the long-press callout off', () => {
  // The first `body {` is the colour rule; find the one that carries the selection.
  const all = [...css.matchAll(/(^|\n)\s*body \{([^}]*)\}/g)].map((m) => m[2]);
  const off = all.find((b) => /user-select:\s*none/.test(b));
  assert.ok(off, 'body never takes selection off');
  assert.match(off!, /-webkit-user-select:\s*none;/, 'Safari / iOS still selects');
  assert.match(off!, /(?<!-)user-select:\s*none;/);
  assert.match(off!, /-webkit-touch-callout:\s*none;/, 'a long-press still opens the copy / save callout');
});

test('(2) every text box, every editor and the opt-in mark stay selectable — iOS boxes included', () => {
  const on = ruleFor(
    "  input,\n  textarea,\n  select,\n  [contenteditable]:not([contenteditable='false']),\n  [data-selectable]",
  );
  assert.match(on, /-webkit-user-select:\s*text;/, 'an iOS text box under a `none` body cannot be typed in');
  assert.match(on, /(?<!-)user-select:\s*text;/);
  // A tick box or a button-shaped input holds no words.
  const back = ruleFor(
    "  input[type='checkbox'],\n  input[type='radio'],\n  input[type='range'],\n  input[type='button'],\n  input[type='submit'],\n  input[type='reset']",
  );
  assert.match(back, /user-select:\s*none;/);
});

test('(3) chat messages wear the mark, in the one stream every role reads', () => {
  const stream = read('app/_components/chat-message-stream.tsx');
  // The plain bubble, the two card fallbacks, the booking card note and a message on its way.
  assert.ok((stream.match(/<p data-selectable="" className=/g) ?? []).length >= 5, 'a chat bubble lost its selectable words');
  assert.match(stream, /<p data-selectable="" className="whitespace-pre-wrap break-words">\s*\{cakeAt > 0/, 'the plain bubble is not selectable');
  assert.match(read('app/_components/chat/decision-panel.tsx'), /data-selectable="" className=\{`whitespace-pre-wrap break-words \$\{bubble\}`\}>\{words\}/);
  assert.match(read('app/_components/chat/thread-arrival.tsx'), /<span data-selectable="" className=\{`max-w-\[75%\] whitespace-pre-wrap/);
});

test('(4) a blocked clipboard shows the value in a box that can be selected', () => {
  const src = read('app/_components/copy-button.tsx');
  assert.match(src, /setBlocked\(true\)/, 'a blocked copy says nothing');
  assert.match(src, /<span data-selectable="" className="select-all[^"]*">\s*\{value\}/, 'the fallback value cannot be selected');
});

test('(5) no surface is exempt — /admin follows the rule (R5)', () => {
  assert.doesNotMatch(css, /\.app-surface[^{]*\{[^}]*user-select:\s*text/, 'a surface turns selection back on');
  assert.doesNotMatch(css, /admin[^{]*\{[^}]*user-select:\s*text/i, '/admin is exempt (R5 says it is not)');
  // The only rules that turn selection ON are the two above (boxes + the mark).
  const onRules = [...css.matchAll(/([^{}]+)\{[^}]*(?<!-)user-select:\s*(?:text|auto|all)/g)].map((m) => m[1].trim());
  assert.deepEqual(
    onRules,
    ["input,\n  textarea,\n  select,\n  [contenteditable]:not([contenteditable='false']),\n  [data-selectable]"],
    'a new rule turns selection back on — mark the element `data-selectable` instead',
  );
});
