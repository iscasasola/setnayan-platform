/**
 * The pre-accept inquiry card shows exactly what the 2026-07-15 ruling grants.
 *
 * ── THE RULING (owner-locked, DECISION_LOG 2026-07-15) ────────────────────
 * *"Vendor inquiries ANONYMIZED-UNTIL-ACCEPT … Pre-accept a vendor sees the JOB
 * (event type · date · city/area · guest/budget bands · category · couple's
 * message text) but NOT WHO the couple is (no display name, initials, photo,
 * event title, public-page link, contact)."*
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
 * ⚠ THESE TESTS CUT BOTH WAYS. The same ruling FORBIDS identity pre-accept, and
 * a test that only pushed for "more information" would happily wave through a
 * display name. Both halves are asserted.
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
  hostNoun: 'couple',
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

test('🔑 IDENTITY STILL CANNOT REACH THE CARD', () => {
  // The other half of the same ruling. The builder takes no identity parameter
  // at all — that is the enforcement, and this pins it.
  const c = buildInquiryCard({ ...base, paxAtInquiry: 230, messageExcerpt: 'hello' });
  const serialised = JSON.stringify(c);
  for (const forbidden of ['displayName', 'eventName', 'contact', 'publicId', 'photo']) {
    assert.ok(
      !serialised.includes(forbidden),
      `the card carries ${forbidden} — identity is what accepting buys`,
    );
  }
  assert.match(c.descriptor, /A couple planning a wedding/, 'the neutral placeholder is gone');
});
