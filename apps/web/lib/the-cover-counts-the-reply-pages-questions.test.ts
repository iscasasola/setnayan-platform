/**
 * the-cover-counts-the-reply-pages-questions.test.ts — ✉️ "YOU'RE COMING ✓ · N MORE ANSWERS": N IS THE REPLY PAGE'S
 * OWN MISSING SET (owner 2026-10-20, DECISION_LOG "THE COVER'S REPLY BUTTON HAS THREE STATES", verbatim: *"Show
 * "You're coming ✓ · N more answers" when answers are missing (tap opens only the missing ones)"*).
 *
 * Measured live that day on maria-and-jose (iPhone 13, WebKit): an attending guest who had not answered the couple's
 * switched-on meal and mobile questions met "You're coming ✓ · Change" — the complete reply's button, byte for byte —
 * while the reply page behind it asked "Two more things".
 *
 *   (1) THE PROPERTY — over every combination of reply · meal · mobile · which questions are on · the lock, the N the
 *       cover draws equals the number of questions the reply page draws for the same row (`rsvpGate` → `RsvpWidget`'s
 *       `missing`): meal and mobile, never attendance for a guest already coming. Never a second count.
 *   (2) THE THREE STATES — not answered "Confirm attendance" · coming and complete "You're coming ✓ · Change" (a glide to
 *       the card, as shipped) · coming with N owed "You're coming ✓ · N more answers" ("1 more answer"), a link that
 *       OPENS the reply page. A decline keeps "You can't make it · Change" — the gate asks a decliner nothing more.
 *   (3) A FAILURE DOES NOT LOOK LIKE SUCCESS — a row without the answers is not counted (`guestAnswersRead`), and an
 *       uncounted N (null) draws the plain "Change": never a wrong number.
 *   (4) EVERY SURFACE READS THE SAME N — the Event Hub page counts its own key gate; the Reply card (Welcome · Me) and the
 *       cover read it from there; the landing door counts the reply page's own `rsvpGate` call; all say it through
 *       `moreAnswersWords`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { guestAnswersRead, moreAnswersOf, moreAnswersWords, rsvpGate } from '@/lib/guest-one-path';
import { replyCardOf } from '@/lib/guest-me-parts';
import { COVER_RSVP_PART, coverRsvpOf } from '@/lib/cover-rsvp';
import { resolveArrivalAction } from '@/lib/arrival-action';
import { inviteReplyPath } from '@/lib/invite-arrival';

(globalThis as unknown as { React: unknown }).React = React;
const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const REPLY = inviteReplyPath('maria-and-jose');

const STATUSES = ['pending', 'attending', 'declined', 'maybe', null] as const;
const ANSWERS = [null, '', '  ', 'chicken'] as const;
const MOBILES = [null, '', '0917 000 0000'] as const;

/** What the reply page draws for this row: its `RsvpWidget` asks exactly `gate.missing` (meal · mobile · attendance). */
function replyPageAsks(gate: ReturnType<typeof rsvpGate>): string[] {
  return gate.kind === 'ask' ? gate.missing : [];
}

const cardOf = (status: string, moreAnswers?: number | null) =>
  replyCardOf({
    action: resolveArrivalAction({ slug: 'maria-and-jose', rsvpStatus: status, eventDate: '2026-12-12', today: '2026-10-14', hasPass: true }),
    replyBy: null,
    seats: 1,
    organizer: 'the couple',
    moreAnswers,
  });

