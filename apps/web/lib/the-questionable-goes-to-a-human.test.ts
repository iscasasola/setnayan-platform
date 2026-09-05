/**
 * the-questionable-goes-to-a-human.test.ts — MB21's judgement, under attack.
 *
 * The owner's rule, verbatim (2026-09-05):
 *
 *   QR code / any URL / any social handle / any email / the vendor's own name,
 *   phone, or logo                → HARD BLOCK, message names what was found.
 *   Unfamiliar name / phone-shaped digit run / logo-ish mark / heavy text
 *                                 → FLAG to admin queue.
 *   Clean                         → draft, admin approval as today.
 *
 * 🛑 THE MOST IMPORTANT TEST IN THIS FILE IS THE ONE THAT ASSERTS SOMETHING IS
 * **NOT** BLOCKED. "Aira & Nico" on a backdrop is the design of the photograph,
 * not a leak, and a very large share of the `backdrop` and `stage` shelves
 * carry exactly that. `a couple’s names go to the QUEUE, never to a wall`
 * below is the test that stops a future session from "tightening" the rule
 * into emptying two categories.
 *
 * Every rule here was SABOTAGED before it was trusted. What each sabotage
 * proved is recorded on the test it proved it for.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findNameLike,
  findPhoneShaped,
  findPublishedContactHits,
  findQuestionableHits,
  parseScreenTranscript,
  qrHit,
  LOGO_MARK_SENTINEL,
  HEAVY_TEXT_LINES,
} from './moodboard-gallery-upload';
import {
  blockingHits,
  contentRejectionMessage,
  flaggedHits,
  parseScreenFindings,
  rejectionSentence,
  screenOutcome,
  HIT_SEVERITY,
  HIT_LABEL,
  type ContentHit,
  type ContentHitKind,
} from './moodboard-screen-findings';

/* ══════════════════════════════════════════════════════════════════════════
   1 · THE WIDENED HARD BLOCKS — a URL, a handle, an email
   ══════════════════════════════════════════════════════════════════════════ */

test('⭐ THE GUARD · a URL, a handle and an email are BLOCKED, and named', () => {
  // Sabotage run: moved `any_url` to 'flag' in HIT_SEVERITY. `blocked` went
  // false, this test went RED on the outcome assertion — which is the whole
  // point of the severity map being a Record over the full union.
  const cases: Array<[string, ContentHitKind, string]> = [
    ['Follow us at www.bloomandvine.ph for more', 'any_url', 'www.bloomandvine.ph'],
    ['bloomandvine.com', 'any_url', 'bloomandvine.com'],
    ['https://linktr.ee/bloomandvine', 'any_url', 'https://linktr.ee/bloomandvine'],
    ['Say hello: hello@bloomandvine.ph', 'any_email', 'hello@bloomandvine.ph'],
    ['@bloomandvine on IG', 'any_social_handle', '@bloomandvine'],
  ];
  for (const [text, kind, found] of cases) {
    const hits = findPublishedContactHits(text);
    const hit = hits.find((h) => h.kind === kind);
    assert.ok(hit, `${text} → expected a ${kind} hit, got ${JSON.stringify(hits)}`);
    assert.equal(hit.found, found, `${text} → should echo what it matched`);
    assert.equal(HIT_SEVERITY[kind], 'block');
    assert.equal(screenOutcome(hits), 'blocked');

    // THE MESSAGE NAMES WHAT WAS FOUND — the whole difference between a gate a
    // supplier can clear and a wall they bounce off.
    const message = contentRejectionMessage(hits);
    assert.ok(message.includes(HIT_LABEL[kind]), `message must name ${kind}`);
    assert.ok(
      message.includes(found),
      `message must echo the string itself, got: ${message}`,
    );
  }
});

test('one string on one sign is ONE finding, not three', () => {
  // `hello@bloomandvine.com` is an email, and it also contains a bare host and
  // an `@handle`. Reporting all three hands a supplier a refusal listing three
  // problems for one line of text on one card.
  const hits = findPublishedContactHits('hello@bloomandvine.com');
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.equal(hits[0].kind, 'any_email');
});

