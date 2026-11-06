/**
 * the-typed-row-keeps-at-once.test.ts — A TYPED ROW KEEPS THE MOMENT ITS FIELD IS LEFT (2026-10-09; coordinator, on the E-Gifts report).
 *
 * THE FAULT: `TypedRow` ran its keep (`onKeep`, and for a row inside a form the hidden carrier's `input` + `change`) from `closed()` —
 * AFTER the field's fold animation. Measured in Chromium: the keep fired 286–302 ms after the tap-out (the E-Gifts thank-you words reached the
 * server ~780 ms after it, with the write beat), so a ✓ Apply pressed in that gap published before the words were drafted.
 *
 * THE RULE: the keep happens in `end` — at the tap-out, Enter, or the tap on another row — and the fold only shows it. Exactly ONE keep per
 * edit (a retry is the row's own Try again), none for an unchanged value, none while typing, ✕ leaves it as it was, the Undo's `sn-restore`
 * path untouched. The component cannot be driven without a DOM in this runner; the browser run that did (before: ~290 ms, after: 1–15 ms,
 * once, the carrier already holding the kept words, one `input` event) is in the commit message. This holds the wiring.
 *
 * SABOTAGE (each seen RED, then restored): the keep moved back behind the fold (`after.current = () => send(out.text)`) · the carrier not set
 * before the form is told · a second `send` on the close · `closed()` sending.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const src = stripComments(readFileSync(join(__dirname, '../app/_components/form-row.tsx'), 'utf8'));
const typed = src.slice(src.indexOf('export function TypedRow('), src.indexOf('export function FormRowField('));
const end = typed.slice(typed.indexOf('const end = (exit'), typed.indexOf('const closed = () =>'));
const closed = typed.slice(typed.indexOf('const closed = () =>'), typed.indexOf("if (mode !== 'leaving') return;"));

test('1 · the keep is in `end`: at the moment the field is left, before the fold starts', () => {
  assert.ok(end.length > 200 && closed.length > 50, 'TypedRow moved — re-read this guard');
  const send = end.indexOf('send(out.text)');
  assert.ok(send > 0, '`end` no longer keeps');
  assert.ok(send < end.indexOf("setMode('leaving')"), 'the keep comes after the fold starts');
  assert.ok(send > end.indexOf("out.kind === 'send'"), 'the keep is not inside the "send" outcome');
  assert.doesNotMatch(end, /after\.current = \(\) => send\(/, 'the keep waits for the fold again');
});

test('2 · the fold sends nothing — `closed()` runs only what a WRONG or still-needed answer shows', () => {
  assert.doesNotMatch(closed, /\bsend\(|onKeep|tellTheForm/, '`closed` keeps — after the fold');
  assert.match(end, /after\.current = \(\) => \{\s*setState\(\{ kind: 'wrong'/, 'a wrong answer is still shown after the fold');
});

test('3 · exactly ONE keep per edit: `send` is called by `end` and by Try again, nowhere else', () => {
  const calls = [...typed.matchAll(/\bsend\(/g)].length;
  assert.equal(calls, 2, `send( is called ${calls} times (end · Try again)`);
  assert.match(typed, /onClick=\{\(\) => send\(state\.text\)\}/, 'Try again is not the retry');
  assert.equal([...typed.matchAll(/onKeep\(/g)].length, 1, 'onKeep is called from more than one place');
  assert.equal([...typed.matchAll(/tellTheForm\(/g)].length, 1, 'the form is told from more than one place');
});

test('4 · a row inside a form is told ONCE, with the kept words already in its carrier', () => {
  const carrierSet = end.indexOf('carrier.current.value = out.text');
  assert.ok(carrierSet > 0, 'the carrier is not set before the form is told (React has not re-rendered it yet)');
  assert.ok(carrierSet < end.indexOf('send(out.text)'), 'the form is told before the carrier holds the kept words');
  assert.match(typed, /setState\(\{ kind: 'saving' \}\);[\s\S]{0,400}tellTheForm\(carrier\.current\);/, 'the form is no longer told inside the keep');
});

test('5 · nothing else changed: ✕ and an unchanged value keep nothing (the pure rule), and typing keeps nothing', () => {
  const rule = stripComments(readFileSync(join(__dirname, 'form-row.ts'), 'utf8'));
  assert.match(rule, /if \(!exitKeeps\(input\.exit\)\) return \{ kind: 'as-it-was' \};/, 'a ✕ / Esc exit keeps (lib/form-row.ts keepOutcome)');
  assert.match(rule, /if \(text === input\.before\) return \{ kind: 'as-it-was' \};/, 'an unchanged answer is kept');
  assert.match(end, /\} else \{\s*after\.current = null;\s*\}/, '✕ / an unchanged answer no longer closes with nothing');
  /* The open field's typing is the field's own state (`setText`) and tells the screen only through `onType` — never `onKeep`. */
  const field = src.slice(src.indexOf('export function FormRowField('), src.indexOf('export function ChosenRow('));
  assert.doesNotMatch(field, /onKeep|tellTheForm|\bsend\(/, 'the open field keeps while it is typed in');
});
