/**
 * 🔒 THERE IS ONE PRIVATE CHIP (Unichat parts D + E folded, 20 Nov 2026; DECISION_LOG 2026-11-20 "UNICHAT PART E — FIVE
 * CALLS", call 4: "One Private chip … folds into Part D's chip component when D lands").
 *
 * Part D drew Private as a filter chip in the row; Part E drew its own sky "Private" tag over the box. Held here:
 *   1 · ONE component draws every Private chip (`app/_components/chat/private-chip.tsx`); the box draws none inline;
 *   2 · the row's Private chip is that component — the lock, and sky when picked;
 *   3 · while whispering the status is that component, with who it reaches and the dispute ⓘ;
 *   4 · a failed read is said as a failure ("Couldn't load…"), never as "no one" — and nobody is its own words;
 *   5 · with the row out, the status draws its line only — never a second chip on screen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { PrivateChip } from '@/app/_components/chat/private-chip';
import { WHISPER_DISPUTE_NOTE, WHISPER_TEAM_UNREAD_LINE, WHISPER_UNREAD_LINE, WHISPER_NOBODY_LINE } from './chat-whisper';

// Components here compile to `React.createElement` under tsx — the shape of lib/a-whisper-has-two-sides.test.ts.
(globalThis as unknown as { React: unknown }).React = React;
const h = React.createElement;
const SEND = stripComments(readFileSync(join(process.cwd(), 'app/_components/chat-send-form.tsx'), 'utf8'));
const CHIP = stripComments(readFileSync(join(process.cwd(), 'app/_components/chat/private-chip.tsx'), 'utf8'));

test('1 · one component draws every Private chip; the box draws none inline', () => {
  assert.doesNotMatch(SEND, /data-chat-private-chip/, 'the box draws its own Private chip again — two chips for one thing');
  assert.doesNotMatch(SEND, />Private</, 'the box spells "Private" in its own chip markup');
  assert.match(SEND, /if \(c\.key === 'private'\) return <PrivateChip /, 'the row does not draw Private with the one chip');
  assert.match(SEND, /<PrivateChip side=\{whisper\?\.side \?\? 'hosts'\} line=\{privateStatus\} lineOnly=\{chipsShown\} \/>/, 'the whisper status is not the one chip');
  assert.match(CHIP, /data-chat-private-chip="row"/);
  assert.match(CHIP, /data-chat-private-chip=""/);
});

test('2 · the row chip: the lock, sky when picked, its count through formatCount', () => {
  const off = renderToStaticMarkup(h(PrivateChip, { onPress: () => {}, pressed: false, count: 1234 }));
  const on = renderToStaticMarkup(h(PrivateChip, { onPress: () => {}, pressed: true, count: 3 }));
  for (const m of [off, on]) {
    assert.match(m, /^<button type="button" aria-pressed="(true|false)"/, 'the row chip is not a press');
    assert.match(m, /data-chat-kind-chip="private"/);
    assert.match(m, /lucide-lock/, 'no lock on Private');
  }
  assert.match(off, /1,234/, 'the count does not carry its commas');
  assert.match(on, /bg-\[rgb\(var\(--color-private-text\)\)\]/, 'picked Private is not sky');
  assert.doesNotMatch(on, /bg-ink/, 'picked Private is drawn ink like the other chips');
});

test('3 · while whispering: the chip, who it reaches, and the dispute ⓘ', () => {
  for (const [side, reach] of [['hosts', 'Only you, Jose and your coordinator'], ['hosts', 'You and the hosts'], ['team', 'Only your team']] as const) {
    const m = renderToStaticMarkup(h(PrivateChip, { side, line: { kind: 'reach', text: reach } }));
    assert.match(m, /data-chat-private-chip=""[^>]*><svg[^>]*lucide-lock[^>]*>[\s\S]*?<\/svg>Private<\/span>/, `${side}: no lock before Private`);
    assert.ok(m.includes(reach), `${side}: the line does not say who it reaches`);
    assert.match(m, new RegExp(`data-chat-whisper-reach="${side}"`));
    assert.match(m, /data-chat-whisper-line="on"/);
    assert.match(m, /color-private/, 'not the sky private look');
    assert.ok(m.includes(WHISPER_DISPUTE_NOTE) || /Who sees this/.test(m), 'no dispute ⓘ');
  }
});

test('4 · a failed read says it failed; nobody says nobody — two different states', () => {
  for (const text of [WHISPER_UNREAD_LINE, WHISPER_TEAM_UNREAD_LINE]) {
    const m = renderToStaticMarkup(h(PrivateChip, { side: 'team', line: { kind: 'failed', text } }));
    assert.match(m, /data-chat-whisper-line="failed"/);
    assert.match(m, /data-chat-whisper-read-failed=""/);
    assert.match(text, /^Couldn/, 'the failure is not said as a failure');
    assert.doesNotMatch(m, /No one|No co-host|nobody/i, 'a failed read is said as "no one"');
  }
  const nobody = renderToStaticMarkup(h(PrivateChip, { side: 'hosts', line: { kind: 'nobody', text: WHISPER_NOBODY_LINE } }));
  assert.match(nobody, /data-chat-whisper-line="nobody"/);
  assert.doesNotMatch(nobody, /data-chat-whisper-read-failed/);
  // The box maps them from the page's own read: `unread` → failed, else nobody — with the one rule, `whisperBlockedLine`.
  assert.match(SEND, /\? \{ kind: whisper\.unread \? 'failed' : 'nobody', text: privateBlocked \}/);
  assert.match(SEND, /if \(canWhisper && !whisperOn && whisper && !whisperBlockedLine\(whisper\)\) \{/, 'picking Private where a whisper cannot start still flips the switch');
});

test('5 · with the row out, the status is the line only — never a second chip', () => {
  const m = renderToStaticMarkup(h(PrivateChip, { side: 'team', line: { kind: 'reach', text: 'Only your team' }, lineOnly: true }));
  assert.doesNotMatch(m, /data-chat-private-chip/);
  assert.ok(m.includes('Only your team'));
});
