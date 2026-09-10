/**
 * thread-decisions.test.ts — the Decisions view says where things stand NOW.
 *
 * ── What this exists to stop ────────────────────────────────────────────────
 * A filter that hides the chatter and lists the cards is easy. A filter that
 * lists what those cards SAID WHEN THEY WERE SENT is worse than no filter at
 * all: scrolling a conversation shows you the correction three bubbles later,
 * and a list vouched for by a filter does not. The couple reads "₱187,500 —
 * quoted" for a quote that was accepted six weeks ago and believes it.
 *
 * So the assertions below are mostly of one shape: **build an entry whose
 * announcement and whose current row DISAGREE, then prove the output follows
 * the row.** A test that fed agreeing values would pass against a function that
 * simply echoed the announcement — the exact proxy failure this repo keeps
 * producing.
 *
 * 🛡 The stage-pill rule is asserted EXHAUSTIVELY over the shipped status
 * vocabularies, not on one fixture per kind. "Meetings and payments never wear
 * a pill" is a claim about every status those rows can hold, and a single
 * happy-path fixture would miss the one branch that grew a pill.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildThreadDecisions,
  decisionsNeedingYou,
  decisionStageWord,
  DECISION_VOICE,
  type DecisionEntry,
  type DecisionKind,
  type DecisionViewer,
  type ThreadDecisionFacts,
} from '@/lib/thread-decisions';

/** 2026-09-09 12:00 Manila. Every fixture is dated against this. */
const NOW = Date.parse('2026-09-09T04:00:00.000Z');
const AUG_22 = Date.parse('2026-08-22T02:51:00.000Z');
const SEP_01 = Date.parse('2026-09-01T06:05:00.000Z');
const SEP_05 = Date.parse('2026-09-05T08:30:00.000Z');
const SEP_08 = Date.parse('2026-09-08T11:44:00.000Z');

function facts(over: Partial<ThreadDecisionFacts> = {}): ThreadDecisionFacts {
  return {
    viewer: 'couple',
    nowMs: NOW,
    quotes: [],
    meetings: [],
    adjustments: [],
    payments: [],
    guestCounts: [],
    ...over,
  };
}


/**
 * The one entry this fixture should have produced.
 *
 * Stronger than `entries[0]!`: it also fails when the merge emits a DUPLICATE,
 * which is the likeliest way a three-source merge breaks — the same row
 * arriving from two of them.
 */
function only(entries: readonly DecisionEntry[]): DecisionEntry {
  assert.equal(entries.length, 1, `expected exactly one entry, got ${entries.length}`);
  return entries[0] as DecisionEntry;
}

/* ───────────────────────────────────────────────────────────────────────────
 * 1 · THE RULE THE WHOLE THING RESTS ON
 * ──────────────────────────────────────────────────────────────────────── */

test('a quote sent in August and accepted in September reads as accepted, not as quoted', () => {
  const entry = only(buildThreadDecisions(
    facts({
      quotes: [
        {
          proposalId: 'p1',
          announcedAtMs: AUG_22, // announced six weeks before "now"
          title: 'Garden Buffet · 150 guests',
          totalPhp: 187_500,
          status: 'accepted', // …and the live row says it is settled
          decidedAtMs: SEP_01,
        },
      ],
    }),
  ));

  // The NOW line follows the row, and carries the date the row was decided —
  // NOT the date it was announced.
  assert.equal(entry.now.text, 'Accepted · 1 Sep');
  assert.equal(decisionStageWord(entry), 'Booked');
  assert.equal(entry.now.needsYou, false);

  // And the announcement is still visible as context, so the entry can be
  // placed in the conversation — it just is not the verdict.
  assert.equal(entry.sentLabel, 'sent 22 Aug');
});

test('an unanswered quote is the couple’s to answer and the supplier’s to wait for', () => {
  const open = {
    proposalId: 'p1',
    announcedAtMs: SEP_05,
    title: 'Garden Buffet',
    totalPhp: 187_500,
    status: 'sent',
    decidedAtMs: null,
  };

  const asCouple = only(buildThreadDecisions(facts({ viewer: 'couple', quotes: [open] })));
  const asVendor = only(buildThreadDecisions(facts({ viewer: 'vendor', quotes: [open] })));

  assert.match(asCouple.now.text, /^Waiting on you · 3 days$/);
  assert.equal(asCouple.now.needsYou, true);

  assert.match(asVendor.now.text, /^Waiting on them · 3 days$/);
  assert.equal(asVendor.now.needsYou, false);

  // Same row, same rung — only the direction of the wait changes.
  assert.equal(decisionStageWord(asCouple), 'Quoted');
  assert.equal(decisionStageWord(asVendor), 'Quoted');
});

