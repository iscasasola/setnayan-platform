/**
 * card-health — the deterministic quality score behind the zero-step maker.
 *
 * The matrix below is the specification. Two things it is deliberately strict
 * about:
 *   • the SCORE CAPS (blocker 30 / warning 60 / hint 80), because those are the
 *     rule that makes the number mean anything — see § NEUTRALISATION;
 *   • the COACH, because the maker has no navigation and that one line is the
 *     navigation. A finding whose sheet is wrong is a dead end on screen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BLOCKED_SCORE_CAP,
  HINT_SCORE_CAP,
  READY_LABEL,
  SCORE_FLOOR,
  WARNING_SCORE_CAP,
  cardHealthLinesFromDraft,
  scoreCardHealth,
  type CardHealthLine,
  type CardHealthSnapshot,
} from './card-health';
import { PUBLISH_COACH_MESSAGE } from './service-publish-gate';
import {
  applyLineState,
  newFollowUpLine,
  newLine,
} from './service-customization-draft';

const INTEGRITY_KEY = 'NEXT_PUBLIC_SERVICE_TEXT_INTEGRITY_ENABLED';

/** Run `fn` with the card-text integrity gate forced on / off. */
function withIntegrity(on: boolean, fn: () => void) {
  const prev = process.env[INTEGRITY_KEY];
  try {
    if (on) process.env[INTEGRITY_KEY] = 'true';
    else delete process.env[INTEGRITY_KEY];
    fn();
  } finally {
    if (prev === undefined) delete process.env[INTEGRITY_KEY];
    else process.env[INTEGRITY_KEY] = prev;
  }
}

/** A choice line the couple can genuinely answer. */
function choice(label: string, options: string[], pick?: [number, number]): CardHealthLine {
  return {
    label,
    state: 'choice',
    isFollowUp: false,
    optionLabels: options,
    pickMin: pick ? pick[0] : null,
    pickMax: pick ? pick[1] : null,
  };
}

function plain(label: string, state: CardHealthLine['state']): CardHealthLine {
  return {
    label,
    state,
    isFollowUp: false,
    optionLabels: [],
    pickMin: null,
    pickMax: null,
  };
}

/**
 * A card with NOTHING wrong with it: cover, gallery, clip, exclusive, an
 * answerable choice, and an audience. Every case below is this minus one thing.
 */
