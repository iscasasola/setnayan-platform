/**
 * THE BENCH SAYS WHERE EACH SUPPLIER STANDS — and says it in ONE place.
 *
 * ── WHAT THIS EXISTS TO CATCH ───────────────────────────────────────────────
 * The standing sentence is allowed to appear more than once. Owner, 2026-09-09:
 * *"yes, it is fine to show it twice."* It may sit on the bench card, shortened
 * in the sticky Picks column, and again inside the conversation's Decisions
 * view. **What makes that safe is that it is DERIVED ONCE and rendered several
 * times — never three derivations, and never two controls doing the same job
 * differently.**
 *
 * That safety is entirely a property of the code, and it is invisible when it
 * breaks: a second derivation renders a sentence that looks designed, agrees
 * with the first one on the day it ships, and drifts quietly afterwards. The v3
 * prototype broke the rule inside a SINGLE FILE — its bench card read *"they
 * haven't confirmed it yet · price not answered"* while the same couple's
 * Decisions line read *"nothing needs you"*. Two hand-typed sentences, already
 * disagreeing before either was code.
 *
 * So two source-level claims are pinned here:
 *   1. the sentence is derived in `lib/supplier-standing.ts` and nowhere else;
 *   2. no surface can put a stage word on a card outside the ladder's five.
 *
 * ── ⚠ AND BOTH WERE MUTATION-TESTED BEFORE BEING TRUSTED ────────────────────
 * A CALL-COUNT guard is walked straight past by
 *
 *     completed.has(id) ? 'completed' : resolveThreadStage(…)
 *
 * — one call to the resolver, still there, still counted, and the answer already
 * decided above it. `the-conversation-list-says-what-it-shows.test.ts` was
 * rewritten to catch exactly that sabotage on the builders, and its lesson is
 * carried here: what a private ranking cannot avoid doing is WRITING A RUNG'S
 * NAME. So the assertions below are about the rung words, not about call sites.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  STANDING_LABEL,
  buildSupplierStanding,
  standingRollUp,
  standingSentence,
  type SupplierStandingFacts,
} from '@/lib/supplier-standing';
import { THREAD_STAGE_LABEL, type ThreadStage } from '@/lib/vendor-thread-stage';

const WEB = join(import.meta.dirname, '..');
const MODULE = 'lib/supplier-standing.ts';
const READER = 'lib/conversation-list.ts';
const BENCH = 'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx';
const PAGE = 'app/dashboard/[eventId]/vendors/page.tsx';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const ALL_STAGES: ThreadStage[] = ['inquiry', 'quoted', 'booked', 'completed', 'cancelled'];
const DAY = 86_400_000;
const NOW = Date.parse('2026-09-09T12:00:00Z');

/** A supplier the couple has written to, with everything else at its floor. */
function facts(over: Partial<SupplierStandingFacts> = {}): SupplierStandingFacts {
  return {
    stage: 'inquiry',
    hasThread: true,
    quotedAmountPhp: null,
    lastSpeaker: 'couple',
    lastSaidAtMs: NOW - 3 * DAY,
    nowMs: NOW,
    ...over,
  };
}
const say = (over: Partial<SupplierStandingFacts> = {}) => {
  const s = buildSupplierStanding(facts(over));
  return s === null ? null : standingSentence(s);
};

test('the scan read real files (an empty read is a green lie)', () => {
  for (const rel of [MODULE, READER, BENCH, PAGE]) {
    assert.ok(read(rel).length > 500, `${rel} came back empty — the scan is not reading it`);
  }
});

// ── 1 · the sentence itself ────────────────────────────────────────────────

test('🔑 1 · the three sentences the owner asked for', () => {
  // Garden Buffet — a quote is out and the answer is the couple's to give.
  assert.equal(
    say({ stage: 'quoted', quotedAmountPhp: 187_500, lastSpeaker: 'vendor', lastSaidAtMs: NOW - DAY }),
    'Quoted ₱187,500 · waiting on you',
  );
  // Lumen Kitchen — they answered, and nothing is pending on the couple.
  assert.equal(say({ lastSpeaker: 'vendor', lastSaidAtMs: NOW - DAY }), 'Replied yesterday');
  // Verde Catering — the couple wrote and nobody has come back.
  assert.equal(say({ lastSpeaker: 'couple', lastSaidAtMs: NOW - 12 * DAY }), 'No reply · 12 days');
});

