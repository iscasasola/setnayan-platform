/**
 * 🚦＋ v8.3's two looks, held: the booking ask's blocker answers in ONE row of equal widths (**Turn down | Agree and
 * book**, both ActionButtons), and the chat's (+) is a FILLED 40-px brand circle (grey when shut).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(__dirname, '..', 'app');
const read = (p: string) => readFileSync(join(APP, p), 'utf8');

test('the blocker row: two equal columns, Turn down and Agree and book, each full width', () => {
  const src = read('_components/chat/blocker-ask-row.tsx');
  const row = src.slice(src.lastIndexOf('return ('));
  assert.match(row, /grid grid-cols-2 gap-2/);
  assert.match(row, /<ActionButton tone="danger".*label="Turn down".*w-full/);
  assert.match(row, /<AskSubmit tone="ok" main.*label="Agree and book".*className="w-full"/);
  // A no is never one tap: Turn down opens its own step with Not now | Turn it down.
  assert.match(src, /label="Not now"/);
  assert.match(src, /label="Turn it down"/);
});

test('the supplier chat mounts the booking ask in its blocker layout', () => {
  const page = read('vendor-dashboard/messages/[threadId]/page.tsx');
  assert.match(page, /<LockRequestAnswer\s+layout="blocker"/);
});

test('the (+) is a filled 40-px brand circle with a white ＋, grey when shut', () => {
  const src = read('vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet.tsx');
  const at = src.indexOf('data-plus-circle');
  assert.ok(at > 0, 'the circle is drawn');
  const tag = src.slice(at, at + 260);
  assert.match(tag, /h-10 w-10 place-items-center rounded-full/);
  assert.match(tag, /bg-sn-accent text-white/);
  assert.match(tag, /bg-ink\/\[0\.06\] text-ink\/35/);
  assert.ok(!/PlusCircle/.test(src), 'the outlined ⊕ is gone');
});
