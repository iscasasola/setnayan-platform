/**
 * 🧾 OWN-01 (live 14 Nov) — the app half of "a first-N offer counts its earlier uses" (the database half:
 * tests/db/a-first-n-offer-counts-its-earlier-uses.db.test.ts). A Discount filled in from a card's offer NAMES the offer
 * (`from_offer_id`), the name survives the send's rebuild and a revision, and a refusal reaches the supplier in words.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { keepLineStructure, lineStructureOf } from './quote-line-structure';
import { seedQuoteRevision } from './quote-revision-seed';
import { offerTakenRefusal } from './offer-taken';
import { stripComments } from './strip-comments';

const code = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));

test('the send keeps the offer a Discount came from', () => {
  assert.deepEqual(lineStructureOf({ label: 'Discount', amount_centavos: -500000, from_offer_id: 'S89F-ABC' }), { from_offer_id: 'S89F-ABC' });
  const before = [{ label: 'Discount', detail: 'First 1 · ₱5,000 off', amount_centavos: -500000, from_offer_id: 'S89F-ABC' }];
  const after = keepLineStructure(before, [{ label: 'Discount', detail: 'First 1 · ₱5,000 off', amount_centavos: -500000 }]);
  assert.equal(after[0]!.from_offer_id, 'S89F-ABC', 'the rebuild dropped the offer — the count would never see this couple');
});

test('a revision keeps it as the Discount (never as a second offer line)', () => {
  const seed = seedQuoteRevision({
    public_id: 'S89J-1', title: 'Quote', total_centavos: 4000000, status: 'sent', sent_at: null, rendered_body: '', valid_until: null,
    line_items: [
      { label: 'Reception Lights & Sound', amount_centavos: 4500000 },
      { label: 'Discount', detail: 'First 1 · ₱5,000 off', amount_centavos: -500000, from_offer_id: 'S89F-ABC' },
    ],
    payment_method_ids: [], payment_schedule: null, includes_setnayan_gift: null, merge_snapshot: null,
  } as never);
  assert.equal(seed.discountPhp, 5000);
  assert.equal(seed.offer, null, 'a filled-in discount came back as an applied offer');
  assert.equal(seed.discountOfferId, 'S89F-ABC');
});

test('the maker stamps the card’s offer on its Discount, and a revision starts from it', () => {
  const maker = code('app/_components/proposal-maker.tsx');
  assert.match(maker, /\.\.\.\(cardOfferId \? \{ from_offer_id: cardOfferId \} : \{\}\)/);
  assert.match(maker, /useState<string \| null>\(\(\) => revision\?\.discountOfferId \?\? null\)/);
});

test('a used-up offer is said in words, never "please try again"', () => {
  const msg = offerTakenRefusal({ message: 'vendor_proposals: OFFER_TAKEN — "December first couple" was for the first 1 couple(s), and they have it' });
  assert.equal(msg, '“December first couple” was for the first couple, and they have it. Take the offer off this quote, then send.');
  assert.equal(offerTakenRefusal({ message: 'something else' }), null);
  const send = code('lib/proposal-send.ts');
  assert.equal((send.match(/const taken = offerTakenRefusal\(sendErr\);/g) ?? []).length, 2, 'both send paths say it');
  assert.match(code('app/vendor-dashboard/messages/[threadId]/page.tsx'), /proposal_offer_taken:/);
});
