/**
 * ONE EVENT, ONE CHAT TITLE — "<first name>'s <Kind> (<Mon D>)", from one formatter, in the three places a supplier
 * reads it (owner 2026-10-28: *"User's event (date)"*; DECISION_LOG 84b87fe8 — by EVENT, never merged by person).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { eventChatTitle, eventRowTitle, firstNameOf } from './event-chat-title';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const NOW = Date.parse('2026-10-28T04:00:00Z');

test('the words: first name · kind · (Mon D), year only when not this year', () => {
  assert.equal(eventChatTitle({ name: 'Indalecio Casasola', kind: 'Wedding', date: '2026-12-18', nowMs: NOW }), "Indalecio's Wedding (Dec 18)");
  assert.equal(eventChatTitle({ name: 'Indalecio Casasola', kind: 'Wedding', date: '2027-12-18', nowMs: NOW }), "Indalecio's Wedding (Dec 18, 2027)");
  assert.equal(eventChatTitle({ name: 'Ana & Miguel', kind: 'Wedding', date: '2026-12-18', nowMs: NOW }), "Ana's Wedding (Dec 18)");
  assert.equal(eventChatTitle({ name: "Ana's Debut", kind: 'Debut', date: '2027-03-02', nowMs: NOW }), "Ana's Debut (Mar 2, 2027)");
  assert.equal(eventChatTitle({ name: null, kind: 'Wedding', date: '2026-12-18', nowMs: NOW }), 'Wedding (Dec 18)');
  assert.equal(eventChatTitle({ name: 'Indalecio', kind: null, date: null, nowMs: NOW }), "Indalecio's Event (date not set)");
  assert.equal(firstNameOf('  Claire and Ice '), 'Claire');
});

test('the same person, two events → two titles (never merged)', () => {
  const a = eventChatTitle({ name: 'Indalecio Casasola', kind: 'Wedding', date: '2026-12-18', nowMs: NOW });
  const b = eventChatTitle({ name: 'Indalecio Casasola', kind: 'Anniversary', date: '2027-12-18', nowMs: NOW });
  assert.notEqual(a, b);
});

test('the Customers row reads the one ROW formatter — the event\'s whole name · kind · day, from the chat title\'s own date words', () => {
  // 2026-10-30 (owner 2026-10-29 "CUSTOMERS ARE EVENTS, NOT PEOPLE": "one row per event, e.g. 'Indalecio & Claire ·
  // Wedding · Dec 18'"; re-reported 2026-10-30 "Customers still show people and not events"): the Events row is the
  // EVENT, so it carries both hosts' names — "Indalecio's Wedding (Dec 18)" read as one person. Its chat keeps the
  // owner's 2026-10-28 chat words below; both read the one date formatter, so they can never name two different days.
  const s = read('app/vendor-dashboard/customers/_components/customers-roster.tsx');
  assert.match(s, /import \{[^}]*\beventRowTitle\b[^}]*\} from '@\/lib\/event-chat-title';/, 'the Customers row does not use the one row title');
  assert.ok((s.match(/\beventRowTitle\(/g) ?? []).length >= 1, 'the Customers row imports the row title but never draws it');
  assert.equal(eventRowTitle({ name: 'Indalecio & Claire', kind: 'Wedding', date: '2026-12-18', nowMs: NOW }), 'Indalecio & Claire · Wedding · Dec 18');
  assert.equal(eventRowTitle({ name: 'Indalecio & Claire', kind: 'Wedding', date: '2027-12-18', nowMs: NOW }), 'Indalecio & Claire · Wedding · Dec 18, 2027');
  assert.equal(eventRowTitle({ name: 'Reyes debut', kind: 'Debut', date: '2026-10-03', nowMs: NOW }), 'Reyes debut · Oct 3');
  assert.equal(eventRowTitle({ name: null, kind: 'Wedding', date: '2026-12-18', nowMs: NOW }), 'Wedding · Dec 18');
  assert.equal(eventRowTitle({ name: 'Indalecio & Claire', kind: null, date: null, nowMs: NOW }), 'Indalecio & Claire · date not set');
  // The same day words as the chat it opens.
  assert.ok(eventChatTitle({ name: 'Ana', kind: 'Debut', date: '2027-03-02', nowMs: NOW }).endsWith('(Mar 2, 2027)'));
  assert.ok(eventRowTitle({ name: 'Ana', kind: 'Debut', date: '2027-03-02', nowMs: NOW }).endsWith('· Mar 2, 2027'));
});

test('the supplier inbox row and the supplier thread head read the one chat formatter', () => {
  for (const rel of [
    // 2026-10-28: the supplier inbox (the Messages fold) IS the Customers list now; its archived and closed chats are
    // named on the Customers page itself.
    'app/vendor-dashboard/customers/page.tsx',
    'app/vendor-dashboard/messages/[threadId]/page.tsx',
  ]) {
    const s = read(rel);
    assert.match(s, /import \{[^}]*\beventChatTitle\b[^}]*\} from '@\/lib\/event-chat-title';/, `${rel} does not use the one chat title`);
    assert.ok((s.match(/\beventChatTitle\(/g) ?? []).length >= 1, `${rel} imports the title but never draws it`);
  }
});

test('a Customers row with a chat opens THAT event\'s chat (full screen); a row without one keeps the customer card', () => {
  const s = read('app/vendor-dashboard/customers/_components/customers-roster.tsx');
  const fn = s.slice(s.indexOf('export function hrefFor('), s.indexOf('\n}\n', s.indexOf('export function hrefFor(')));
  assert.match(fn, /if \(r\.threadId\) \{\s*const href = `\/vendor-dashboard\/messages\/\$\{r\.threadId\}`;\s*return href;/, 'a row with a chat does not open the chat');
  assert.match(fn, /const href = `\/vendor-dashboard\/clients\/\$\{r\.eventId\}\?tab=details`;/, 'a row with no chat lost its customer card');
});
