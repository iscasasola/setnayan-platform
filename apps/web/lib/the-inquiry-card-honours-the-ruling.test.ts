/**
 * The inquiry card shows exactly what the ruling in force grants.
 *
 * ── THE RULING NOW (owner, 2026-09-08) ────────────────────────────────────
 * *"we do not need to hide anything, since no more tokens."*
 *
 * ── THE RULING IT REPLACED (owner-locked, DECISION_LOG 2026-07-15) ────────
 * *"Vendor inquiries ANONYMIZED-UNTIL-ACCEPT … Pre-accept a vendor sees the JOB
 * (event type · date · city/area · guest/budget bands · category · couple's
 * message text) but NOT WHO the couple is (no display name, initials, photo,
 * event title, public-page link, contact)."*
 *
 * 🔑 WHY IT WAS REVERSED RATHER THAN RELAXED. Anonymisation was the token
 * wallet's storefront — the retired `inquiry-mask.ts` said so outright:
 * *"Accepting (the flat 1-token burn, ₱200) reveals everything — identity is
 * what the token buys."* The wallet was retired on 2026-05-11, so for four
 * months the mask withheld a name and sold nothing. Its residual privacy
 * argument does not survive contact with the data model either: a
 * `chat_threads` row exists ONLY because the couple chose to write to this one
 * supplier, so there was never cold outreach here to protect them from.
 *
 * ── WHAT WAS WRONG (owner, 2026-09-08) ────────────────────────────────────
 * *"i cannot see all the information I need from the inquiry."* The dashboard
 * card showed four of the six granted fields and withheld two:
 *
 *     A couple planning a wedding in Metro Manila · Dec 18 · Metro Manila ·
 *     Live Band · just now
 *
 * No guest count — while `pax_at_inquiry = 230` sat on the thread it was built
 * from. No message — while the couple had asked, in as many words, *"Could you
 * share your rates and what's included?"* And "Metro Manila" printed twice.
 *
 * 🔑 THIS WAS NOT A NEW DESIGN QUESTION. It was settled two months earlier, and
 * the card had drifted below it. The thread page honoured the ruling in full the
 * whole time — so the two surfaces disagreed about what a supplier may see.
 *
 * ⚠ THE JOB-FACT HALF OF THE OLD RULING SURVIVES UNCHANGED, and every test
 * below it still stands: pax, the couple's own words, the word-boundary cut,
 * and the degrade-to-null. Reversing WHO may be seen is not licence to get
 * WHAT sloppy — those were the fields the owner said were missing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInquiryCard } from '@/lib/vendor-overview-inquiry-card';

const base = {
  threadId: 't1',
  createdAt: '2026-09-08T00:00:00Z',
  eventDate: '2026-12-18',
  eventType: 'wedding',
  region: 'ncr',
  category: 'Live Band',
  displayName: 'Cale & Ice',
};

test('the guest count reaches the card', () => {
  const c = buildInquiryCard({ ...base, paxAtInquiry: 230 });
  assert.equal(
    c.paxAtInquiry,
    230,
    'the supplier is asked to Accept or Decline without the number that sizes the job',
  );
});

test('the couple’s message reaches the card, quoted not summarised', () => {
  const body = "Could you share your rates and what's included?";
  const c = buildInquiryCard({ ...base, messageExcerpt: body });
  assert.equal(c.messageExcerpt, body, 'the message was altered or dropped');
});

test('a long message is cut on a WORD boundary, never mid-number', () => {
  // "for 2" out of "for 230 guests" is not a shorter truth, it is a different one.
  const long = `${'word '.repeat(60)}we are expecting 230 guests`;
  const c = buildInquiryCard({ ...base, messageExcerpt: long });
  assert.ok(c.messageExcerpt!.endsWith('…'), 'a truncated message is not marked as truncated');
  assert.ok(
    !/\s\d{1,2}$/.test(c.messageExcerpt!.replace(/…$/, '').trimEnd()),
    `the excerpt ends on a partial number: ${c.messageExcerpt}`,
  );
});

test('an absent message and an absent pax degrade to null, not to noise', () => {
  const c = buildInquiryCard({ ...base });
  assert.equal(c.paxAtInquiry, null);
  assert.equal(c.messageExcerpt, null);
  const blank = buildInquiryCard({ ...base, messageExcerpt: '   ' });
  assert.equal(blank.messageExcerpt, null, 'whitespace became an empty quote block');
});

test('🔑 THE CARD NAMES WHO IS ASKING', () => {
  const c = buildInquiryCard({ ...base, paxAtInquiry: 230, messageExcerpt: 'hello' });
  assert.equal(
    c.descriptor,
    'Cale & Ice',
    'the supplier is asked to Accept or Decline without being told who is asking',
  );
});

test('the placeholder cannot come back by accident', () => {
  // The exact sentence the retired `inquiryPlaceholderLabel` produced. If any
  // future change reintroduces a neutral stand-in for a name that IS known,
  // this is the shape it would take.
  const c = buildInquiryCard({ ...base });
  assert.doesNotMatch(
    c.descriptor,
    /planning a .* in |^An? (couple|host|organizer|family|celebrant)\b/,
    `the card is describing the customer instead of naming them: ${c.descriptor}`,
  );
});

test('a nameless event degrades to a neutral noun, never to a guess', () => {
  // 'New customer' is the honest answer when `display_name` is genuinely null.
  // It must NOT become "A couple planning a wedding" — that sentence asserts a
  // wedding, and seventeen event types exist.
  for (const displayName of [null, '   ']) {
    const c = buildInquiryCard({ ...base, displayName });
    assert.equal(c.descriptor, 'New customer', `blank name rendered as: ${c.descriptor}`);
  }
});