test('🔑 2 · a supplier with NO conversation gets no sentence at all', () => {
  // ⚠ THE ONE THAT MATTERS MOST. Most of the bench is suppliers the couple
  // shortlisted and never wrote to. "No reply · 12 days" under a stranger is a
  // fabricated grievance, and it would be on nearly every card on the page.
  assert.equal(buildSupplierStanding(facts({ hasThread: false })), null);
  for (const stage of ALL_STAGES) {
    assert.equal(buildSupplierStanding(facts({ stage, hasThread: false })), null, stage);
  }
});

test('🔑 3 · the ladder’s floor says nothing the reply clause has not', () => {
  // "Inquiry · Replied yesterday" spends a line of a 206px card saying the same
  // thing twice. Every OTHER rung names itself.
  assert.equal(say({ lastSpeaker: 'vendor', lastSaidAtMs: NOW }), 'Replied today');
  assert.equal(
    say({ stage: 'booked', lastSpeaker: 'vendor', lastSaidAtMs: NOW - 2 * DAY }),
    'Booked · Replied 2 days ago',
  );
  assert.ok(!say({ lastSpeaker: 'vendor', lastSaidAtMs: NOW })?.includes('Inquiry'));
});

test('🔑 4 · a closed conversation is not nagged about a reply', () => {
  // "Completed · No reply · 40 days" is a complaint about a job that is done,
  // and "Cancelled · No reply · 40 days" about one nobody is waiting on.
  for (const stage of ['completed', 'cancelled'] as const) {
    const sentence = say({ stage, lastSpeaker: 'couple', lastSaidAtMs: NOW - 40 * DAY });
    assert.equal(sentence, THREAD_STAGE_LABEL[stage], stage);
  }
});

test('🔑 5 · the amount only rides where it is news, and never at zero', () => {
  // A quote the couple has to answer: the number IS the sentence.
  assert.ok(say({ stage: 'quoted', quotedAmountPhp: 95_000, lastSpeaker: 'vendor' })?.includes('₱95,000'));
  // ⚠ Booked already prints the price two lines up on the same card.
  assert.ok(!say({ stage: 'booked', quotedAmountPhp: 187_500, lastSpeaker: 'vendor' })?.includes('₱'));
  // A quote with no total: the rung still shows, the number does not. "Quoted ₱0"
  // is a worse sentence than "Quoted".
  assert.equal(
    say({ stage: 'quoted', quotedAmountPhp: null, lastSpeaker: 'vendor' }),
    'Quoted · waiting on you',
  );
});

test('🔑 6 · "waiting on you" is said only when it is true', () => {
  // The supplier quoted and then the COUPLE wrote back — the wait is the
  // supplier's again, and the page must not tell the couple to act.
  const answered = say({ stage: 'quoted', quotedAmountPhp: 95_000, lastSpeaker: 'couple', lastSaidAtMs: NOW - 5 * DAY });
  assert.equal(answered, 'Quoted ₱95,000 · No reply · 5 days');
  assert.ok(!answered?.includes('waiting on you'));
  // And `needsYou` tracks the sentence, so the two cannot disagree.
  const owed = buildSupplierStanding(facts({ stage: 'quoted', lastSpeaker: 'vendor' }));
  assert.equal(owed?.needsYou, true);
  assert.equal(buildSupplierStanding(facts({ stage: 'quoted', lastSpeaker: 'couple' }))?.needsYou, false);
});

test('🔑 7 · the day words, including the ones off by one', () => {
  assert.equal(say({ lastSpeaker: 'vendor', lastSaidAtMs: NOW }), 'Replied today');
  assert.equal(say({ lastSpeaker: 'vendor', lastSaidAtMs: NOW - DAY }), 'Replied yesterday');
  assert.equal(say({ lastSpeaker: 'vendor', lastSaidAtMs: NOW - 2 * DAY }), 'Replied 2 days ago');
  // "No reply · 1 days" is the classic. And a same-day send is not a grievance.
  assert.equal(say({ lastSaidAtMs: NOW }), 'Sent today');
  assert.equal(say({ lastSaidAtMs: NOW - DAY }), 'No reply · 1 day');
  assert.equal(say({ lastSaidAtMs: NOW - 2 * DAY }), 'No reply · 2 days');
  // A clock skew must never produce "No reply · -1 days".
  assert.equal(say({ lastSaidAtMs: NOW + 5 * DAY }), 'Sent today');
});

