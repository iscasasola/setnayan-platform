/**
 * A chat send never raises the app-wide "Saving your changes" veil (owner, 26 Nov 2026, the supplier walk: every
 * send showed a full-screen loading cover and read as the page refreshing — "this kind of refresh doesn't happen on
 * messenger"). The message's own delivery line says what is happening; the composer's Send is `overlay={false}`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const src = stripComments(readFileSync(join(process.cwd(), 'app/_components/chat-send-form.tsx'), 'utf8'));

test('the chat composer\'s Send turns the save veil off', () => {
  const at = src.indexOf("aria-label={editing ? 'Save your edit' : 'Send'}");
  assert.ok(at > 0, 'the Send button moved — re-point this guard');
  const open = src.lastIndexOf('<SubmitButton', at);
  const close = src.indexOf('>', at);
  assert.match(src.slice(open, close), /overlay=\{false\}/, 'a chat send would cover the screen with "Saving your changes"');
});

test('no other SubmitButton in the composer raises the veil', () => {
  for (const m of src.matchAll(/<SubmitButton\b/g)) {
    const end = src.indexOf('>', m.index!);
    assert.match(src.slice(m.index!, end), /overlay=\{false\}/, 'every send control in the chat box stays veil-free');
  }
});
