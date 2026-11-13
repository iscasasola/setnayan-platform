/**
 * ✋ AN ASK STARTS FROM THE PART IT CHANGES (owner, ruling 6076).
 *
 * The host's (+) carried a blank "Ask for a change" row whose first step was to say WHAT it was about. The ruling: the
 * ask opens from the thing being changed — one quote line, the payment plan, a sent form — and carries it. This holds
 * the three halves: the (+) has no ask row (`lib/chat-plus.test.ts` 1a), the shipped door is attached to a part and
 * never asks for one again, and the part travels in what is sent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { askNoteWithPart, askPartWords, ASK_NOTE_MAX } from '@/lib/chat-cards';

const WEB = join(__dirname, '..', '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('the part travels in the ask: a line and a form are named in the note; the plan is its own subject', () => {
  assert.equal(askNoteWithPart({ subject: 'quote', name: 'Photography' }, '  drop the drone '), '“Photography” — drop the drone');
  assert.equal(askNoteWithPart({ subject: 'form', name: 'Prep form' }, 'add a question about parking'), '“Prep form” — add a question about parking');
  assert.equal(askNoteWithPart({ subject: 'plan', name: null }, 'two payments, not three'), 'two payments, not three');
  assert.equal(askNoteWithPart({ subject: 'quote', name: 'x' }, 'y'.repeat(2000)).length, ASK_NOTE_MAX, 'the database refuses a note over 1000');
  assert.equal(askPartWords({ subject: 'quote', name: 'Photography' }), 'Photography · a line of the quotation');
  assert.equal(askPartWords({ subject: 'plan', name: null }), 'Payment plan');
});

test('the door is attached to a part — it never asks "What should change?" with a subject picker again', () => {
  const src = read('app/_components/chat/cards/ask-change-card.tsx');
  assert.doesNotMatch(src, /<PickMenu/, 'the ask picks its subject again — it must start from the part');
  assert.match(src, /<QuoteCardLines items=\{lines\} onAsk=\{quoteOpen/, 'the live quote’s lines are not the ask’s door');
  assert.match(src, /setPart\(\{ subject: 'plan', name: null \}\)/, 'the payment plan is not a door to an ask');
  assert.match(src, /setPart\(\{ subject: 'form', name: formTitle \}\)/, 'a sent form is not a door to an ask');
  assert.match(src, /name="note" value=\{askNoteWithPart\(part, note\)\}/, 'the part does not travel in the ask');
  // A locked subject is still never offered (lane C's rule, unchanged).
  assert.match(src, /askForAChange\(\{ readerIsSupplier: false, locked: locks\[s as AskSubject\] === true/);
});

test('a line is pressable only where the hosts may ask — the shared lines stay plain everywhere else', () => {
  const lines = read('app/_components/quote-card-lines.tsx');
  assert.match(lines, /return onAsk \? \(/);
  assert.match(lines, /aria-label=\{`Ask for a change: \$\{li\.label!\.trim\(\)\}`\}/);
  // The supplier's "As they see it" preview never hands onAsk in.
  assert.doesNotMatch(read('app/_components/proposal-maker.tsx'), /<QuoteCardLines[^>]*onAsk/);
  // The sent form carries its own id and title into the ask.
  assert.match(read('app/_components/chat/cards/form-step-card.tsx'), /<AskChangeDoor threadId=\{threadId\}[^>]*formId=\{form\.formId\} formTitle=\{form\.title\}/);
});
