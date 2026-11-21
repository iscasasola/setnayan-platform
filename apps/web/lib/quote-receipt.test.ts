/**
 * 🧾 THE QUOTE AS A RECEIPT IN THE CHAT (Unichat part C, owner 20 Nov 2026 — drawing UNICHAT-LIVE-2026-11-19, the quote
 * tool). The receipt holds the quote maker's real parts and must price them the maker's way.
 *
 * What would silently undo it:
 *   1. the receipt prices crew meal / transport / discount a second way, or writes different stored words than the
 *      quote maker — a quote made in the chat would then re-open wrongly in Full quotation;
 *   2. opening a sent quote and sending it untouched changes it (a per-guest line flattened, an offer's line dropped,
 *      a discount doubled, "Quoted after site check" turned into a free line, a stored credit added twice);
 *   3. the receipt invents a number (a new line with a price, a crew charge with a default crew);
 *   4. opening AT an agreed price does not land on it;
 *   5. a plan choice that moves a paid payment is offered.
 *
 * SABOTAGE (20 Nov 2026, each seen RED then restored): `transportChargeCentavos` swapped for the typed fee when the
 * mode is 'included' (1) · `li.push(l.src)` → always rebuild the line (2) · `newReceiptLine` priced at 5000 (3) ·
 * `open.net -` → `open.subtotal -` in `fitReceiptToTarget` with a credit on the quote (4) · `if (stored && hasPaid)
 * return keep` removed (5).
 *
 * Run: cd apps/web && npx tsx --test lib/quote-receipt.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitReceiptToTarget, newReceiptLine, receiptFromCards, receiptFromStored, receiptMoney, receiptPlanChoices, receiptRefusal, RECEIPT_WORDS } from './quote-receipt';
import { DEFAULT_QUOTE_PLAN } from './proposal-payment-schedule';
import { QUOTED_AFTER_SITE_CHECK } from './quote-line-price-words';
import type { ProposalLineItem } from './vendor-proposals';

const HERE = dirname(fileURLToPath(import.meta.url));
const sum = (items: readonly ProposalLineItem[]) => items.reduce((s, l) => s + (l.amount_centavos ?? 0), 0);

test('1 · the receipt writes the quote maker’s own stored words', () => {
  const maker = readFileSync(join(HERE, '..', 'app/_components/proposal-maker.tsx'), 'utf8');
  for (const [what, words] of [
    ['crew charge', `label: '${RECEIPT_WORDS.crewMeal}',`],
    ['crew credit', `label: '${RECEIPT_WORDS.crewCredit}',`],
    ['crew credit caption', `detail: '${RECEIPT_WORDS.crewCreditDetail}',`],
    ['transport', `label: '${RECEIPT_WORDS.transport}', detail: '${RECEIPT_WORDS.transportFlat}'`],
    ['discount', `label: '${RECEIPT_WORDS.discount}', detail: discountReason`],
    ['a free line', `if (l.free) return '${RECEIPT_WORDS.free}';`],
  ] as const) {
    assert.ok(maker.includes(words), `the quote maker no longer writes the ${what} as the receipt does: ${words}`);
  }
  // …and prices them through the SAME resolvers, never its own arithmetic.
  const lib = readFileSync(join(HERE, 'quote-receipt.ts'), 'utf8');
  for (const fn of ['crewChargeCentavos(', 'crewCreditCentavos(', 'transportChargeCentavos(', 'quoteMoney(']) {
    assert.ok(lib.includes(fn) && maker.includes(fn), `${fn} is not shared by the maker and the receipt`);
  }
});

test('1 · lines, crew meal, transport and a discount add up the maker’s way', () => {
  const d = receiptFromCards([
    { id: 'c1', name: 'Lights', fromCentavos: 3_000_000 },
    { id: 'c2', name: 'Sound', fromCentavos: null },
  ]);
  d.lines[1]!.pricePhp = 1_500;
  d.lines[1]!.qty = 4;
  d.crew = { mode: 'charge', size: 5, perHeadPhp: 350 };
  d.transport = { mode: 'flat', flatPhp: 2_000 };
  d.discountPhp = 5_000;
  d.discountWhy = 'Dec booking';
  const m = receiptMoney(d);
  assert.equal(m.subtotal, 3_000_000 + 600_000 + 175_000 + 200_000);
  assert.equal(m.discount, 500_000);
  assert.equal(m.net, 3_475_000);
  assert.equal(sum(m.lineItems), m.net, 'the lines the server re-adds do not come to the total shown');
  assert.deepEqual(m.lineItems, [
    { label: 'Lights', detail: null, amount_centavos: 3_000_000, card_id: 'c1', basis: 'flat' },
    { label: 'Sound', detail: '₱1,500 × 4', amount_centavos: 600_000, card_id: 'c2', basis: 'flat' },
    { label: 'Crew meal', detail: '5 crew × ₱350/head', amount_centavos: 175_000 },
    { label: 'Transportation', detail: 'Flat fee', amount_centavos: 200_000 },
    { label: 'Discount', detail: 'Dec booking', amount_centavos: -500_000 },
  ]);
  // "Couple provides": a credit — a negative line, and it rides the schedule.
  const credit = receiptMoney({ ...d, crew: { mode: 'offset', size: 5, perHeadPhp: 350 } });
  assert.equal(credit.creditCentavos, 175_000);
  assert.equal(credit.lineItems.at(-1)!.label, RECEIPT_WORDS.crewCredit);
  assert.equal(sum(credit.lineItems), credit.net);
  // After a site check: a line with NO amount — never a free line.
  const site = receiptMoney({ ...d, transport: { mode: 'distance', flatPhp: 0 } });
  assert.deepEqual(site.lineItems.find((l) => l.label === 'Transportation'), { label: 'Transportation', detail: QUOTED_AFTER_SITE_CHECK, amount_centavos: null });
});

test('2 · a sent quote opened and sent untouched is the same quote', () => {
  const stored: ProposalLineItem[] = [
    { label: 'Buffet', detail: '₱900 × 150 pax', amount_centavos: 13_500_000, card_id: 'c1', basis: 'per_pax', rate_centavos: 90_000 },
    { label: 'Moving heads', detail: '₱1,500 × 4', amount_centavos: 600_000, basis: 'flat' },
    { label: 'Photo wall', detail: 'Complimentary', amount_centavos: null },
    { label: 'Free uplights', detail: 'from offer · Dec promo', amount_centavos: null, offer_id: 'S89O-1' },
    { label: 'Crew meal', detail: '5 crew × ₱350/head', amount_centavos: 175_000 },
    { label: 'Transportation', detail: QUOTED_AFTER_SITE_CHECK, amount_centavos: null },
    { label: 'Dec promo', detail: '5% off · offer', amount_centavos: -700_000, offer_id: 'S89O-1' },
    { label: 'Discount', detail: 'Early inquiry', amount_centavos: -200_000, from_offer_id: 'S89O-2' },
    { label: RECEIPT_WORDS.crewCredit, detail: RECEIPT_WORDS.crewCreditDetail, amount_centavos: -100_000 },
  ];
  const d = receiptFromStored(stored);
  assert.equal(d.transport.mode, 'distance', '"Quoted after site check" opened as a free line');
  assert.equal(d.discountPhp, 2_000);
  assert.equal(d.discountWhy, 'Early inquiry');
  assert.equal(d.kept.length, 3, 'an offer’s line, its gift and the stored credit are kept, not edited');
  assert.equal(d.lines.find((l) => l.label === 'Moving heads')!.qty, 4, 'the quantity was not read back');
  assert.equal(d.lines.find((l) => l.label === 'Moving heads')!.pricePhp, 1_500);
  assert.equal(d.lines.find((l) => l.label === 'Buffet')!.qty, 1, 'a per-guest caption is not a quantity');
  const m = receiptMoney(d);
  assert.equal(sum(m.lineItems), sum(stored), 'the total moved without a change');
  assert.equal(m.net, sum(stored));
  assert.equal(m.creditCentavos, 100_000);
  assert.equal(m.offerCentavos, 700_000);
  assert.deepEqual([...m.lineItems].sort((a, b) => a.label.localeCompare(b.label)), [...stored].sort((a, b) => a.label.localeCompare(b.label)), 'a line lost its card, basis, offer or caption on the way through');
  // A line the supplier DID change is rebuilt as a plain flat line; the others still ride untouched.
  d.lines[0]!.pricePhp = 140_000;
  const after = receiptMoney(d).lineItems;
  assert.deepEqual(after[0], { label: 'Buffet', detail: null, amount_centavos: 14_000_000, card_id: 'c1', basis: 'flat' });
  assert.equal(after[1], stored[1]);
});

test('3 · nothing is invented: a new line is empty, a crew charge has no crew, and an unfinished part refuses', () => {
  assert.deepEqual({ ...newReceiptLine(), key: '' }, { key: '', label: '', pricePhp: 0, qty: 1, free: false, cardId: null, src: null });
  const d = receiptFromCards([{ id: 'c1', name: 'Lights', fromCentavos: 3_000_000 }]);
  assert.deepEqual(d.crew, { mode: 'included', size: 0, perHeadPhp: 0 });
  assert.deepEqual(d.transport, { mode: 'included', flatPhp: 0 });
  assert.equal(d.discountPhp, 0);
  assert.equal(receiptRefusal(d, receiptMoney(d)), null);
  const crew = { ...d, crew: { mode: 'charge' as const, size: 0, perHeadPhp: 0 } };
  assert.equal(receiptMoney(crew).net, 3_000_000, 'a crew charge with no crew added money');
  assert.match(receiptRefusal(crew, receiptMoney(crew))!, /Crew meal/);
  const fee = { ...d, transport: { mode: 'flat' as const, flatPhp: 0 } };
  assert.match(receiptRefusal(fee, receiptMoney(fee))!, /Transport/);
  const unnamed = { ...d, lines: [...d.lines, { ...newReceiptLine(), pricePhp: 500 }] };
  assert.equal(receiptRefusal(unnamed, receiptMoney(unnamed)), 'Name every line.');
  const blank = { ...d, lines: [...d.lines, newReceiptLine()] };
  assert.equal(receiptRefusal(blank, receiptMoney(blank)), null, 'an untouched new line blocks the send');
  assert.equal(receiptMoney(blank).lineItems.length, 1, 'an untouched new line was sent');
  const over = { ...d, discountPhp: 40_000 };
  assert.equal(receiptRefusal(over, receiptMoney(over)), 'The discount is more than the quote.');
  assert.equal(receiptRefusal({ ...d, lines: [] }, receiptMoney({ ...d, lines: [] })), 'Add at least one line.');
});

test('4 · same parts, new total: the receipt opens AT the agreed price', () => {
  const d = receiptFromCards([{ id: 'c1', name: 'Lights', fromCentavos: 4_800_000 }]);
  const down = fitReceiptToTarget(d, 4_400_000, 'As discussed');
  assert.equal(down.discountPhp, 4_000);
  assert.equal(down.discountWhy, 'As discussed');
  assert.equal(receiptMoney(down).net, 4_400_000);
  const up = fitReceiptToTarget(d, 5_000_000, 'As discussed');
  assert.equal(up.discountPhp, 0);
  assert.deepEqual({ ...up.lines.at(-1)!, key: '' }, { key: '', label: RECEIPT_WORDS.adjustment, pricePhp: 2_000, qty: 1, free: false, cardId: null, src: null });
  assert.equal(receiptMoney(up).net, 5_000_000);
  // With a stored credit, the target is what they PAY.
  const stored = receiptFromStored([
    { label: 'Lights', detail: null, amount_centavos: 4_800_000 },
    { label: RECEIPT_WORDS.crewCredit, detail: RECEIPT_WORDS.crewCreditDetail, amount_centavos: -100_000 },
  ]);
  assert.equal(receiptMoney(fitReceiptToTarget(stored, 4_400_000, 'As discussed')).net, 4_400_000);
  // Already at the price, with its own reason: nothing is rewritten.
  const same = fitReceiptToTarget({ ...d, discountPhp: 4_000, discountWhy: 'Dec booking' }, 4_400_000, 'As discussed');
  assert.equal(same.discountWhy, 'Dec booking');
});

test('5 · How they pay: the maker’s default first; a revision keeps its plan; a paid payment leaves only the kept plan', () => {
  const fresh = receiptPlanChoices(null, false);
  assert.deepEqual(fresh.map((c) => c.key), ['default', 'half', 'full']);
  assert.equal(fresh[0]!.label, '20% to book · rest 14 days before');
  assert.deepEqual(fresh[0]!.plan!.manual, DEFAULT_QUOTE_PLAN.manual, 'the default plan is no longer the quote maker’s');
  const plan = { manual: [...DEFAULT_QUOTE_PLAN.manual], autoBalance: { ...DEFAULT_QUOTE_PLAN.autoBalance } };
  assert.deepEqual(receiptPlanChoices(plan, false, true).map((c) => c.key), ['keep', 'default', 'half', 'full']);
  assert.deepEqual(receiptPlanChoices(plan, true, true).map((c) => c.key), ['keep'], 'a preset that would move a paid payment is offered');
  const none = receiptPlanChoices(null, false, true);
  assert.equal(none[0]!.key, 'none');
  assert.equal(none[0]!.plan, null, 'a quote sent without a plan was given one on re-open');
});

test('the receipt reaches the server only through the shipped writer, and is hosted two ways', () => {
  const card = (f: string) => readFileSync(join(HERE, '..', 'app/_components/chat/cards', f), 'utf8');
  for (const f of ['quote-step-card.tsx', 'make-quote-card.tsx']) {
    assert.match(card(f), /await sendCustomProposalFromChat\(fd\)/, `${f} grew a second write path`);
    assert.match(card(f), /<EditorShell frame=\{frame\} topic="quote"/, `${f} can no longer sit inside the text box`);
  }
  assert.doesNotMatch(card('quote-receipt.tsx'), /supabase|['"]use server['"]|sendCustomProposal/, 'the receipt is fields only — it reads and writes nothing');
  assert.match(card('negotiate-cards.tsx'), /<EditorShell frame=\{frame\} topic=\{TOPIC\[kind\]\}/);
  // A line wears its OWN card's style; a card with none wears no tag.
  assert.match(card('quote-receipt.tsx'), /const style = l\.cardId && tags \? \(tags\[l\.cardId\] \?\? null\) : null;/);
  assert.match(card('card-calls.ts'), /if \(isAvailabilityStyle\(r\.availability_style\)\) byCard\[r\.vendor_service_id\] = r\.availability_style;/);
});
