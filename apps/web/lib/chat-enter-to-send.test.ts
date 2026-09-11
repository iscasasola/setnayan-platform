/**
 * chat-enter-to-send.test.ts — the Enter-sends / Shift+Enter-newlines decision
 * for the chat composer (ChatSendForm + the tour's TourChatThread).
 *
 * Covers the three ways plain "Enter === send" would misfire: an IME
 * confirming a composed word (Filipino/Japanese/Chinese keyboards all use
 * Enter for this), a held modifier that should keep its own default, and a
 * touch keyboard, which has no Shift+Enter at all — Return there must stay a
 * newline, or a phone user could never write a second line.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldSendOnEnter } from './chat-enter-to-send';

const DESKTOP = { coarsePointer: false };
const PHONE = { coarsePointer: true };

test('Enter with no modifiers sends, on desktop', () => {
  assert.equal(shouldSendOnEnter({ key: 'Enter', shiftKey: false }, DESKTOP), true);
});

test('Shift+Enter never sends — it starts a new line', () => {
  assert.equal(shouldSendOnEnter({ key: 'Enter', shiftKey: true }, DESKTOP), false);
});

test('a non-Enter key never sends', () => {
  assert.equal(shouldSendOnEnter({ key: 'a', shiftKey: false }, DESKTOP), false);
  assert.equal(shouldSendOnEnter({ key: 'Tab', shiftKey: false }, DESKTOP), false);
});

test('IME composition (isComposing) holds Enter back — word confirm, not submit', () => {
  assert.equal(
    shouldSendOnEnter({ key: 'Enter', shiftKey: false, isComposing: true }, DESKTOP),
    false,
  );
});

test('keyCode 229 is treated as composing, the legacy IME-confirm signal', () => {
  assert.equal(
    shouldSendOnEnter({ key: 'Enter', shiftKey: false, keyCode: 229 }, DESKTOP),
    false,
  );
});

test('Ctrl / Meta / Alt + Enter keep their own default — never hijacked into send', () => {
  assert.equal(
    shouldSendOnEnter({ key: 'Enter', shiftKey: false, ctrlKey: true }, DESKTOP),
    false,
  );
  assert.equal(
    shouldSendOnEnter({ key: 'Enter', shiftKey: false, metaKey: true }, DESKTOP),
    false,
  );
  assert.equal(
    shouldSendOnEnter({ key: 'Enter', shiftKey: false, altKey: true }, DESKTOP),
    false,
  );
});

test('coarse pointer (touch keyboard): Return never sends — no Shift+Enter exists there', () => {
  assert.equal(shouldSendOnEnter({ key: 'Enter', shiftKey: false }, PHONE), false);
  // Even an (impossible on a real on-screen keyboard) Shift+Enter stays a no-send.
  assert.equal(shouldSendOnEnter({ key: 'Enter', shiftKey: true }, PHONE), false);
});

test('plain Enter, explicit isComposing: false, no modifiers, desktop — sends', () => {
  assert.equal(
    shouldSendOnEnter(
      { key: 'Enter', shiftKey: false, isComposing: false, keyCode: 13 },
      DESKTOP,
    ),
    true,
  );
});
