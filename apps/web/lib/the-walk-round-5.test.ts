/**
 * 🚶 ROUND 5 — the end-to-end fee walk, 13 Nov 2026 (RW-22 · RW-24 · RW-26 · RW-30). Each test names the walk row.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { quoteSentKey, QUOTE_SENT_NOTICES } from './quote-card-return';
import { offerDayWords } from './personal-invite-offer';

const WEB = join(import.meta.dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('RW-22 · the supplier record an inquiry writes carries the thread’s source', () => {
  const src = code('app/v/[slug]/inquiry-actions.ts');
  assert.match(src, /\.from\('chat_threads'\)\s*\.select\('inquiry_source'\)\s*\.eq\('thread_id', threadId\)/);
  assert.match(src, /\.\.\.\(threadSource \? \{ source: threadSource \} : \{\}\)/, 'the insert carries it');
  assert.match(src, /if \(!\(evRow as \{ source\?: string \| null \}\)\.source && threadSource\) patch\.source = threadSource;/, 'an existing row only while empty');
  const page = code('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.match(page, /SUPPLIER_BROUGHT_SOURCES\.has\(completion\.source\)\) \|\| completion\?\.source === 'website'/, 'the badge reads the same sets as the fee');
});

test('RW-24 · a refused quote says why on a pending inquiry, and the built quote is kept', () => {
  const page = code('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.match(page, /data-proposal-notice="pending"/);
  assert.match(page, /Say yes to this inquiry first — a quote goes on an open conversation\. Nothing was sent; your quote is kept on this device\./);
  const maker = code('app/_components/proposal-maker.tsx');
  assert.match(maker, /onSubmit=\{keepQuoteOnSend\}/);
  assert.match(maker, /if \(restoreQuoteAfterRefusal\(\)\) return;/);
  assert.equal(quoteSentKey('t1'), 'sn-quote-sent:t1');
  assert.deepEqual([...QUOTE_SENT_NOTICES].sort(), ['proposal_sent', 'proposal_sent_no_card']);
});

test('RW-26 · the couple’s booking button reads the live switch before the press', () => {
  const stream = code('app/_components/chat-message-stream.tsx');
  assert.match(stream, /quoteState\.offerLock && lockTarget && !bookingsOpen \?/);
  assert.match(stream, /\{BOOKINGS_OPEN_SOON\}/);
  assert.match(code('app/dashboard/[eventId]/messages/[threadId]/page.tsx'), /bookingsOpen=\{quoteLockTarget \? await areBookingsOpen\(\) : true\}/);
});

test('RW-30 · the Plan page says every date one way, the Manila day', () => {
  const screen = code('app/vendor-dashboard/subscription/_components/plan-screen.tsx');
  assert.match(screen, /timeZone: 'Asia\/Manila'/);
  assert.match(screen, /return offerDayWords\(manilaDay\);/);
  assert.equal(offerDayWords('2026-12-12'), '12 Dec 2026');
});
