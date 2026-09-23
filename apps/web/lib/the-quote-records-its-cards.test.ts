import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * THE QUOTE RECORDS WHICH SERVICE CARDS IT WAS BUILT FROM.
 *
 * The read side is decided and executed in `lib/offered-service-card-state.ts`.
 * This file guards the WRITE chain, which is four files of plumbing no unit test
 * can import (a client component, a server action, a server-only module), so it
 * is asserted from source — exactly as `the-gift-switch-reaches-the-bill.test.ts`
 * guards the same chain for the gift switch.
 *
 * 🔑 WHY A CHAIN GUARD AND NOT A RULE TEST. Every link is individually
 * unremarkable and the value is silently lost if ANY of them drops it: the
 * composer stops sending, the action stops parsing, the core stops accepting, the
 * insert stops storing. Each break leaves every other test green and the column
 * permanently NULL — which reads exactly like "no quote has said yet".
 *
 * Sabotages watched red before commit:
 *   1. composer stops sending the picked ids
 *   2. action forwards but never parses them
 *   3. insert stores `?? []` instead of `?? null`
 */

const ROOT = join(process.cwd());
const maker = readFileSync(join(ROOT, 'app/_components/proposal-maker.tsx'), 'utf8');
const action = readFileSync(
  join(ROOT, 'app/vendor-dashboard/messages/[threadId]/proposal-actions.ts'),
  'utf8',
);
const send = readFileSync(join(ROOT, 'lib/proposal-send.ts'), 'utf8');

test('1 · the composer sends the cards it actually loaded', () => {
  assert.match(
    maker,
    /serviceCardIds:\s*cards\.filter\(\(c\) => pickedCards\[c\.id\]\)\.map\(\(c\) => c\.id\)/,
    'the builder stopped sending which cards it was built from — the thread goes back to ' +
      'guessing with a timestamp and retires offers no quote covered',
  );
});

test('2 · the action parses an ARRAY and forwards it', () => {
  assert.match(action, /serviceCardIds\?: unknown;/, "the payload shape admits it");
  assert.match(
    action,
    /serviceCardIds = Array\.isArray\(parsed\.serviceCardIds\)/,
    'only an array is a statement — absent or junk must read as "never said", never as ' +
      '"this quote covered nothing"',
  );
  assert.match(action, /\n\s+serviceCardIds,\n/, 'and it reaches the send core');
});

test('3 · the core accepts it and stores NULL, never an empty array', () => {
  assert.match(send, /serviceCardIds\?: string\[\] \| null;/, 'the core accepts it');
  assert.match(
    send,
    /service_card_ids: input\.serviceCardIds \?\? null,/,
    'the insert dropped the ids, or defaulted them',
  );
  assert.doesNotMatch(
    send,
    /service_card_ids: input\.serviceCardIds \?\? \[\]/,
    'storing [] would make an older client assert it covered no card — a decision nobody made',
  );
});

test('4 · the template path does NOT claim to know, and that is deliberate', () => {
  // `sendProposalCore` sends a saved template/package and has no card picker, so
  // it genuinely cannot say which cards a quote covers. NULL is the honest value
  // there. This pins the decision so nobody later wires it with a guess.
  const custom = send.indexOf('export async function sendCustomProposalCore(');
  assert.ok(custom > 0, 'sendCustomProposalCore moved — re-point this guard');
  const templateHalf = send.slice(0, custom);
  assert.equal(
    (templateHalf.match(/service_card_ids/g) ?? []).length,
    0,
    'the template path started writing service_card_ids — it has no picker, so any value ' +
      'it writes is invented',
  );
  // and the custom half must be the one that does
  assert.ok(
    send.slice(custom).includes('service_card_ids'),
    'the custom builder path stopped recording its cards',
  );
});
