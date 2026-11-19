/**
 * 💬 THE SUMMARY STRIP SAYS WHAT IS TRUE — and a failed read never looks empty (owner 19 Nov 2026, DECISION_LOG "THE
 * CLIENT PAGE IS ONE CHAT THAT HOLDS EVERYTHING"; drawing S9ScH2Ps v3, screens 2 · 7 · 11).
 *
 * What would silently undo it:
 *   1. a refused read drawn as a figure — "₱0 of ₱45,000", "0 open", "None open", "Nothing set yet";
 *   2. "all paid" (or a full bar) with no amount ever agreed;
 *   3. before booking: the quote's box not turning into the Deal when the hosts counter — or showing a counter that
 *      could not be read as "nobody countered";
 *   4. Forms pressable before booking (the page behind it is shut) or hidden instead of saying why;
 *   5. the Next step row's fact lost when its row left the top of the chat;
 *   6. a suggested step for a stage that could not be read (the step of the stage below it);
 *   7. the strip's "Good until" words drifting from the counter cards' (two wordings for one date).
 *
 * SABOTAGE (19 Nov 2026, each seen RED then restored): `paid === null` → a zeroed box (1) · `agreedPhp <= 0` branch
 * removed (2) · `i.theirAsk === null` treated as undefined (3) · `door: null` → 'forms' before booking (4) ·
 * `hasQuote === null` → falls through to "Make a quote" (6).
 *
 * Run: cd apps/web && npx tsx --test lib/client-chat-strip.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { STRIP_FAILED_WORDS, chatStrip, decisionsBox, nextDated, quoteGoodUntil, suggestedStep, type StripInputs } from './client-chat-strip';
import { goodUntilWords } from './chat-cards';

const peso = (php: number) => `₱${php.toLocaleString('en-PH')}`;
const booked: StripInputs = {
  isBooked: true,
  todayIso: '2026-11-19',
  peso,
  paid: { paidPhp: 18000, agreedPhp: 45000, next: { amountPhp: 13500, dueText: 'Due Dec 3', check: false, late: false } },
  quote: undefined,
  theirAsk: undefined,
  next: { title: 'Tasting', day: '2026-12-03' },
  forms: { open: 2, sent: 3 },
};
const asking: StripInputs = {
  isBooked: false,
  todayIso: '2026-11-23',
  peso,
  paid: null,
  quote: { totalPhp: 45000, sentAt: '2026-11-12T03:00:00Z', validUntil: '2026-11-26' },
  theirAsk: undefined,
  next: { title: 'Ocular', day: '2026-11-24' },
  forms: null,
};
const [money, next, forms] = chatStrip(booked);

test('booked: Paid ₱18,000 of ₱45,000 with its bar · Next · Forms — each the door to its page', () => {
  assert.deepEqual([money!.label, money!.value, money!.door], ['Paid', '₱18,000 of ₱45,000', 'payments']);
  assert.equal(money!.progress, 0.4);
  assert.deepEqual(money!.sub, { text: '₱13,500 · Due Dec 3', tone: 'quiet' });
  assert.deepEqual([next!.value, next!.door], ['Tasting · 3 Dec', 'schedule']);
  assert.deepEqual([forms!.value, forms!.door], ['2 open', 'forms']);
  assert.equal(chatStrip({ ...booked, forms: { open: 0, sent: 3 } })[2]!.value, 'All answered');
  assert.equal(chatStrip({ ...booked, forms: { open: 0, sent: 0 } })[2]!.value, 'None sent');
});

test('1 · a refused read says so in the danger colour, and the box retries — never a figure, never a blank', () => {
  for (const [input, at, label] of [
    [{ ...booked, paid: null }, 0, 'Paid'],
    [{ ...booked, paid: { paidPhp: null, agreedPhp: null, next: null } }, 0, 'Paid'],
    [{ ...booked, next: null }, 1, 'Next'],
    [{ ...booked, forms: null }, 2, 'Forms'],
    [{ ...asking, quote: null }, 0, 'Quote'],
  ] as const) {
    const box = chatStrip(input as StripInputs)[at]!;
    assert.equal(box.label, label);
    assert.equal(box.value, STRIP_FAILED_WORDS);
    assert.equal(box.failed, true);
    assert.equal(box.tone, 'danger');
    assert.doesNotMatch(box.value, /₱|\b0\b|None|Nothing/);
  }
  const d = decisionsBox(null);
  assert.deepEqual([d.value, d.failed, d.tone], [STRIP_FAILED_WORDS, true, 'danger']);
  assert.equal(decisionsBox(undefined).value, 'Checking…', 'not counted yet is not "none"');
  assert.deepEqual([decisionsBox(1).value, decisionsBox(1).tone], ['1 waiting on you', 'needs']);
  assert.equal(decisionsBox(0).value, 'None open');
});

test('2 · never a bar, "of ₱0" or "All paid" when no amount was agreed', () => {
  const none = chatStrip({ ...booked, paid: { paidPhp: 9000, agreedPhp: null, next: null } })[0]!;
  assert.equal(none.value, '₱9,000 received');
  assert.equal(none.progress ?? null, null);
  assert.equal(none.sub ?? null, null);
  const zero = chatStrip({ ...booked, paid: { paidPhp: 0, agreedPhp: 0, next: null } })[0]!;
  assert.doesNotMatch(`${zero.value} ${zero.sub?.text ?? ''}`, /All paid|of ₱0/);
  const all = chatStrip({ ...booked, paid: { paidPhp: 45000, agreedPhp: 45000, next: null } })[0]!;
  assert.deepEqual(all.sub, { text: 'All paid', tone: 'ok' });
  assert.equal(all.progress, 1);
  const check = chatStrip({ ...booked, paid: { paidPhp: 9000, agreedPhp: 45000, next: { amountPhp: 9000, dueText: null, check: true, late: false } } })[0]!;
  assert.deepEqual(check.sub, { text: '₱9,000 to confirm', tone: 'needs' }, 'a payment waiting on the supplier is said as theirs to confirm');
});

test('3 · before booking: Quote → Deal once the hosts counter; a counter that could not be read is said', () => {
  const quote = chatStrip(asking)[0]!;
  assert.deepEqual([quote.label, quote.value, quote.door], ['Quote', '₱45,000 · sent 12 Nov', 'deal']);
  assert.deepEqual(quote.sub, { text: 'Good until 26 Nov · 3 days left', tone: 'warn' });
  const deal = chatStrip({ ...asking, theirAsk: 40000 })[0]!;
  assert.deepEqual([deal.label, deal.value, deal.door], ['Deal', '₱45,000 · they ask ₱40,000', 'deal']);
  const unread = chatStrip({ ...asking, theirAsk: null })[0]!;
  assert.equal(unread.label, 'Deal');
  assert.deepEqual(unread.sub, { text: 'Their ask couldn’t load', tone: 'danger' });
  assert.doesNotMatch(unread.value, /they ask/);
  const none = chatStrip({ ...asking, quote: undefined })[0]!;
  assert.deepEqual([none.value, none.door], ['Not sent yet', 'quote']);
  const expired = chatStrip({ ...asking, todayIso: '2026-11-30' })[0]!;
  assert.deepEqual(expired.sub, { text: 'Expired 26 Nov', tone: 'danger' });
});

test('4 · Forms before booking is shut with its reason — drawn, not a press', () => {
  const f = chatStrip(asking)[2]!;
  assert.deepEqual([f.value, f.door, f.failed], ['Open once they book', null, false]);
});

test('5 · the Next step is said by the box it opens — its row left the top of the chat, its fact did not', () => {
  const crew = chatStrip({ ...booked, step: { line: 'Sat, Dec 12 · crew in 1:00 PM', page: 'schedule' } })[1]!;
  assert.deepEqual([crew.value, crew.tone, crew.door], ['Sat, Dec 12 · crew in 1:00 PM', 'needs', 'schedule']);
  const hand = chatStrip({ ...booked, step: { line: 'Send the handover', page: 'files' } })[1]!;
  assert.deepEqual([hand.value, hand.door], ['Send the handover', 'files']);
  const wait = chatStrip({ ...asking, quote: { totalPhp: 45000, sentAt: null, validUntil: null }, step: { line: 'Quote sent · no answer yet', page: 'quote' } })[0]!;
  assert.deepEqual(wait.sub, { text: 'No answer yet', tone: 'quiet' });
});

test('the next dated thing: the soonest meeting ahead, else the event day; a refused read is null', () => {
  const m = (title: string, day: string | null, status = 'confirmed') => ({ title, day, status });
  assert.deepEqual(nextDated({ todayIso: '2026-11-19', eventDate: '2027-02-14', meetings: [m('Tasting', '2026-12-03'), m('Ocular', '2026-11-22')] }), { title: 'Ocular', day: '2026-11-22' });
  assert.deepEqual(nextDated({ todayIso: '2026-11-19', eventDate: '2027-02-14', meetings: [m('Old', '2026-11-01'), m('Off', '2026-11-25', 'cancelled')] }), { title: 'Event day', day: '2027-02-14' });
  assert.equal(nextDated({ todayIso: '2026-11-19', eventDate: '2027-02-14', meetings: null }), null);
  assert.equal(nextDated({ todayIso: '2026-11-19', eventDate: null, meetings: [] }), undefined);
});

test('6 · one suggested step by stage — and none for a stage that could not be read', () => {
  const base = { hasThread: true, isBooked: false, peso, hasQuote: false as boolean | null, hasMeetingAhead: false as boolean | null, nextDue: undefined };
  assert.deepEqual(suggestedStep(base), { label: 'Make a quote', card: 'quote' });
  assert.deepEqual(suggestedStep({ ...base, hasQuote: true }), { label: 'Set an ocular', card: 'meeting' });
  assert.equal(suggestedStep({ ...base, hasQuote: true, hasMeetingAhead: true }), null);
  assert.deepEqual(suggestedStep({ ...base, isBooked: true, nextDue: { amountPhp: 13500 } }), { label: 'Ask for ₱13,500', card: 'payment' });
  assert.equal(suggestedStep({ ...base, isBooked: true, nextDue: null }), null);
  // Unread → nothing, never the stage below.
  assert.equal(suggestedStep({ ...base, hasQuote: null }), null);
  assert.equal(suggestedStep({ ...base, hasQuote: true, hasMeetingAhead: null }), null);
  assert.equal(suggestedStep({ ...base, isBooked: true, nextDue: undefined }), null);
  assert.equal(suggestedStep({ ...base, hasThread: false }), null);
});

test('7 · the strip’s Good until says the same days left as the counter cards', () => {
  const tail = (w: string | null) => (w ?? '').split(' · ').slice(1).join(' · ');
  for (const [until, today] of [['2026-11-26', '2026-11-23'], ['2026-11-26', '2026-11-26'], ['2026-11-26', '2026-11-25']] as const) {
    assert.equal(tail(quoteGoodUntil(until, today).words), tail(goodUntilWords(until, today).words));
    assert.equal(quoteGoodUntil(until, today).expired, goodUntilWords(until, today).expired);
  }
  assert.equal(quoteGoodUntil('2026-11-26', '2026-11-23').words, 'Good until 26 Nov · 3 days left');
  assert.deepEqual(quoteGoodUntil('2026-11-10', '2026-11-23'), { expired: true, words: 'Expired 10 Nov' });
  assert.equal(goodUntilWords('2026-11-10', '2026-11-23').expired, true);
  assert.equal(quoteGoodUntil(null, '2026-11-23').words, null);
});