test('🔑 8 · an open thread nobody has written in yet says nothing', () => {
  // A `null` last message with a floor rung leaves no true clause — and the
  // label "Where you stand" over an empty line reads as a sentence that failed
  // to load, the same disease as a refused read drawing an empty state.
  assert.equal(buildSupplierStanding(facts({ lastSpeaker: null, lastSaidAtMs: null })), null);
  // But a rung that HAS a word still speaks.
  assert.equal(say({ stage: 'booked', lastSpeaker: null, lastSaidAtMs: null }), 'Booked');
});

test('🔑 9 · every rung produces a sentence a person could read', () => {
  for (const stage of ALL_STAGES) {
    for (const speaker of ['couple', 'vendor', null] as const) {
      const s = buildSupplierStanding(facts({ stage, lastSpeaker: speaker }));
      if (s === null) continue;
      const line = standingSentence(s);
      assert.ok(line.length > 0, `${stage}/${speaker} produced an empty sentence`);
      assert.ok(!line.includes('undefined'), `${stage}/${speaker}: ${line}`);
      assert.ok(!line.includes('NaN'), `${stage}/${speaker}: ${line}`);
      assert.ok(!/^ ?·|· ?$/.test(line), `${stage}/${speaker} has a dangling separator: ${line}`);
    }
  }
});

// ── 2 · the roll-up is the same derivation, counted ─────────────────────────

test('🔑 10 · the roll-up can only count replies a card is showing', () => {
  const replied = buildSupplierStanding(facts({ lastSpeaker: 'vendor' }))!;
  const silent = buildSupplierStanding(facts({ lastSpeaker: 'couple', lastSaidAtMs: NOW - 12 * DAY }))!;
  assert.equal(replied.replied, true);
  assert.equal(silent.replied, false);

  const roll = standingRollUp([
    { name: 'Kusina ni Aling Nena', standing: replied },
    { name: 'Verde Catering', standing: silent },
    { name: 'Lumen Studios', standing: replied },
    { name: 'A stranger', standing: null },
  ]);
  assert.equal(roll?.headline, '2 suppliers replied');
  assert.deepEqual(roll?.names, ['Kusina ni Aling Nena', 'Lumen Studios']);
  // One is singular. A banner that says "1 suppliers replied" is a banner
  // nobody trusts about anything else either.
  assert.equal(standingRollUp([{ name: 'Solo', standing: replied }])?.headline, '1 supplier replied');
  // Nobody has replied ⇒ no banner. An always-present banner is one couples
  // learn to skip, including on the day it finally matters.
  assert.equal(standingRollUp([{ name: 'Verde', standing: silent }]), null);
  assert.equal(standingRollUp([]), null);
});

// ── 3 · ONE derivation, and only the ladder's five words ───────────────────

/**
 * ⚠ THE MUTATION THIS REPLACES A CALL-COUNT WITH.
 * `const stage = completed.has(id) ? 'completed' : resolveThreadStage({…})`
 * leaves the resolver call intact and still counted, while deciding the answer
 * on the line above it. A rung's NAME is what such a ranking cannot avoid
 * writing — so that is what is asserted.
 */
function assertNamesNoRung(window: string, which: string) {
  for (const stage of ALL_STAGES) {
    assert.ok(
      !window.includes(`'${stage}'`) && !window.includes(`"${stage}"`),
      `${which} wrote the rung "${stage}" itself — that is a second ranking, whatever the resolver call below it says`,
    );
  }
}

