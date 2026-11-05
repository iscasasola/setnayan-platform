/**
 * quote-answer-notice.test.ts — a supplier is told when a couple answers their
 * quote, and is never told they are booked.
 *
 * 🔴 WHY (2026-10-10). `respond_vendor_proposal` recorded the answer and nothing
 * told the supplier. It is an IN-APP notice (owner 2026-10-11: no new emails);
 * `couple-supplier-notices-reach-email.test.ts` fails if it is ever emailed.
 * This file holds the two things that one cannot: THE WORDS (executed), and THE DOOR (that the action tells
 * exactly when the function did not refuse, and tells nobody otherwise).
 *
 * SABOTAGE (each seen red, restored): say "booked" on accept · tell on error ·
 * drop the tell · tell before the function runs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { isQuoteAnswer, quoteAnswerNotice } from './quote-answer-notice';
import { supplierNextMove } from './supplier-next-move';

test('the yes says what the customer card says — and never that they are booked', () => {
  const n = quoteAnswerNotice({ response: 'accepted', who: 'Ana & Ben', quoteTitle: 'Full-day coverage' });
  assert.equal(n.title, 'Ana & Ben accepted your quote');
  // The SAME sentence, from the same function, as the supplier's customer card.
  const card = supplierNextMove(
    {
      inquiryStatus: 'accepted',
      lockRequested: false,
      awaitingPaymentCount: 0,
      isDelivered: false,
      hasReview: false,
      isBooked: false,
      isAccepted: true,
      isQuoted: true,
    },
    'Ana & Ben',
  );
  assert.equal(card.title, 'Quote accepted', 'the fixture no longer reaches the accepted-quote state');
  assert.equal(n.body, card.body);
  // Accepting a quote is not booking it: the booking is the ask plus the yes.
  for (const text of [n.title, n.body]) {
    assert.doesNotMatch(text, /\byou(’|')?re booked\b|\bis booked\b|\bbooked you\b|\bconfirmed\b/i, `"${text}" says a booking exists`);
  }
});

test('the no names the quote and says what the supplier can still do', () => {
  const n = quoteAnswerNotice({ response: 'declined', who: 'Ana & Ben', quoteTitle: '  Full-day coverage  ' });
  assert.equal(n.title, 'Ana & Ben declined your quote');
  assert.equal(n.body, 'They did not take “Full-day coverage”. You can send another quote from the conversation.');
  // A quote with no title still makes a sentence — never “”.
  const bare = quoteAnswerNotice({ response: 'declined', who: 'Ana & Ben', quoteTitle: '' });
  assert.doesNotMatch(bare.body, /“”/);
  // The two answers are two different notices.
  assert.notEqual(n.title, quoteAnswerNotice({ response: 'accepted', who: 'Ana & Ben', quoteTitle: 'x' }).title);
});

test('only a real answer is an answer', () => {
  assert.equal(isQuoteAnswer('accepted'), true);
  assert.equal(isQuoteAnswer('declined'), true);
  for (const v of ['', 'sent', 'viewed', 'draft', 'ACCEPTED']) assert.equal(isQuoteAnswer(v), false, v);
});

test('the door: respondToProposal tells the supplier after the function ran, and only when it did not refuse', () => {
  const src = stripComments(
    readFileSync(join(process.cwd(), 'app/vendor-dashboard/proposals/actions.ts'), 'utf8'),
  );
  const at = src.indexOf('export async function respondToProposal(');
  assert.ok(at > -1, 'respondToProposal is gone — was it renamed?');
  const end = src.indexOf('\nasync function ', at);
  const body = src.slice(at, end === -1 ? undefined : end);
  const rpc = body.indexOf("supabase.rpc('respond_vendor_proposal'");
  const tells = [...body.matchAll(/if \(([^)]*\))\) \{\s*try \{\s*await tellSupplierQuoteAnswered\(/g)].map((m) => m[1]!);
  console.log(`# respondToProposal: rpc@${rpc} · tells when → ${JSON.stringify(tells)}`);
  assert.ok(rpc > -1, 'the answer is no longer recorded by respond_vendor_proposal');
  // `!error` is the once-only: the function raises `already_resolved` unless
  // THIS call moved the quote out of sent/viewed.
  assert.deepEqual(tells, ['!error && isQuoteAnswer(response)'], 'the supplier must be told exactly when the answer was recorded');
  assert.ok(body.indexOf('await tellSupplierQuoteAnswered(') > rpc, 'the supplier is told before the answer is recorded');
  // The redirect must come last, or nothing after it runs.
  assert.ok(body.lastIndexOf('redirect(') > body.indexOf('await tellSupplierQuoteAnswered('), 'the redirect now runs before the notice');

  // …and the function really refuses a second press (the reason `!error` is enough).
  const sql = readFileSync(
    join(process.cwd(), '..', '..', 'supabase', 'migrations', '20270227551916_money_proposal_accept_pax_rebaseline.sql'),
    'utf8',
  );
  const fn = sql.slice(sql.indexOf('FUNCTION public.respond_vendor_proposal'));
  assert.match(fn, /IF v_status NOT IN \('sent', 'viewed'\) THEN\s+RAISE EXCEPTION 'already_resolved'/, 'respond_vendor_proposal no longer refuses an already-answered quote');
});
