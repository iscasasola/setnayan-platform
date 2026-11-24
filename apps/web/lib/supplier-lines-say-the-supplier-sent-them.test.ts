/**
 * 🗣 A SUPPLIER'S LINE SAYS THE SUPPLIER SENT IT (supplier walk on live, 24 Nov 2026; controller brief).
 *
 * Measured on live: Today › Needs you today said "Reply to TEST SetnaProd walk · 'Quote ₱6,750 sent' · waiting
 * 10 days". The last line in that thread was the SUPPLIER'S OWN quote. The quote insert named no side, so the
 * database derived it "couple first" (`chat_messages` sender trigger) and, on an account that is also the event's
 * host, stamped the quote as the couple's — so `threadOwesReply` read it as somebody waiting.
 *
 * Fails if a supplier-only writer stops asking for `sent_as: 'vendor'`.
 * SABOTAGE (seen red, restored): drop `sent_as: 'vendor'` from lib/proposal-send.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { threadOwesReply } from './answers-desk';

const WEB = join(__dirname, '..');
const SUPPLIER_WRITERS = [
  'lib/proposal-send.ts',
  'lib/offer-service-core.ts',
  'app/vendor-dashboard/forms/actions.ts',
  'app/vendor-dashboard/messages/[threadId]/questions-actions.ts',
];

for (const file of SUPPLIER_WRITERS) {
  test(`${file} posts its chat line as the supplier`, () => {
    const src = readFileSync(join(WEB, file), 'utf8');
    const insert = src.slice(src.indexOf(".from('chat_messages').insert("));
    assert.ok(insert.length > 0, 'the chat insert moved');
    assert.match(insert.slice(0, 900), /sent_as: 'vendor'/);
  });
}

test('the supplier’s own last line owes nobody a reply', () => {
  assert.equal(threadOwesReply('vendor'), false);
  assert.equal(threadOwesReply('couple'), true);
});
