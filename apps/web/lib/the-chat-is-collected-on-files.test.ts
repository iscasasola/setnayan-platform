/**
 * 📥 PIECE 3c — EVERYTHING SHARED IN THE CHAT IS COLLECTED ON FILES, SORTED BY KIND (DECISION_LOG 2026-11-12;
 * prototype legend row 143). A document → This booking · a photo/video → From the chat · not filed yet · a link →
 * Links (a video link wears a play mark). Only FILED photos count and can reach the shop; the Hub never shows unfiled
 * chat photos; a dropped or pasted file rides the composer's ONE attachment input; while private, words only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('links are read out of the words — http(s) only, trailing punctuation dropped, each once', async () => {
  const { linksIn, siteOf } = await import('./supplier-files');
  assert.deepEqual(linksIn('Tasting video: https://youtu.be/abc123. Menu at https://rosa.ph/menu, and https://youtu.be/abc123!'), [
    'https://youtu.be/abc123',
    'https://rosa.ph/menu',
  ]);
  assert.deepEqual(linksIn('no link here · javascript:alert(1)'), []);
  assert.equal(siteOf('https://www.youtube.com/watch?v=x'), 'youtube.com');
});

test('a chat file is sorted by kind, and a filed one leaves "not filed yet"', () => {
  const srv = read('lib/supplier-files.server.ts');
  const fn = srv.slice(srv.indexOf('export async function readChatCollected'));
  assert.match(fn, /grp: kind === 'document' \? 'booking' : 'unfiled'/, 'a chat document no longer lands in This booking');
  assert.match(fn, /!args\.filedMessageIds\.has\(m\.message_id\)/, 'a filed chat photo stays under "not filed yet" too');
  assert.match(fn, /grp: 'links'/);
  assert.match(fn, /url: `\/api\/chat\/attachment\/\$\{m\.message_id\}`/, 'a chat file is opened some way other than the route that re-proves the reader');
});

test('the Hub never shows unfiled chat photos; Files reads the chat, the Hub does not', () => {
  const sec = read('app/vendor-dashboard/clients/[eventId]/_pages/event-files.tsx');
  assert.match(sec, /mode === 'files' \? readChatCollected\(/, 'the Hub reads the chat');
  const board = read('app/vendor-dashboard/clients/[eventId]/_components/event-files-board.tsx');
  assert.match(board, /if \(p\.mode === 'hub' && !\(f\.grp === 'service' \|\|/);
});

test('"File under a service": only the shop’s OWN chat photo, only a quoted service, the server measures the bytes', () => {
  const act = read('app/_actions/event-files-actions.ts');
  const op = act.slice(act.indexOf("if (op === 'filechat')"), act.indexOf("if (op === 'remove')"));
  assert.match(op, /if \(m\.sender_role !== 'vendor'\) return/, 'a couple’s chat photo can be filed as the supplier’s event photo');
  assert.match(op, /m\.event_id !== eventId \|\| m\.vendor_profile_id !== shop/, 'a message of another event or shop can be filed here');
  assert.match(op, /sha = createHash\('sha256'\)\.update\(bytes\)\.digest\('hex'\)/);
  assert.match(op, /if \(had\) mediaId = /, 'bytes already stored are copied again instead of linked');
  assert.match(op, /grp: 'service'/);
});

test('a dropped or pasted file rides the ONE attachment input; while private, words only', () => {
  const form = read('app/_components/chat-send-form.tsx');
  assert.match(form, /onDrop=\{\(e\) => \{[\s\S]*?takeDropped\(e\.dataTransfer\.files\);/, 'a dropped file is not attached');
  assert.match(form, /if \(privateTo \|\| e\.defaultPrevented\) return;[\s\S]{0,120}if \(!dt\.files\.length\) return;\s*e\.preventDefault\(\);\s*takeDropped\(dt\.files\);/, 'a pasted file is not attached');
  const take = form.slice(form.indexOf('const takeDropped'), form.indexOf('function attachFile'));
  assert.match(take, /if \(privateTo\) \{\s*setFileError\(PRIVATE_WORDS_ONLY_MESSAGE\);/, 'a private message took a file');
  assert.match(form, /Drop to send/);
});
