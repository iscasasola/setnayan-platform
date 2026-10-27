/**
 * A SENT MESSAGE SHOWS AT ONCE, AND SAYS SO IF IT DID NOT GO (owner 2026-10-27, "CHAT MUST BE EFFICIENT AND FAST";
 * chat prototype 2026-10-28 frame B: "Sending…" under the faded last bubble → "Delivered"; owner 2026-10-28 *"yes show
 * seen"* → "Seen"). See `lib/chat-optimistic.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { lastOwnLine, matchesPending, settlePendings, type PendingSend } from './chat-optimistic';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const T0 = Date.parse('2026-10-28T02:00:00Z');
const pending = (over: Partial<PendingSend> = {}): PendingSend => ({
  tempId: 'p1', threadId: 't', body: 'See you there', fileName: null, at: T0, state: 'sending', ...over,
});
const row = (over: Record<string, unknown> = {}) => ({
  sender_role: 'couple', body: 'See you there', created_at: new Date(T0 + 400).toISOString(), attachment_name: null, ...over,
});

test('a pending bubble is settled only by ITS row: same side, same words, same file, not an old one', () => {
  assert.equal(matchesPending(row(), pending(), 'couple'), true);
  assert.equal(matchesPending(row({ sender_role: 'vendor' }), pending(), 'couple'), false, 'their row settled mine');
  assert.equal(matchesPending(row({ body: 'See you' }), pending(), 'couple'), false);
  assert.equal(matchesPending(row({ body: '' }), pending({ body: '', fileName: 'a.jpg' }), 'couple'), false, 'a file-less row settled a file');
  assert.equal(matchesPending(row({ created_at: new Date(T0 - 3_600_000).toISOString() }), pending(), 'couple'), false, 'an hour-old twin settled it');
  // Two identical sends need two rows.
  const two = [pending({ tempId: 'a' }), pending({ tempId: 'b' })];
  assert.deepEqual(settlePendings(two, [row()], 'couple').map((p) => p.tempId), ['b']);
});

test('the line under your last message: Sending… · Not sent · Delivered · Seen · nothing when they spoke last', () => {
  const mine = { sender_role: 'couple', created_at: new Date(T0).toISOString() };
  assert.deepEqual(lastOwnLine({ lastStored: mine, pendings: [pending()], viewerRole: 'couple', theirLastReadAt: null }), { kind: 'sending' });
  assert.deepEqual(lastOwnLine({ lastStored: mine, pendings: [pending({ state: 'failed' })], viewerRole: 'couple', theirLastReadAt: null }), { kind: 'failed', tempId: 'p1' });
  assert.deepEqual(lastOwnLine({ lastStored: mine, pendings: [], viewerRole: 'couple', theirLastReadAt: null }), { kind: 'delivered' });
  assert.deepEqual(lastOwnLine({ lastStored: mine, pendings: [], viewerRole: 'couple', theirLastReadAt: new Date(T0 - 1).toISOString() }), { kind: 'delivered' }, 'a read BEFORE the message said Seen');
  assert.deepEqual(lastOwnLine({ lastStored: mine, pendings: [], viewerRole: 'couple', theirLastReadAt: new Date(T0 + 1).toISOString() }), { kind: 'seen' });
  assert.equal(lastOwnLine({ lastStored: { ...mine, sender_role: 'vendor' }, pendings: [], viewerRole: 'couple', theirLastReadAt: null }), null);
});

test('the composer paints BEFORE the server answers, and a failure is said in words with Try again', () => {
  const send = read('app/_components/chat-send-form.tsx');
  const painted = send.indexOf('new CustomEvent(CHAT_PENDING_EVENT');
  const delivered = send.indexOf('void deliver(formData, pending, hasFile)');
  assert.ok(painted > 0 && delivered > painted, 'the pending bubble is not dispatched before the send is started');
  assert.match(send, /new CustomEvent\(CHAT_SETTLED_EVENT/, 'the composer never says how a send ended');
  assert.match(send, /registerRetry\(pending\.tempId/, 'a failed send cannot be tried again');
  const stream = read('app/_components/chat-message-stream.tsx');
  assert.match(stream, /addEventListener\(CHAT_PENDING_EVENT/, 'the stream does not paint pending bubbles');
  assert.match(stream, /CONFIRM_WINDOW_MS/, 'an ok with no stored row would stay "Sending…" forever — or worse, vanish');
  assert.match(stream, />\s*Try again\s*</, 'a failed send has no Try again');
  assert.match(stream, /LAST_LINE_WORDS\[line\.kind\]/, 'the last line is not drawn from the one rule');
});

test('Seen is read once, as one timestamp, after the page proved the viewer is in the thread', () => {
  const r = read('lib/chat-thread-receipts.server.ts');
  assert.match(r, /^import 'server-only';/m, 'the receipts read could ship to the browser');
  assert.match(r, /\.from\('chat_thread_reads'\)\s*\.select\('last_read_at'\)/, 'the receipts read more than the one timestamp');
  assert.match(r, /\.limit\(1\)/, 'the receipts read more than one row');
  for (const p of ['app/dashboard/[eventId]/messages/[threadId]/page.tsx', 'app/vendor-dashboard/messages/[threadId]/page.tsx']) {
    assert.match(read(p), /theirLastReadAt=\{receipts\.theirLastReadAt\}/, `${p} does not hand the stream its Seen`);
  }
  // A shop member's name rides only a REVEALED shop (the mask would otherwise be undone by a person's name).
  assert.match(r, /args\.viewerRole === 'couple' && args\.revealed/, 'a masked shop leaks its staff names');
});