/* ───────────────────────────────────────────────────────────────────────────
 * 2 · A MEETING THAT MOVED
 * ──────────────────────────────────────────────────────────────────────── */

const SAT_26 = Date.parse('2026-09-26T06:00:00.000Z'); // Sat 26 Sep, 2 PM Manila
const SUN_27 = Date.parse('2026-09-27T03:00:00.000Z'); // Sun 27 Sep, 11 AM Manila

test('a meeting that moved strikes through the old time and confirms the new one', () => {
  const entry = only(buildThreadDecisions(
    facts({
      meetings: [
        {
          appointmentId: 'a1',
          announcedAtMs: Date.parse('2026-08-25T01:12:00.000Z'),
          title: 'Tasting at your kitchen',
          scheduledAtMs: SUN_27,
          previousScheduledAtMs: SAT_26,
          status: 'confirmed',
          initiatedBy: 'couple',
        },
      ],
    }),
  ));

  // The old time survives ONLY because the migration preserves it; this is the
  // assertion that fails if that column or its writer is ever dropped.
  assert.match(entry.now.wasText ?? '', /26 Sep/);
  assert.match(entry.now.text, /Moved to/);
  assert.match(entry.now.text, /27 Sep/);
  assert.match(entry.now.text, /confirmed$/);
});

test('a meeting that never moved shows no strike-through', () => {
  const entry = only(buildThreadDecisions(
    facts({
      meetings: [
        {
          appointmentId: 'a1',
          announcedAtMs: AUG_22,
          title: 'Tasting',
          scheduledAtMs: SUN_27,
          previousScheduledAtMs: null,
          status: 'confirmed',
          initiatedBy: 'vendor',
        },
      ],
    }),
  ));
  assert.equal(entry.now.wasText, null);
  assert.doesNotMatch(entry.now.text, /Moved/);
});

test('a row touched without its time changing is not a move', () => {
  // `propose_new` writes previous_scheduled_at unconditionally. If a client
  // ever re-proposes the SAME instant, the card must not strike through a time
  // and then print the identical time beside it.
  const entry = only(buildThreadDecisions(
    facts({
      meetings: [
        {
          appointmentId: 'a1',
          announcedAtMs: AUG_22,
          title: 'Tasting',
          scheduledAtMs: SUN_27,
          previousScheduledAtMs: SUN_27,
          status: 'confirmed',
          initiatedBy: 'vendor',
        },
      ],
    }),
  ));
  assert.equal(entry.now.wasText, null);
  assert.doesNotMatch(entry.now.text, /Moved/);
});

test('a proposed time waits on whoever did not propose it', () => {
  const base = {
    appointmentId: 'a1',
    announcedAtMs: SEP_08,
    title: 'Tasting',
    scheduledAtMs: SUN_27,
    previousScheduledAtMs: null,
    status: 'proposed',
  };

  // The vendor proposed → the couple owes the yes.
  const couple = only(buildThreadDecisions(
    facts({ viewer: 'couple', meetings: [{ ...base, initiatedBy: 'vendor' }] }),
  ));
  assert.equal(couple.now.needsYou, true);
  assert.match(couple.now.text, /needs your yes/);

  // Same row read by the vendor → they are the ones waiting.
  const vendor = only(buildThreadDecisions(
    facts({ viewer: 'vendor', meetings: [{ ...base, initiatedBy: 'vendor' }] }),
  ));
  assert.equal(vendor.now.needsYou, false);
  assert.match(vendor.now.text, /waiting on them/);
});

/* ───────────────────────────────────────────────────────────────────────────
 * 3 · THREE SOURCES, ONE TIMELINE
 * ──────────────────────────────────────────────────────────────────────── */

test('the two page sections interleave with the message cards by date', () => {
  const entries = buildThreadDecisions(
    facts({
      quotes: [
        {
          proposalId: 'p1',
          announcedAtMs: AUG_22,
          title: 'Garden Buffet',
          totalPhp: 187_500,
          status: 'accepted',
          decidedAtMs: SEP_01,
        },
      ],
      // NOT a message — a page section rendered around the stream.
      payments: [
        {
          paymentId: 'pay1',
          loggedAtMs: SEP_05,
          amountPhp: 50_000,
          method: 'GCash',
          label: 'reservation fee',
          confirmedAtMs: null,
          ofTotalPhp: 187_500,
        },
      ],
      // Also not a message.
      guestCounts: [
        {
          id: 'g1',
          changedAtMs: SEP_08,
          livePax: 170,
          quotedPax: 150,
          surchargePhp: 25_000,
        },
      ],
    }),
  );

  // Oldest to newest, ACROSS the three sources — the whole point of the merge.
  assert.deepEqual(
    entries.map((e) => e.kind),
    ['quote', 'payment', 'guest_count'],
  );
  assert.deepEqual(
    entries.map((e) => e.atMs),
    [AUG_22, SEP_05, SEP_08],
  );
});