function perfect(over: Partial<CardHealthSnapshot> = {}): CardHealthSnapshot {
  return {
    hasCover: true,
    photoCount: 5,
    hasClip: true,
    hasPrice: true,
    title: 'Catering — buffet & plated',
    exclusiveText: 'Free dessert-table upgrade for Setnayan couples',
    inclusionLabels: ['Same-day highlight reel'],
    discountConditions: ['Book at least 6 months ahead'],
    lines: [
      plain('Buffet for your guest count', 'required'),
      choice('Main course', ['Lechon belly', 'Kare-kare', 'Beef caldereta']),
    ],
    eventTypes: ['wedding'],
    faiths: [],
    ...over,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// 1 · The clean card
// ════════════════════════════════════════════════════════════════════════════

test('a complete card scores 100 / excellent and the coach says ready', () => {
  const h = scoreCardHealth(perfect());
  assert.deepEqual(h.blockers, []);
  assert.deepEqual(h.warnings, []);
  assert.deepEqual(h.hints, []);
  assert.equal(h.score, 100);
  assert.equal(h.grade, 'excellent');
  assert.equal(h.band, 'This card sells itself.');
  assert.deepEqual(h.nextAction, { label: READY_LABEL, sheet: null });
});

test('empty faiths is NOT a finding — empty means "all faiths welcomed"', () => {
  const h = scoreCardHealth(perfect({ faiths: [] }));
  assert.equal(h.hints.length, 0);
  assert.equal(h.score, 100);
});

// ════════════════════════════════════════════════════════════════════════════
// 2 · Blockers — the real publish gate
// ════════════════════════════════════════════════════════════════════════════

test('no cover photo blocks, and points at the media sheet', () => {
  const h = scoreCardHealth(perfect({ hasCover: false }));
  assert.equal(h.grade, 'blocked');
  assert.equal(h.blockers.length, 1);
  assert.equal(h.blockers[0]?.code, 'no_cover');
  assert.equal(h.blockers[0]?.sheet, 'media');
  assert.equal(h.nextAction.sheet, 'media');
  assert.equal(h.nextAction.label, '▸ Next: Add a cover photo — required to publish.');
});

test('an empty Setnayan Exclusive blocks, and points at the exclusive sheet', () => {
  const h = scoreCardHealth(perfect({ exclusiveText: '   ' }));
  assert.equal(h.grade, 'blocked');
  assert.equal(h.blockers[0]?.code, 'no_exclusive');
  assert.equal(h.nextAction.sheet, 'excl');
});

test('pick-N above the option count blocks — the couple could never finish it', () => {
  const h = scoreCardHealth(
    perfect({ lines: [choice('Main course', ['Lechon', 'Kare-kare'], [1, 3])] }),
  );
  const blocker = h.blockers.find((b) => b.code === 'pick_overflow');
  assert.ok(blocker, 'pick_overflow blocker expected');
  assert.equal(blocker?.sheet, 'custom');
  assert.match(blocker?.message ?? '', /pick 3 of 2/);
});

test('pick-N equal to the option count is fine (pick all of them)', () => {
  const h = scoreCardHealth(
    perfect({ lines: [choice('Main course', ['Lechon', 'Kare-kare'], [1, 2])] }),
  );
  assert.equal(h.blockers.length, 0);
});

test('a blank line name is auto-named in the quote, never a blocker of its own', () => {
  const h = scoreCardHealth(
    perfect({ lines: [choice('', ['Lechon', 'Kare-kare'], [1, 5])] }),
  );
  const blocker = h.blockers.find((b) => b.code === 'pick_overflow');
  // 1-based, because a human reads it on a public card.
  assert.match(blocker?.message ?? '', /“Item 1”/);
});

// ── card TEXT, judged by the shipped 'card' profile ─────────────────────────

test('contact info in the title blocks and points at the inline title field', () => {
  withIntegrity(true, () => {
    const h = scoreCardHealth(perfect({ title: 'Catering — book at juan@example.com' }));
    const blocker = h.blockers.find((b) => b.code === 'text_title');
    assert.ok(blocker, 'text_title blocker expected');
    assert.equal(blocker?.sheet, 'title');
    // The server's own label, verbatim — the vendor reads one sentence, not two.
    assert.match(blocker?.message ?? '', /^Title: /);
  });
});

test('contact info in the Exclusive blocks and points at the exclusive sheet', () => {
  withIntegrity(true, () => {
    const h = scoreCardHealth(
      perfect({ exclusiveText: 'Free upgrade — text 0917 555 1234' }),
    );
    const blocker = h.blockers.find((b) => b.code === 'text_exclusive');
    assert.ok(blocker, 'text_exclusive blocker expected');
    assert.equal(blocker?.sheet, 'excl');
  });
});

// ── THE GATE-MIRROR CASES ───────────────────────────────────────────────────
// These four fields are what `commitVendorService` checks. Card health checked
// two of them and not the other two, so a contact number in an inclusion label
// scored 100 / "Ready to publish" and was then bounced by the server. Each test
// below pins one field the real gate checks.

test('contact info in an INCLUSION label blocks — the real gate checks it', () => {
  withIntegrity(true, () => {
    const h = scoreCardHealth(
      perfect({ inclusionLabels: ['Free album — text 0917 555 1234'] }),
    );
    const blocker = h.blockers.find((b) => b.code === 'text_inclusions');
    assert.ok(blocker, 'text_inclusions blocker expected — the server would bounce this save');
    // The InclusionsEditor is mounted in "What couples get".
    assert.equal(blocker?.sheet, 'custom');
    // The server's own label, so the two messages are the same sentence.
    assert.match(blocker?.message ?? '', /^Inclusion 1: /);
    assert.equal(h.grade, 'blocked');
    assert.ok(h.score <= 30);
  });
});

test('the inclusion index in the message is the row the vendor sees (1-based)', () => {
  withIntegrity(true, () => {
    const h = scoreCardHealth(
      perfect({
        inclusionLabels: ['Same-day highlight reel', 'Free shoot', 'Reach us at a@b.com'],
      }),
    );
    assert.match(
      h.blockers.find((b) => b.code === 'text_inclusions')?.message ?? '',
      /^Inclusion 3: /,
    );
  });
});

test('contact info in DISCOUNT conditions blocks and points at the price sheet', () => {
  withIntegrity(true, () => {
    const h = scoreCardHealth(
      perfect({ discountConditions: ['Message us at promos@example.com to claim'] }),
    );
    const blocker = h.blockers.find((b) => b.code === 'text_discounts');
    assert.ok(blocker, 'text_discounts blocker expected');
    assert.equal(blocker?.sheet, 'price');
    assert.match(blocker?.message ?? '', /^Discount 1 conditions: /);
    assert.equal(h.grade, 'blocked');
  });
});

test('a BLANK discount conditions row does not renumber the ones after it', () => {
  withIntegrity(true, () => {
    // Row 1 blank (the editor seeds it that way), row 2 dirty. The vendor is
    // told "Discount 2", which is the row they can actually see and fix.
    const h = scoreCardHealth(
      perfect({ discountConditions: ['', 'Ring us on 0917 555 1234'] }),
    );
    assert.match(
      h.blockers.find((b) => b.code === 'text_discounts')?.message ?? '',
      /^Discount 2 conditions: /,
    );
  });
});

test('clean inclusions and discount conditions leave the score untouched', () => {
  withIntegrity(true, () => {
    const h = scoreCardHealth(
      perfect({
        inclusionLabels: ['Same-day highlight reel', '9x12 album', 'Buffet for 150 pax'],
        discountConditions: ['Book at least 6 months ahead', 'Valid 2026-09-17 - 2026-12-31'],
      }),
    );
    assert.deepEqual(h.blockers, []);
    assert.equal(h.score, 100);
    assert.equal(h.grade, 'excellent');
  });
});

test('every field the real gate checks is a lane in card health', () => {
  withIntegrity(true, () => {
    // One dirty value in each of the five checked field groups at once.
    const h = scoreCardHealth(
      perfect({
        title: 'Catering — juan@example.com',
        exclusiveText: 'Free upgrade — text 0917 555 1234',
        inclusionLabels: ['Free album — chef@example.com'],
        discountConditions: ['Ping promos@example.com'],
        lines: [choice('Main course', ['Lechon belly', 'Email chef@example.com'])],
      }),
    );
    assert.deepEqual(
      h.blockers.map((b) => b.code).sort(),
      ['text_discounts', 'text_exclusive', 'text_inclusions', 'text_lines', 'text_title'],
      'a field the server checks and card health does not is a false "Ready to publish"',
    );
  });
});

test('a customization option message uses the server’s own field label', () => {
  withIntegrity(true, () => {
    const h = scoreCardHealth(
      perfect({ lines: [choice('Main course', ['Lechon belly', 'Email chef@example.com'])] }),
    );
    assert.match(
      h.blockers.find((b) => b.code === 'text_lines')?.message ?? '',
      /^Customization line 1 option 2: /,
    );
  });
});

test('contact info in an option label blocks and points at the customization sheet', () => {
  withIntegrity(true, () => {
    const h = scoreCardHealth(
      perfect({
        lines: [choice('Main course', ['Lechon belly', 'Email chef@example.com'])],
      }),
    );
    const blocker = h.blockers.find((b) => b.code === 'text_lines');
    assert.ok(blocker, 'text_lines blocker expected');
    assert.equal(blocker?.sheet, 'custom');
  });
});

test('with the integrity gate OFF there are no text blockers — the score mirrors the REAL gate', () => {
  withIntegrity(false, () => {
    const h = scoreCardHealth(perfect({ title: 'Catering — book at juan@example.com' }));
    assert.equal(h.blockers.length, 0);
    assert.equal(h.grade, 'excellent');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3 · Warnings + hints
// ════════════════════════════════════════════════════════════════════════════

test('more than six top-level questions warns; follow-ups do not count', () => {
  const questions = Array.from({ length: 7 }, (_, i) => plain(`Extra ${i}`, 'optional'));
  const h = scoreCardHealth(perfect({ lines: questions }));
  assert.equal(h.questionCount, 7);
  const warn = h.warnings.find((w) => w.code === 'too_many_questions');
  assert.ok(warn, 'too_many_questions warning expected');
  assert.equal(warn?.sheet, 'custom');

  // The same seven, but one is a follow-up → six top-level → no warning.
  const withFollowUp: CardHealthLine[] = questions.map((q, i) =>
    i === 0 ? { ...q, isFollowUp: true } : q,
  );
  const quieter = scoreCardHealth(perfect({ lines: withFollowUp }));
  assert.equal(quieter.questionCount, 6);
  assert.equal(quieter.warnings.length, 0);
});

test('exactly six questions is inside the budget', () => {
  const six = Array.from({ length: 6 }, (_, i) => plain(`Extra ${i}`, 'optional'));
  assert.equal(scoreCardHealth(perfect({ lines: six })).warnings.length, 0);
});

test('a thin gallery hints — unless there is a clip', () => {
  const thin = scoreCardHealth(perfect({ photoCount: 2, hasClip: false }));
  const hint = thin.hints.find((x) => x.code === 'thin_media');
  assert.ok(hint, 'thin_media hint expected');
  assert.equal(hint?.sheet, 'media');

  const withClip = scoreCardHealth(perfect({ photoCount: 0, hasClip: true }));
  assert.equal(withClip.hints.length, 0);

  const withPhotos = scoreCardHealth(perfect({ photoCount: 3, hasClip: false }));
  assert.equal(withPhotos.hints.length, 0);
});

test('a choice of one hints at the customization sheet', () => {
  const h = scoreCardHealth(perfect({ lines: [choice('Main course', ['Lechon'])] }));
  const hint = h.hints.find((x) => x.code === 'choice_of_one');
  assert.ok(hint, 'choice_of_one hint expected');
  assert.equal(hint?.sheet, 'custom');
  assert.match(hint?.message ?? '', /“Main course”/);
});

test('no event types hints at the audience sheet', () => {
  const h = scoreCardHealth(perfect({ eventTypes: [] }));
  const hint = h.hints.find((x) => x.code === 'no_event_types');
  assert.ok(hint, 'no_event_types hint expected');
  assert.equal(hint?.sheet, 'audience');
});

test('NO PRICE IS A BLOCKER — a card nobody can find must not go live', () => {
  // ⚖ THIS REVERSES THIS FILE'S OWN EARLIER TEST, deliberately (owner-drawn
  // 2026-08-28). It used to assert "no price is a HINT, never a blocker,
  // because quote-on-request is a real answer". That was an engineering
  // rationale, never an owner lock, and it is now the other way: a card with no
  // figure has nothing a couple's budget can be matched against.
  const h = scoreCardHealth(perfect({ hasPrice: false }));
  assert.equal(
    h.hints.find((x) => x.code === 'no_price'),
    undefined,
    'no_price must no longer be a hint',
  );
  const blocker = h.blockers.find((x) => x.code === 'no_price');
  assert.ok(blocker, 'no_price blocker expected');
  assert.equal(blocker?.sheet, 'price');
  assert.equal(h.grade, 'blocked');
  assert.ok(h.score <= 30, `a blocked card is capped at 30, got ${h.score}`);
  assert.equal(h.nextAction.sheet, 'price');
});

test('the price blocker speaks the SAME sentence the maker uses everywhere', () => {
  const h = scoreCardHealth(perfect({ hasPrice: false }));
  assert.equal(
    h.blockers.find((x) => x.code === 'no_price')?.message,
    PUBLISH_COACH_MESSAGE.price,
    'card health kept its own copy of the price sentence',
  );
});

test('a priced, exclusive-bearing card has neither publish blocker', () => {
  const h = scoreCardHealth(perfect({ hasPrice: true, exclusiveText: 'Free extra hour' }));
  assert.equal(h.blockers.find((x) => x.code === 'no_price'), undefined);
  assert.equal(h.blockers.find((x) => x.code === 'no_exclusive'), undefined);
});

// ════════════════════════════════════════════════════════════════════════════
// 4 · The number
// ════════════════════════════════════════════════════════════════════════════

test('one hint caps the score at 80 (never "excellent")', () => {
  const h = scoreCardHealth(perfect({ eventTypes: [] }));
  assert.equal(h.hints.length, 1);
  assert.equal(h.score, HINT_SCORE_CAP);
  assert.equal(h.grade, 'good');
});

test('two hints deduct below the cap rather than sitting on it', () => {
  const h = scoreCardHealth(perfect({ eventTypes: [], photoCount: 0, hasClip: false }));
  assert.equal(h.hints.length, 2);
  assert.equal(h.score, 76); // 100 − 12 − 12, already under the 80 ceiling
  assert.equal(h.grade, 'good');
});

test('one warning caps the score at 60', () => {
  const seven = Array.from({ length: 7 }, (_, i) => plain(`Extra ${i}`, 'optional'));
  const h = scoreCardHealth(perfect({ lines: seven }));
  assert.equal(h.warnings.length, 1);
  assert.equal(h.hints.length, 0);
  assert.equal(h.score, WARNING_SCORE_CAP);
  assert.equal(h.grade, 'average');
});

test('deductions can push a warned card down to "poor"', () => {
  const lines: CardHealthLine[] = [
    choice('Cake', ['Chiffon']),
    choice('Drinks', ['Iced tea']),
    choice('Table linen', ['White']),
    plain('Extra hour', 'optional'),
    plain('Extra server', 'optional'),
    plain('Chafing dish', 'optional'),
    plain('Ice sculpture', 'optional'),
  ];
  const h = scoreCardHealth(
    perfect({ lines, eventTypes: [], photoCount: 0, hasClip: false }),
  );
  assert.equal(h.warnings.length, 1); // 7 top-level questions
  assert.equal(h.hints.length, 5); // 3 × choice-of-one + thin media + no audience
  assert.equal(h.score, 25); // 100 − 15 − 60
  assert.equal(h.grade, 'poor');
});

test('the score never falls below the floor', () => {
  const lines: CardHealthLine[] = Array.from({ length: 8 }, (_, i) =>
    choice(`Pick ${i}`, ['Only one']),
  );
  const h = scoreCardHealth(
    perfect({ lines, eventTypes: [], photoCount: 0, hasClip: false }),
  );
  // 8 choice-of-one + thin media + no audience = 10 hints, plus the question
  // warning: raw arithmetic is deeply negative.
  assert.ok(h.hints.length >= 10);
  assert.equal(h.score, SCORE_FLOOR);
  assert.equal(h.grade, 'poor');
});

// ── NEUTRALISATION ──────────────────────────────────────────────────────────
// Break the blocked-cap in card-health.ts (drop the `Math.min(score,
// BLOCKED_SCORE_CAP)` line, or raise BLOCKED_SCORE_CAP) and THIS test fails:
// the otherwise-flawless card below would score 100 while being unpublishable.
// That is the whole rule — an ad that cannot run has no quality.
test('NEUTRALISATION — a blocker caps the score at 30 and forces grade "blocked"', () => {
  // Everything right except the cover: no warnings, no hints, so the only
  // thing standing between this card and 100 is the cap itself.
  const h = scoreCardHealth(perfect({ hasCover: false }));
  assert.equal(h.warnings.length, 0, 'guard: the fixture must have no warnings');
  assert.equal(h.hints.length, 0, 'guard: the fixture must have no hints');
  assert.equal(h.blockers.length, 1, 'guard: exactly one blocker');
  assert.equal(h.score, BLOCKED_SCORE_CAP);
  assert.ok(h.score <= BLOCKED_SCORE_CAP, 'a blocked card must never score above the cap');
  assert.equal(h.grade, 'blocked');
  assert.equal(h.band, 'Fix the items below — this card can’t publish yet.');
});

test('NEUTRALISATION — a blocker outranks every warning and hint in the coach', () => {
  const lines: CardHealthLine[] = [
    ...Array.from({ length: 7 }, (_, i) => plain(`Extra ${i}`, 'optional')),
    choice('Cake', ['Chiffon']),
  ];
  const h = scoreCardHealth(
    perfect({ hasCover: false, lines, eventTypes: [], photoCount: 0, hasClip: false }),
  );
  assert.ok(h.warnings.length > 0 && h.hints.length > 0, 'guard: all three lanes populated');
  assert.equal(h.score, BLOCKED_SCORE_CAP);
  assert.equal(h.nextAction.sheet, 'media');
  assert.match(h.nextAction.label, /^▸ Next: Add a cover photo/);
});

test('the coach falls back warning → hint → ready', () => {
  const seven = Array.from({ length: 7 }, (_, i) => plain(`Extra ${i}`, 'optional'));
  const warned = scoreCardHealth(perfect({ lines: seven, eventTypes: [] }));
  assert.ok(warned.warnings.length > 0 && warned.hints.length > 0);
  assert.equal(warned.nextAction.sheet, 'custom');
  assert.match(warned.nextAction.label, /^▸ Next: Couples answer 7 questions/);

  const hinted = scoreCardHealth(perfect({ eventTypes: [] }));
  assert.equal(hinted.nextAction.sheet, 'audience');

  const clean = scoreCardHealth(perfect());
  assert.deepEqual(clean.nextAction, { label: READY_LABEL, sheet: null });
});

// ════════════════════════════════════════════════════════════════════════════
// 5 · The draft → snapshot conversion
// ════════════════════════════════════════════════════════════════════════════

test('cardHealthLinesFromDraft reads state, options and follow-up lineage', () => {
  const parent = applyLineState(newLine('a', 'catering.buffet', 'choice'), 'choice');
  const followUp = newFollowUpLine('b', 'catering.buffet', {
    itemRef: parent.ref,
    optionRef: parent.options[0]?.ref ?? 'o1',
  });
  const lines = cardHealthLinesFromDraft([parent, followUp]);

  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.state, 'choice');
  assert.equal(lines[0]?.isFollowUp, false);
  assert.equal(lines[0]?.optionLabels.length, parent.options.length);
  assert.equal(lines[1]?.isFollowUp, true);

  // A follow-up is not a top-level question — the budget must not count it.
  const h = scoreCardHealth(perfect({ lines }));
  assert.equal(h.questionCount, 1);
});

test('cardHealthLinesFromDraft normalises absent pick bounds to null', () => {
  const [line] = cardHealthLinesFromDraft([newLine('a', 'catering.buffet', 'included')]);
  assert.equal(line?.pickMin, null);
  assert.equal(line?.pickMax, null);
});