test('a date, a time and a name with a full stop are NOT web addresses', () => {
  // Sabotage run: replaced the TLD allow-list with `\.[a-z]{2,}`. This test
  // went RED on every line below — each one BLOCKS an honest supplier.
  for (const text of [
    'Mr. and Mrs. Reyes',
    'Reception starts at 6.30 p.m.',
    'Est. 2019',
    'Table no. 12',
    'St. Therese Chapel',
  ]) {
    assert.deepEqual(
      findPublishedContactHits(text),
      [],
      `${text} must not be read as a web address`,
    );
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   2 · 🛑 NAMES GO TO THE QUEUE. NEVER TO A WALL.
   ══════════════════════════════════════════════════════════════════════════ */

test('⭐ THE GUARD · a couple’s names go to the QUEUE, never to a wall', () => {
  // 🔑 SABOTAGE PERFORMED AND UNDONE: `unfamiliar_name` was flipped to 'block'
  // in HIT_SEVERITY. This test went RED on BOTH assertions — `blocked` and the
  // refusal message — and every backdrop and stage photograph in the country
  // would have been refused. Restored immediately.
  const text = 'Aira & Nico\n14 February 2027';
  const blocks = findPublishedContactHits(text);
  const flags = findQuestionableHits({ extractedText: text, blocked: blocks });
  const all = [...blocks, ...flags];

  assert.equal(blockingHits(all).length, 0, 'a name may never block an upload');
  assert.equal(contentRejectionMessage(all), '', 'no refusal sentence for a name');
  assert.equal(screenOutcome(all), 'flagged', 'it must still reach a human');
  assert.ok(
    flags.some((h) => h.kind === 'unfamiliar_name' && h.found.includes('Aira')),
    `expected the name in the findings, got ${JSON.stringify(flags)}`,
  );
});

test('names joined by & or "and" are ONE finding', () => {
  assert.deepEqual(findNameLike('Aira & Nico'), ['Aira & Nico']);
  assert.deepEqual(findNameLike('Aira and Nico'), ['Aira and Nico']);
});

test('welcome-sign boilerplate is not reported as a name', () => {
  // A flag on every photograph is a flag on none — an admin who sees the mark
  // everywhere stops reading it, and the one real finding goes past unread.
  for (const text of [
    'WELCOME TO OUR WEDDING',
    'Please Be Seated',
    'Save The Date',
    'Open Bar',
    'Manila Hotel Ballroom',
    'Thank You',
  ]) {
    assert.deepEqual(findNameLike(text), [], `${text} must not read as a name`);
  }
});

test('a single word is not a name — a monogram is not a finding', () => {
  assert.deepEqual(findNameLike('Isabel'), []);
  assert.deepEqual(findNameLike('A & N'), []);
});

/* ══════════════════════════════════════════════════════════════════════════
   3 · THE OTHER THREE FLAGS
   ══════════════════════════════════════════════════════════════════════════ */

test('a phone-shaped run FLAGS, and a table number does not', () => {
  assert.deepEqual(findPhoneShaped('0917 880 7163'), ['0917 880 7163']);
  assert.deepEqual(findPhoneShaped('+63 2 8888 1234'), ['+63 2 8888 1234']);
  // The false positives lib/moodboard-gallery-upload.ts's docblock names.
  for (const text of ['Table 12', '14 February 2027', 'Php 9,000', '6:30 PM']) {
    assert.deepEqual(findPhoneShaped(text), [], `${text} must not read as a phone`);
  }
  const flags = findQuestionableHits({ extractedText: '0917 880 7163' });
  assert.equal(HIT_SEVERITY['phone_shaped'], 'flag');
  assert.equal(screenOutcome(flags), 'flagged');
});

test('a wall of printed text FLAGS', () => {
  const menu = Array.from({ length: HEAVY_TEXT_LINES + 1 }, (_, i) => `Course ${i}`).join('\n');
  const flags = findQuestionableHits({ extractedText: menu });
  assert.ok(flags.some((h) => h.kind === 'heavy_text'), JSON.stringify(flags));
  assert.equal(screenOutcome(flags), 'flagged');
});

test('a logo-style mark FLAGS only when the model actually said so', () => {
  assert.ok(
    findQuestionableHits({ extractedText: '', logoMark: true }).some(
      (h) => h.kind === 'logo_mark',
    ),
  );
  // 🔑 UNKNOWN IS NOT "NO". The model declining to answer must not be recorded
  // as a clean logo check — that is the silent-non-answer failure this repo
  // keeps paying for.
  assert.deepEqual(findQuestionableHits({ extractedText: '', logoMark: null }), []);
  assert.deepEqual(findQuestionableHits({ extractedText: '', logoMark: false }), []);
});

test('a block is not reported a second time as a flag', () => {
  const text = 'Call 0917 880 7163 · @bloomandvine';
  const blocks = findPublishedContactHits(text);
  const flags = findQuestionableHits({ extractedText: text, blocked: blocks });
  assert.ok(blocks.some((h) => h.kind === 'any_social_handle'));
  assert.equal(
    flags.filter((h) => h.found.includes('bloomandvine')).length,
    0,
    'the handle is already a block — flagging it again double-counts one string',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   4 · THE SENTINEL — parsed, and STRIPPED before any rule reads the text
   ══════════════════════════════════════════════════════════════════════════ */

test('⭐ THE GUARD · the LOGO MARK line never reaches the text rules', () => {
  // Sabotage run: returned the raw reply from parseScreenTranscript instead of
  // the stripped text. This test went RED — and in production EVERY photo would
  // have arrived at the admin queue flagged for a name that is our own prompt.
  const reply = 'Aira & Nico\nLOGO MARK: no';
  const parsed = parseScreenTranscript(reply);
  assert.equal(parsed.text, 'Aira & Nico');
  assert.equal(parsed.logoMark, false);
  assert.ok(!parsed.text.includes(LOGO_MARK_SENTINEL));
  assert.deepEqual(findNameLike(parsed.text), ['Aira & Nico']);
});

test('NO TEXT is an empty transcript, and a missing sentinel is unknown', () => {
  assert.deepEqual(parseScreenTranscript('NO TEXT'), { text: '', logoMark: null });
  assert.deepEqual(parseScreenTranscript('NO TEXT\nLOGO MARK: yes'), {
    text: '',
    logoMark: true,
  });
  assert.equal(parseScreenTranscript('Aira & Nico').logoMark, null);
});

/* ══════════════════════════════════════════════════════════════════════════
   5 · THE THREE OUTCOMES, AND THE TWO SENTENCES
   ══════════════════════════════════════════════════════════════════════════ */

test('every hit kind has a severity and a label — no kind may default', () => {
  for (const kind of Object.keys(HIT_SEVERITY) as ContentHitKind[]) {
    assert.ok(HIT_LABEL[kind], `${kind} has no label`);
    assert.ok(['block', 'flag'].includes(HIT_SEVERITY[kind]));
  }
});

test('a block outranks a flag', () => {
  const mixed: ContentHit[] = [
    { kind: 'unfamiliar_name', label: HIT_LABEL.unfamiliar_name, found: 'Aira & Nico' },
    { kind: 'qr_code', label: HIT_LABEL.qr_code, found: 'https://x' },
  ];
  assert.equal(screenOutcome(mixed), 'blocked');
  assert.equal(blockingHits(mixed).length, 1);
  assert.equal(flaggedHits(mixed).length, 1);
  // And the refusal names ONLY the block — a supplier told "we found a name"
  // has nothing to fix, because names are allowed.
  const message = contentRejectionMessage(mixed);
  assert.ok(message.includes(HIT_LABEL.qr_code));
  assert.ok(!message.includes(HIT_LABEL.unfamiliar_name));
});

test('MB11’s own-value wording is byte-identical — the tested sentence survives', () => {
  const own: ContentHit[] = [
    { kind: 'phone', label: HIT_LABEL.phone, found: '0917 880 7163' },
  ];
  assert.equal(
    contentRejectionMessage(own),
    'We can’t add this photo yet: we found your phone number in it. Upload a clean version without it — your shop is already credited under every photo, so couples can still find you.',
  );
  assert.match(contentRejectionMessage([qrHit('https://x')]), /QR code in the picture/);
});

test('the vendor’s rejection sentence is framed, never a bare fragment', () => {
  assert.equal(
    rejectionSentence('there’s a phone number on the sign behind the cake'),
    'We couldn’t publish this: there’s a phone number on the sign behind the cake.',
  );
  // An already-punctuated reason is not double-stopped.
  assert.equal(rejectionSentence('It is blurry.'), 'We couldn’t publish this: It is blurry.');
  // A blank reason renders nothing rather than "We couldn’t publish this: ."
  for (const empty of ['', '   ', null, undefined]) {
    assert.equal(rejectionSentence(empty), '');
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   6 · READING BACK WHAT AN OLDER VERSION WROTE
   ══════════════════════════════════════════════════════════════════════════ */

test('parseScreenFindings is total — it never throws and never invents', () => {
  assert.equal(parseScreenFindings(null), null);
  assert.equal(parseScreenFindings('not an object'), null);
  assert.equal(parseScreenFindings([]), null);

  // An unknown kind from a future (or older) writer is DROPPED, not rendered
  // with `undefined` as its label.
  const parsed = parseScreenFindings({
    outcome: 'flagged',
    hits: [
      { kind: 'unfamiliar_name', label: 'a name', found: 'Aira & Nico' },
      { kind: 'a_kind_that_does_not_exist', label: 'x', found: 'y' },
    ],
    text: 'Aira & Nico',
    textScreen: 'ran',
    screenedAt: '2026-09-05T00:00:00.000Z',
  });
  assert.ok(parsed);
  assert.equal(parsed.hits.length, 1);
  assert.equal(parsed.hits[0].kind, 'unfamiliar_name');

  // A missing outcome is DERIVED from the hits rather than defaulted to clean.
  const derived = parseScreenFindings({
    hits: [{ kind: 'any_url', label: 'a web address', found: 'x.com' }],
  });
  assert.equal(derived?.outcome, 'blocked');

  // A missing textScreen reads as 'unavailable' — a check we cannot prove ran
  // must never read as one that ran.
  assert.equal(parseScreenFindings({ hits: [] })?.textScreen, 'unavailable');
});