test('ties break totally, so two renders of one page cannot disagree', () => {
  const sameMs = SEP_05;
  const build = () =>
    buildThreadDecisions(
      facts({
        payments: [
          {
            paymentId: 'b',
            loggedAtMs: sameMs,
            amountPhp: 1,
            method: null,
            label: null,
            confirmedAtMs: null,
            ofTotalPhp: null,
          },
          {
            paymentId: 'a',
            loggedAtMs: sameMs,
            amountPhp: 2,
            method: null,
            label: null,
            confirmedAtMs: null,
            ofTotalPhp: null,
          },
        ],
      }),
    ).map((e) => e.key);

  assert.deepEqual(build(), ['payment:a', 'payment:b']);
  assert.deepEqual(build(), build());
});

/* ───────────────────────────────────────────────────────────────────────────
 * 4 · THE PILL RULE, EXHAUSTIVELY
 * ──────────────────────────────────────────────────────────────────────── */

/** The SHIPPED status vocabularies, from the migrations that define them. */
const QUOTE_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired'];
const MEETING_STATUSES = ['proposed', 'confirmed', 'done', 'cancelled'];
const AMENDMENT_STATUSES = ['proposed', 'accepted', 'declined', 'withdrawn'];

test('only a quote can ever wear a stage pill — every other kind, every status', () => {
  const viewers: DecisionViewer[] = ['couple', 'vendor'];

  for (const viewer of viewers) {
    for (const status of MEETING_STATUSES) {
      for (const initiatedBy of ['couple', 'vendor', null] as const) {
        const e = only(buildThreadDecisions(
          facts({
            viewer,
            meetings: [
              {
                appointmentId: 'a1',
                announcedAtMs: AUG_22,
                title: 'Tasting',
                scheduledAtMs: SUN_27,
                previousScheduledAtMs: SAT_26,
                status,
                initiatedBy,
              },
            ],
          }),
        ));
        assert.equal(e.now.stage, null, `meeting/${status}/${initiatedBy} grew a pill`);
        assert.equal(decisionStageWord(e), null);
      }
    }

    for (const status of AMENDMENT_STATUSES) {
      const e = only(buildThreadDecisions(
        facts({
          viewer,
          adjustments: [
            {
              amendmentId: 'm1',
              announcedAtMs: AUG_22,
              title: 'Add dessert table',
              deltaPhp: 12_000,
              status,
              decidedAtMs: SEP_01,
              raisedBy: 'couple',
            },
          ],
        }),
      ));
      assert.equal(e.now.stage, null, `adjustment/${status} grew a pill`);
    }

    for (const confirmed of [null, SEP_08]) {
      const e = only(buildThreadDecisions(
        facts({
          viewer,
          payments: [
            {
              paymentId: 'pay1',
              loggedAtMs: SEP_05,
              amountPhp: 50_000,
              method: 'GCash',
              label: null,
              confirmedAtMs: confirmed,
              ofTotalPhp: 187_500,
            },
          ],
        }),
      ));
      assert.equal(e.now.stage, null, `payment/${confirmed} grew a pill`);
    }

    {
      const e = only(buildThreadDecisions(
        facts({
          viewer,
          guestCounts: [
            {
              id: 'g1',
              changedAtMs: SEP_08,
              livePax: 170,
              quotedPax: 150,
              surchargePhp: 25_000,
            },
          ],
        }),
      ));
      assert.equal(e.now.stage, null, 'guest_count grew a pill');
    }

  }
});

test('a quote wears only ladder words, and only where it moved the stage', () => {
  const seen = new Map<string, string | null>();
  for (const status of QUOTE_STATUSES) {
    const e = only(buildThreadDecisions(
      facts({
        quotes: [
          {
            proposalId: 'p1',
            announcedAtMs: AUG_22,
            title: 'Garden Buffet',
            totalPhp: 187_500,
            status,
            decidedAtMs: SEP_01,
          },
        ],
      }),
    ));
    seen.set(status, decisionStageWord(e));
  }

  // Sending moves the thread to Quoted; accepting moves it to Booked. The three
  // that move it nowhere wear nothing — a declined quote is not a rung.
  assert.deepEqual(Object.fromEntries(seen), {
    draft: null,
    sent: 'Quoted',
    viewed: 'Quoted',
    accepted: 'Booked',
    declined: null,
    expired: null,
  });
});

test('the pill gate is a capability, not five call sites remembering', () => {
  // The claim: exactly one kind is permitted a pill, and it is the quote. If a
  // future kind is given `canWearStagePill: true` without anyone thinking about
  // whether it moves the ladder, this fails and asks the question.
  const permitted = (Object.keys(DECISION_VOICE) as DecisionKind[]).filter(
    (k) => DECISION_VOICE[k].canWearStagePill,
  );
  assert.deepEqual(permitted, ['quote']);
});