test('(1) THE PROPERTY: N on the cover = the questions the reply page asks, over every combination', () => {
  let counted = 0;
  let positive = 0;
  for (const rsvpStatus of STATUSES)
    for (const mealPreference of ANSWERS)
      for (const mobile of MOBILES)
        for (const askMeal of [false, true])
          for (const askMobile of [false, true])
            for (const locked of [false, true]) {
              const gate = rsvpGate({ rsvpStatus, mealPreference, mobile, askMeal, askMobile, locked });
              const n = moreAnswersOf(gate);
              const asks = replyPageAsks(gate);
              const where = JSON.stringify({ rsvpStatus, mealPreference, mobile, askMeal, askMobile, locked });
              assert.equal(typeof n, 'number', `${where}: a readable gate gave no number`);
              if (rsvpStatus === 'attending') {
                assert.ok(!asks.includes('attending'), `${where}: the reply page asks a coming guest if they are coming`);
                assert.equal(n, asks.length, `${where}: the cover says ${n} more, the reply page asks ${asks.length} (${asks.join(', ')})`);
                // …and only the couple's switched-on questions are ever counted.
                if (!askMeal) assert.ok(!asks.includes('meal'), `${where}: a meal is owed for a question that is off`);
                if (!askMobile) assert.ok(!asks.includes('mobile'), `${where}: a mobile is owed for a question that is off`);
                counted++;
                if (n! > 0) positive++;
              } else {
                assert.equal(n, 0, `${where}: a guest who is not coming is told they owe ${n} more answers`);
              }
            }
  // Anti-vacuity: the matrix reached both sides of the rule.
  assert.equal(counted, ANSWERS.length * MOBILES.length * 2 * 2 * 2, `only ${counted} attending rows checked`);
  assert.ok(positive > 0 && positive < counted, 'the matrix never produced both a complete and an incomplete attending reply');
  // The measured live case: meal + mobile on, both blank → the reply page's "Two more things" → "2 more answers".
  const live = rsvpGate({ rsvpStatus: 'attending', mealPreference: null, mobile: null, askMeal: true, askMobile: true, locked: false });
  assert.equal(moreAnswersOf(live), 2);
  assert.equal(moreAnswersWords(2), '2 more answers');
  assert.equal(moreAnswersWords(1), '1 more answer', 'one is not said in the singular');
});

test('(2) the three states — and a decline keeps its shipped words', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PahinaMasthead } = await import('@/app/[slug]/_components/pahina-masthead');
  const button = (rsvp: unknown) => {
    const html = renderToStaticMarkup(
      React.createElement(PahinaMasthead, { displayName: 'Maria & Jose', eventDate: '2026-12-12', venueName: 'Manila Cathedral', monogramSlot: React.createElement('span', null, 'MJ'), rsvp } as never),
    );
    const a = /<a [^>]*data-cover-rsvp="[^"]*"[^>]*>[\s\S]*?<\/a>/.exec(html)?.[0] ?? '';
    return { a, href: /href="([^"]*)"/.exec(a)?.[1] ?? null, text: a.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() };
  };

  const ask = button(coverRsvpOf({ card: cardOf('pending'), toPart: true }));
  assert.equal(ask.text, 'Confirm attendance');

  const complete = button(coverRsvpOf({ card: cardOf('attending', 0), toPart: true }));
  assert.equal(complete.text, 'You’re coming ✓ · Change', 'the complete reply’s button changed');
  assert.equal(complete.href, `#${COVER_RSVP_PART}`, 'the complete reply no longer glides to the Reply card');

  for (const [n, words] of [[2, '2 more answers'], [1, '1 more answer']] as const) {
    const card = cardOf('attending', n);
    assert.equal(card?.cta, words, `the Reply card (Welcome · Me) does not say "${words}"`);
    assert.equal(card?.line, 'You’re coming · 1 seat', 'the Reply card’s line changed');
    const more = button(coverRsvpOf({ card, toPart: true }));
    assert.equal(more.text, `You’re coming ✓ · ${words}`, `the cover does not say "You’re coming ✓ · ${words}"`);
    assert.equal(more.href, REPLY, 'a tap does not open the reply page (which asks only the missing ones)');
    assert.match(more.a, new RegExp(`data-cover-rsvp-more="${n}"`));
    assert.notEqual(more.text, complete.text, 'an incomplete reply looks identical to a complete one');
  }

  // A decline: the gate asks a decliner nothing more — "You can't make it · Change", whatever is blank.
  const declinedGate = rsvpGate({ rsvpStatus: 'declined', mealPreference: null, mobile: null, askMeal: true, askMobile: true, locked: false });
  assert.equal(moreAnswersOf(declinedGate), 0, 'a decliner is counted as owing answers');
  const declined = button(coverRsvpOf({ card: cardOf('declined', moreAnswersOf(declinedGate)), toPart: true }));
  assert.equal(declined.text, 'You can’t make it · Change');
  // …and a number handed to a declined card is ignored: only "coming" can owe answers.
  assert.equal(cardOf('declined', 2)?.cta, 'Change my reply');
});

