/**
 * 🧾 A SUPPLIER'S CHANGE TO WHAT THE COUPLE BOUGHT IS THE COUPLE'S TO APPROVE (DECISION_LOG 2026-11-07, "A SUPPLIER'S
 * CORRECTION: CONTACT DETAILS ONLY NOTIFY; A PRICE OR SERVICE CHANGE NEEDS THE COUPLE'S APPROVAL"). Owner, verbatim:
 * *"couple only gets a price change, or service change on their purchase gets changed, needs approval."*
 *
 * Fails if:
 *   1 · the rule stops seeing a price the supplier moved, or a service they took off the couple's booking;
 *   2 · a service the SUPPLIER ADDED to their own shop ever asks the couple (owner: *"if the supplier creates multiple
 *       services that is not included to the package is not something the customer needs to approve"*);
 *   3 · the lines stop carrying the signed difference the shipped card and Deal math read;
 *   4 · the claim finish stops staging the change from `theirs` (the couple's cards, after `splitClaimCards`) against
 *       the record read on the SERVER, or stages it for Setnayan's own invite (no couple, nothing bought);
 *   5 · the couple's answer stops delivering it on Approve (after the RPC that books) or withdrawing it on Decline;
 *   6 · the change is written onto the couple's booking (`event_vendors`) instead of being proposed, a staged row
 *       carries a conversation (so it would be drawn before the couple let the supplier in), or the deliverer picks up
 *       a row that is already in a chat.
 *
 * SABOTAGE (each seen red, restored): stage `added` instead of `theirs` · drop the `!c.bundled` filter · deliver on
 * Decline · write `event_vendors` from the server half · stage with a thread id.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { splitClaimCards } from './claim-door';
import {
  hasPurchaseChange,
  purchaseChange,
  purchaseChangeCardBody,
  purchaseChangeItems,
  purchaseChangeNote,
  purchaseChangeNotice,
} from './supplier-purchase-change';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function body(src: string, fn: string): string {
  const at = src.search(new RegExp(`\\n(export )?async function ${fn}\\(`));
  assert.ok(at >= 0, `${fn} not found`);
  const rest = src.slice(at + 1);
  const next = rest.slice(1).search(/\n(export )?(async )?function /);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

const recorded = [
  { category: 'photographer', label: 'Photographer' },
  { category: 'photo_booth', label: 'Photo booth' },
];

test('1 · the rule sees a moved price and a removed service — and nothing when the supplier changed neither', () => {
  // The door's seed: the first card carries the whole confirmed price, the rest are part of that bundle.
  const asSeeded = [
    { category: 'photographer', price: 80_000, bundled: false },
    { category: 'photo_booth', price: null, bundled: true },
  ];
  const same = purchaseChange({ recordPrice: 80_000, recorded, confirmed: asSeeded });
  assert.equal(hasPurchaseChange(same), false, 'an untouched record must not ask the couple anything');

  const raised = purchaseChange({
    recordPrice: 80_000,
    recorded,
    confirmed: [{ ...asSeeded[0]!, price: 90_000 }, asSeeded[1]!],
  });
  assert.deepEqual(raised.price, { from: 80_000, to: 90_000 });
  assert.deepEqual(raised.removed, []);

  const dropped = purchaseChange({ recordPrice: 80_000, recorded, confirmed: [asSeeded[0]!] });
  assert.equal(dropped.price, null, 'removing a bundled service does not by itself move the bundle price');
  assert.deepEqual(dropped.removed, [{ category: 'photo_booth', label: 'Photo booth' }]);

  // A second card priced on its own adds to what the supplier states for the couple's purchase.
  const split = purchaseChange({
    recordPrice: 80_000,
    recorded,
    confirmed: [asSeeded[0]!, { category: 'photo_booth', price: 15_000, bundled: false }],
  });
  assert.deepEqual(split.price, { from: 80_000, to: 95_000 });

  // A bundled card is part of the first card's price — a stale figure left on it is not the supplier's price.
  assert.equal(
    purchaseChange({ recordPrice: 80_000, recorded, confirmed: [asSeeded[0]!, { category: 'photo_booth', price: 15_000, bundled: true }] }).price,
    null,
  );

  // Nothing to compare: a couple who recorded no price, or a supplier who priced nothing.
  assert.equal(purchaseChange({ recordPrice: null, recorded, confirmed: asSeeded }).price, null);
  assert.equal(
    purchaseChange({ recordPrice: 80_000, recorded, confirmed: asSeeded.map((c) => ({ ...c, price: null })) }).price,
    null,
  );
});

test('2 · a service the supplier ADDED to their own shop never asks the couple', () => {
  const posted = [
    { category: 'photographer', price: 80_000, bundled: false, fromRecord: true },
    { category: 'photo_booth', price: null, bundled: true, fromRecord: true },
    // Added on the door — priced on its own, even claiming to be bundled / from the record.
    { category: 'drone', price: 25_000, bundled: true, fromRecord: true },
    { category: 'same_day_edit', price: 30_000, bundled: false, fromRecord: false },
  ];
  const { theirs } = splitClaimCards(posted, new Set(recorded.map((s) => s.category)));
  const change = purchaseChange({ recordPrice: 80_000, recorded, confirmed: theirs });
  assert.equal(hasPurchaseChange(change), false, 'the supplier’s own new cards must not reach the couple as a change');
});

test('3 · the lines carry the signed difference the shipped card reads', () => {
  const up = purchaseChangeItems({ price: { from: 80_000, to: 90_000 }, removed: [] });
  assert.equal(up.length, 1);
  assert.equal(up[0]!.kind, 'addon');
  assert.equal(up[0]!.amount_php, 10_000);
  assert.match(up[0]!.label, /90,000/);
  assert.match(up[0]!.label, /80,000/);

  const down = purchaseChangeItems({ price: { from: 80_000, to: 70_000 }, removed: [{ category: 'photo_booth', label: 'Photo booth' }] });
  assert.equal(down[0]!.kind, 'discount');
  assert.equal(down[0]!.amount_php, -10_000);
  assert.deepEqual(down[1], { kind: 'request', label: 'Remove from your booking: Photo booth', amount_php: null });

  assert.match(purchaseChangeNote('Kusina ni Lola'), /^Kusina ni Lola .*Nothing changes until you accept\.$/);
  assert.match(purchaseChangeNote(null), /^Your supplier /);
  assert.equal(purchaseChangeCardBody(1), '🧾 Deal — 1 item');
  assert.equal(purchaseChangeCardBody(2), '🧾 Deal — 2 items');
  const n = purchaseChangeNotice({ eventId: 'e1', threadId: 't1', shopName: 'Alon Films' });
  assert.equal(n.relatedUrl, '/dashboard/e1/messages/t1');
  assert.match(n.title, /^Alon Films asks to change your booking$/);
});

test('4 · the claim finish stages the change from the couple’s cards against the record read on the server', () => {
  const fn = body(read('app/open-shop/claim-actions.ts'), 'finishClaimDoor');
  const split = fn.indexOf('splitClaimCards(answers.cards, recorded)');
  const stage = fn.search(/await stagePurchaseChange\(admin, \{/);
  assert.ok(split >= 0 && stage > split, 'the change must be staged after the post is split into theirs / added');
  const call = fn.slice(stage, fn.indexOf('});', fn.indexOf('purchaseChange({', stage)) + 3);
  assert.match(call, /confirmed: theirs\b/, 'only the couple’s cards are compared — never the supplier’s added ones');
  assert.match(call, /recordPrice: recordRead\.record\.price/, 'the couple’s price is read on the server, never taken from the post');
  assert.match(call, /recorded: recordRead\.record\.services/, 'the couple’s services are read on the server');
  const guard = fn.slice(fn.lastIndexOf('if (', stage), stage);
  assert.match(guard, /!fromSetnayan/, 'Setnayan’s own invite has no couple and nothing bought — it must not stage a change');
});

test('5 · Approve delivers it after the RPC that books; Decline withdraws it', () => {
  const fn = body(read('app/dashboard/[eventId]/access-requests/actions.ts'), 'answerClaimAccess');
  const rpc = fn.indexOf("rpc('answer_claim_access_request'");
  const deliver = fn.search(/await deliverPurchaseChange\(admin, \{/);
  const withdraw = fn.search(/await withdrawStagedPurchaseChange\(admin, \{/);
  assert.ok(rpc >= 0 && deliver > rpc, 'the change reaches the chat only after the approval booked the supplier');
  const deliverGuard = fn.slice(fn.lastIndexOf('if (', deliver), deliver);
  assert.match(deliverGuard, /approve && result\.granted/, 'only a granted approval delivers the change');
  assert.ok(withdraw > deliver, 'Decline must withdraw what was staged');
  const withdrawGuard = fn.slice(fn.lastIndexOf('if (', withdraw), withdraw);
  assert.match(withdrawGuard, /!approve/, 'only a Decline withdraws');
});

test('6 · proposed, never written onto the booking; staged on no conversation; delivered only from staged', () => {
  const src = read('lib/supplier-purchase-change.server.ts');
  assert.doesNotMatch(src, /from\('event_vendors'\)/, 'a change to what the couple bought is proposed, never written onto their booking');
  assert.doesNotMatch(src, /from\('event_manual_vendors'\)/, 'the couple’s hand-typed card is never touched');

  const stage = body(src, 'stagePurchaseChange');
  assert.match(stage, /from\('proposal_amendments'\)\s*\.insert\(\{[^}]*thread_id: null/, 'a staged change must carry no conversation');
  assert.match(stage, /raised_by: 'vendor'/, 'the supplier raises it — the couple is the one who answers');
  assert.match(stage, /status: 'proposed'/);

  const deliver = body(src, 'deliverPurchaseChange');
  assert.match(deliver, /staged\(admin, args\.eventId, args\.shopId\)/, 'only a staged change is delivered');
  assert.match(src, /\.is\('thread_id', null\)/, 'staged means on no conversation yet');
  assert.match(deliver, /from\('chat_messages'\)\.insert\(\{[\s\S]*amendment_id: row\.amendment_id/, 'the shipped amendment card is posted');

  // Every reader of amendments is thread-scoped — which is what keeps a staged row invisible until Approve.
  assert.match(read('lib/chat-pin-facts.server.ts'), /from\('proposal_amendments'\)[\s\S]{0,120}\.eq\('thread_id', args\.threadId\)/);
});