/* ───────────────────────────────────────────────────────────────────────────
 * 5 · THE RETIRED MARKER
 * ──────────────────────────────────────────────────────────────────────── */

test('there is no decision kind for the retired change-order marker', () => {
  // `chat_messages.change_order_id` still exists as a column, but nothing in
  // the product can create one (see the-change-marker-is-retired.test.ts). A
  // kind for it would make Decisions imply a card the couple can never receive.
  const kinds = Object.keys(DECISION_VOICE);
  assert.ok(!kinds.some((k) => /change/i.test(k)), `a change-order kind appeared: ${kinds}`);
  assert.equal(kinds.length, 5);
});

/* ───────────────────────────────────────────────────────────────────────────
 * 6 · NEEDS-YOU IS A COUNT, AND IT POINTS AT ONE PERSON
 * ──────────────────────────────────────────────────────────────────────── */

test('a payment the couple logged waits on the supplier, not on the couple', () => {
  const payment = {
    paymentId: 'pay1',
    loggedAtMs: SEP_05,
    amountPhp: 50_000,
    method: 'GCash',
    label: 'reservation fee',
    confirmedAtMs: null,
    ofTotalPhp: 187_500,
  };

  const couple = buildThreadDecisions(facts({ viewer: 'couple', payments: [payment] }));
  const vendor = buildThreadDecisions(facts({ viewer: 'vendor', payments: [payment] }));

  // The couple already did their part — this must not sit in their to-do count.
  assert.equal(decisionsNeedingYou(couple), 0);
  assert.equal(decisionsNeedingYou(vendor), 1);
});

test('a confirmed payment stops asking and starts reporting', () => {
  const e = only(buildThreadDecisions(
    facts({
      viewer: 'vendor',
      payments: [
        {
          paymentId: 'pay1',
          loggedAtMs: SEP_05,
          amountPhp: 50_000,
          method: 'GCash',
          label: null,
          confirmedAtMs: SEP_08,
          ofTotalPhp: 187_500,
        },
      ],
    }),
  ));
  assert.match(e.now.text, /^Confirmed received · 8 Sep/);
  assert.equal(e.now.needsYou, false);
  // The money still says what it is a part of — that is the standing fact.
  assert.match(e.now.text, /of/);
});

test('a guest-count change waits on the supplier and says what the quote still reads', () => {
  const g = {
    id: 'g1',
    changedAtMs: SEP_08,
    livePax: 170,
    quotedPax: 150,
    surchargePhp: 25_000,
  };
  const vendor = only(buildThreadDecisions(facts({ viewer: 'vendor', guestCounts: [g] })));
  assert.equal(vendor.now.needsYou, true);
  assert.match(vendor.now.text, /the quote still reads 150 guests/);

  const couple = only(buildThreadDecisions(facts({ viewer: 'couple', guestCounts: [g] })));
  assert.equal(couple.now.needsYou, false);
  assert.match(couple.now.text, /the quote still reads 150 guests/);
});

/* ───────────────────────────────────────────────────────────────────────────
 * 7 · DATES BELONG TO THE COUPLE, NOT THE SERVER
 * ──────────────────────────────────────────────────────────────────────── */

test('a date is rendered in Manila, whatever the machine thinks the day is', () => {
  // 2026-09-01T16:30Z is 2 Sep, 00:30 in Manila. A formatter without an
  // explicit zone prints "1 Sep" on a UTC CI box and "2 Sep" for the couple.
  const e = only(buildThreadDecisions(
    facts({
      quotes: [
        {
          proposalId: 'p1',
          announcedAtMs: AUG_22,
          title: 'Garden Buffet',
          totalPhp: 1,
          status: 'accepted',
          decidedAtMs: Date.parse('2026-09-01T16:30:00.000Z'),
        },
      ],
    }),
  ));
  assert.equal(e.now.text, 'Accepted · 2 Sep');
});

test('a missing date prints nothing rather than "Invalid Date"', () => {
  const e = only(buildThreadDecisions(
    facts({
      quotes: [
        {
          proposalId: 'p1',
          announcedAtMs: AUG_22,
          title: 'Garden Buffet',
          totalPhp: null,
          status: 'accepted',
          decidedAtMs: null,
        },
      ],
    }),
  ));
  assert.equal(e.now.text, 'Accepted');
  assert.doesNotMatch(e.now.text, /Invalid/);
});

test('an empty conversation produces no entries and nothing needing anyone', () => {
  const entries = buildThreadDecisions(facts());
  assert.deepEqual(entries, []);
  assert.equal(decisionsNeedingYou(entries), 0);
});