test('(3) a failure does not look like success — an uncounted N says the plain "Change", never a number', async () => {
  assert.equal(guestAnswersRead({ rsvp_status: 'attending', meal_preference: null, mobile: null }), true, 'null answers are answers ("not given")');
  assert.equal(guestAnswersRead({ rsvp_status: 'attending', meal_preference: null }), false, 'a row without `mobile` was counted');
  assert.equal(guestAnswersRead({ rsvp_status: 'attending', mobile: null }), false, 'a row without `meal_preference` was counted');
  assert.equal(guestAnswersRead(null), false);
  assert.equal(moreAnswersOf(null), null, 'an unread gate became a number');
  const card = cardOf('attending', null);
  assert.equal(card?.cta, 'Change my reply', 'an uncounted N drew something other than the shipped words');
  assert.equal(coverRsvpOf({ card, toPart: true })?.kind === 'going' && 'more' in coverRsvpOf({ card, toPart: true })!, false);
});

test('(4) every surface reads the same N — one count, one set of words', () => {
  // The Event Hub page counts ITS OWN key gate (the `rsvpGate` the reply page also asks), and only a row with the answers.
  const page = stripComments(read('app/[slug]/page.tsx'));
  assert.match(page, /const keyGate = rsvpGate\(\{/, 'the Event Hub no longer asks the key gate');
  assert.match(page, /const answersRead = guestAnswersRead\(guestContext\.guest\);/, 'the page counts a row it did not check carried the answers');
  assert.match(page, /const moreAnswers = answersRead \? moreAnswersOf\(keyGate\) : null;/, 'N is not the key gate’s own missing set');
  assert.match(page, /if \(!answersRead\) \{\s*console\.error\(/, 'an uncounted N is not logged');
  assert.match(page, /didntReply: keyGate\.kind === 'inside' && keyGate\.didntReply,\s*moreAnswers,/, 'the page does not hand N to the guest identity');
  // The reply page draws exactly its gate's missing set.
  const reply = stripComments(read('app/[slug]/invite/reply/page.tsx'));
  assert.match(reply, /rsvpGate\(\{/, 'the reply page no longer asks `rsvpGate`');
  assert.match(reply, /gate=\{gate\.kind === 'ask' \? \{ missing: gate\.missing, coupleMarked: gate\.coupleMarked \} : null\}/, 'the reply page draws something other than its gate’s missing set');
  // The guest's Reply card (Welcome · Me) — and so the cover — carry it.
  const body = stripComments(read('app/[slug]/_components/site-body.tsx'));
  assert.match(body, /moreAnswers: g\.moreAnswers,/, 'the guest’s Reply card does not read N');
  assert.match(body, /: coverRsvpOf\(\{ card: replyCard, toPart: true \}\);/, 'the cover does not read the guest’s Reply card');
  // The landing door: the reply page's own call, on its own row (the select carries `mobile`).
  const enter = stripComments(read('app/[slug]/invite/enter/page.tsx'));
  assert.match(enter, /\.select\('[^']*\brsvp_status, meal_preference, mobile\b[^']*'\)/, 'the landing reads no mobile — every attending guest would owe one');
  assert.match(enter, /moreAnswersOf\(\s*rsvpGate\(\{/, 'the landing counts something other than the reply page’s gate');
  assert.match(enter, /moreAnswers > 0 \? moreAnswersWords\(moreAnswers\) : changeReplyWords\(reply\)/, 'the landing’s Change link does not say N');

  // The words: the cover, the Reply card and the landing all say N through `moreAnswersWords` — none spells its own.
  assert.match(read('app/[slug]/_components/pahina-masthead.tsx'), /moreAnswersWords\(rsvp\.more\)/, 'the cover spells N itself');
  assert.match(read('lib/guest-me-parts.ts'), /cta: moreAnswersWords\(more\)/, 'the Reply card spells N itself');
});