test('🔑 11 · the bench reader ranks through the shared resolver and names no rung', () => {
  const whole = read(READER);
  const start = whole.indexOf('export async function buildBenchStandings');
  assert.ok(start > 0, 'the bench reader is gone — the bench has no facts to say anything from');
  const reader = whole.slice(start);
  assert.equal(
    (reader.match(/resolveThreadStage\(/g) ?? []).length,
    1,
    'the bench stopped ranking through the shared resolver',
  );
  assertNamesNoRung(reader, 'the bench reader');
  // ⚡ Batched. A rail holds dozens of cards and the page holds many rails, so a
  // per-card probe is not a slow page, it is a page that stops responding.
  assert.ok(/\.in\('thread_id', threadIds\)/.test(reader), 'the last-message read stopped batching');
  assert.ok(
    !/readCoupleStageFacts\([\s\S]{0,200}for \(/.test(reader),
    'the stage facts are being read inside a loop',
  );
  // 🔒 The couple's own session on this side, as everywhere else here.
  for (const forbidden of ['adminClient', 'createAdminClient', 'service_role']) {
    assert.ok(!reader.includes(forbidden), `the bench reader reached for ${forbidden}`);
  }
});

test('🔑 12 · the shared stage-facts reader is still one batched pass', () => {
  // The three probes moved OUT of `buildCoupleConversationRows` when the bench
  // became their second consumer. The claim that matters did not change: one
  // query per fact for the whole surface, on the couple's own session.
  const whole = read(READER);
  const start = whole.indexOf('async function readCoupleStageFacts');
  assert.ok(start > 0, 'the shared stage-facts reader is gone');
  const helper = whole.slice(start, whole.indexOf('type CoupleThreadInput', start));
  assert.equal(
    (helper.match(/\.eq\('event_id', eventId\)/g) ?? []).length,
    3,
    'a stage probe stopped batching on the event — that is three queries per row',
  );
  assert.equal((helper.match(/rowReadsCompleted\(/g) ?? []).length, 1);
  assert.ok(
    !/completion_status\s*===\s*'(confirmed|auto_confirmed)'/.test(helper),
    'the completion predicate is inlined again',
  );
  for (const forbidden of ['adminClient', 'createAdminClient', 'service_role']) {
    assert.ok(!helper.includes(forbidden), `the shared reader reached for ${forbidden}`);
  }
  // And both consumers go through it rather than growing their own copy.
  for (const consumer of ['buildCoupleConversationRows', 'buildBenchStandings']) {
    const from = whole.indexOf(`function ${consumer}`);
    const window = whole.slice(from, from + 2600);
    assert.ok(
      window.includes('readCoupleStageFacts('),
      `${consumer} stopped using the shared stage-facts reader`,
    );
  }
});

test('🔑 13 · the sentence is derived in ONE module and nowhere else', () => {
  // The owner allowed the sentence to be SHOWN in several places. This is the
  // line between that and three sentences that agree today and drift tomorrow.
  const callers: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        if (/buildSupplierStanding\s*\(/.test(read(rel))) callers.push(rel);
      }
    }
  };
  for (const root of ['lib', 'app']) walk(root);
  assert.deepEqual(
    callers.sort(),
    ['lib/conversation-list.ts', 'lib/supplier-standing.ts'],
    'the sentence is being derived somewhere new. Render the one that already exists; do not compute a second.',
  );
  // And no surface hand-types the sentence's own words instead of rendering it.
  for (const rel of [BENCH, PAGE]) {
    const src = read(rel);
    for (const phrase of ['waiting on you', 'No reply ·', 'Replied yesterday', 'suppliers replied']) {
      assert.ok(
        !src.includes(phrase),
        `${rel} hand-types "${phrase}" — that is a second sentence, not the one derived`,
      );
    }
  }
});

test('🔑 14 · a card cannot render a stage word outside the ladder’s five', () => {
  const moduleSrc = read(MODULE);
  const bench = read(BENCH);

  // The module hands out a rung, never a word: the ONLY place a stage becomes
  // English is `THREAD_STAGE_LABEL`, in the module's own formatter and in the
  // component. So a sixth word cannot reach a card without editing the ladder.
  assert.ok(moduleSrc.includes('THREAD_STAGE_LABEL['), 'the sentence stopped naming the rung from the ladder');
  assert.ok(bench.includes('THREAD_STAGE_LABEL['), 'the card stopped naming the rung from the ladder');

  // ⚠ AND THE HUMAN WORDS THEMSELVES ARE ABSENT FROM BOTH. A hand-typed
  // "Quoted" beside a `THREAD_STAGE_LABEL` lookup is exactly the drift this
  // pins — it renders correctly on the day it ships and survives a rename of
  // the ladder that it should not have survived.
  for (const [rel, src] of [[MODULE, moduleSrc], [BENCH, bench]] as const) {
    for (const label of Object.values(THREAD_STAGE_LABEL)) {
      assert.ok(
        !new RegExp(`['"\`]${label}['"\`]`).test(src),
        `${rel} hand-types the stage word "${label}" instead of reading THREAD_STAGE_LABEL`,
      );
    }
  }

  // Whatever a rung is called, the sentence prints THAT — proven by running
  // every rung through the real formatter rather than by reading the source.
  for (const stage of ALL_STAGES) {
    const s = buildSupplierStanding(facts({ stage, lastSpeaker: null, lastSaidAtMs: null }));
    if (s === null) continue;
    const words = standingSentence(s).split(' · ');
    const known = new Set<string>(Object.values(THREAD_STAGE_LABEL));
    for (const w of words) {
      const head = w.split(' ')[0]!;
      if (known.has(head)) continue;
      assert.ok(
        !/^[A-Z]/.test(head) || head === 'Replied' || head === 'Sent' || head === 'No',
        `the sentence produced an unrecognised stage-shaped word: "${w}"`,
      );
    }
  }
});

test('🔑 15 · the module stays pure — no React, no fetching, no clock', () => {
  const moduleSrc = read(MODULE);
  for (const forbidden of ['react', 'useState', 'createClient', ".from('", 'Date.now(']) {
    assert.ok(
      !moduleSrc.includes(forbidden),
      `the sentence module reached for ${forbidden} — it takes facts and returns a string`,
    );
  }
  // ⚠ `nowMs` is INJECTED, and the page reads the clock once for the whole
  // bench. A per-card `Date.now()` lets two cards painted together disagree
  // across a midnight boundary — "yesterday" beside "2 days ago" for the same
  // hour.
  assert.ok(read(PAGE).includes('nowMs: Date.now()'), 'the page stopped reading one clock for the bench');
});

test('🔑 16 · the card shows the sentence, labelled, to a screen reader too', () => {
  const bench = read(BENCH);
  assert.ok(bench.includes('<CardStanding standing='), 'the card stopped rendering the standing');
  assert.ok(bench.includes('<BenchRollUp folders='), 'the page-top roll-up is gone');
  // The segments are told apart by colour and weight; a screen reader gets none
  // of that, so it gets the whole sentence.
  assert.ok(
    /aria-label=\{`\$\{STANDING_LABEL\}: \$\{standingSentence\(standing\)\}`\}/.test(bench),
    'the standing lost its aria-label — the sentence is then colour-only',
  );
  assert.ok(STANDING_LABEL.length > 0);
  // ⛔ NOT ON THE ROW-2 MARKETPLACE CARD. Those are strangers the couple has
  // never spoken to; a standing line there could only ever say nothing, and a
  // label over nothing reads as a sentence that failed to load.
  const more = bench.slice(bench.indexOf('function InlineMoreCard'), bench.indexOf('export function ShortlistCategories'));
  assert.ok(more.length > 200, 'the row-2 card moved — this window faces nothing');
  assert.ok(!more.includes('CardStanding'), 'the standing leaked onto the row-2 marketplace card');
});

test('🔑 17 · the card can put NO word of its own into the sentence', () => {
  // ⚠ TEST 14 CATCHES THE FIVE LADDER WORDS BEING HAND-TYPED. It cannot catch a
  // SIXTH word being invented — `<b>Awaiting reply</b>` is not on any list, and
  // a stage-shaped word nobody derived is exactly the thing the ladder exists
  // to prevent. Mutation-tested: adding that literal passed test 14 and failed
  // only here.
  //
  // So the claim is structural and total: every string inside `CardStanding`
  // is either a class name, the separator, or the label's own glue. Copy comes
  // from `standing.segments` (already derived) or `THREAD_STAGE_LABEL` (the
  // ladder). There is no third source, and there is nowhere to add one.
  const bench = read(BENCH);
  const start = bench.indexOf('function CardStanding(');
  const end = bench.indexOf('function BenchRollUp(');
  assert.ok(start > 0 && end > start, 'CardStanding moved — this window faces nothing');
  const body = bench.slice(start, end);

  const ALLOWED = new Set(['stand', 'lab', 'line', 'sep', 'need', 'said', 'stage', ' · ', '']);
  const literals = [...body.matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2] ?? '');
  const invented = literals.filter((l) => !ALLOWED.has(l));
  assert.deepEqual(
    invented,
    [],
    'the card grew copy of its own inside the standing line. The sentence is derived in lib/supplier-standing.ts — put it there, where one derivation feeds every surface that shows it.',
  );
});
