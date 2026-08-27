/**
 * Guard — THE ANSWERS DESK.
 *
 * Two halves, because the failures are of two kinds.
 *
 * THE RULES (pure): the one-star review that could never reach the desk, the
 * lapsed ask that could never stop offering itself, the meeting that outlived
 * its own time, the reply owed in a conversation nobody was counting.
 *
 * THE WIRING (source scans, comments stripped): a rule with nobody asking it is
 * decoration. Every card kind must have a sort key AND a renderer — both
 * DERIVED FROM THE UNION IN THE SOURCE rather than hand-listed, because a
 * hand-written list is a list of the kinds somebody thought of. Every closed
 * window must carry no control. And every `--sn-*` token the desk paints with
 * must actually be defined, which is how the amber accent that never rendered
 * was found.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import {
  ANSWERS_THAT_DO_NOT_JOIN,
  CLOSED_WINDOW_GRACE_DAYS,
  lockAskPhase,
  meetingAskPhase,
  reviewNeedsReply,
  reviewTemper,
  threadOwesReply,
} from './answers-desk';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => stripComments(readFileSync(resolve(HERE, p), 'utf8'));
const raw = (p: string) => readFileSync(resolve(HERE, p), 'utf8');

const OVERVIEW = './vendor-overview.ts';
const SECTIONS = '../app/vendor-dashboard/_components/overview-sections.tsx';
const PAGE = '../app/vendor-dashboard/page.tsx';
const REVIEW_ACTIONS = '../app/vendor-dashboard/reviews/actions.ts';
const GLOBALS = '../app/globals.css';

const DAY = 86_400_000;
const NOW = Date.parse('2026-08-27T12:00:00Z');

// ── THE RULES ──────────────────────────────────────────────────────────────

test('a ONE-STAR review reaches the desk — it could not before', () => {
  // The shipped filter was `rating_overall !== 5 || vendor_reply`. The review
  // that most needs an answer was excluded by construction, and no count
  // anywhere said so.
  assert.equal(reviewNeedsReply({ rating_overall: 1, vendor_reply: null }), true);
  assert.equal(reviewNeedsReply({ rating_overall: 3, vendor_reply: null }), true);
  assert.equal(reviewNeedsReply({ rating_overall: 5, vendor_reply: null }), true);
  // Answered is answered, at any rating.
  assert.equal(reviewNeedsReply({ rating_overall: 1, vendor_reply: 'we are sorry' }), false);
  assert.equal(reviewNeedsReply({ rating_overall: 5, vendor_reply: 'thank you!' }), false);
  // A reply of nothing but spaces is not an answer.
  assert.equal(reviewNeedsReply({ rating_overall: 2, vendor_reply: '   ' }), true);
});

test('a review is spoken to by its rating, and an unreadable rating errs toward care', () => {
  assert.equal(reviewTemper(5), 'praise');
  assert.equal(reviewTemper(4), 'praise');
  assert.equal(reviewTemper(3), 'criticism');
  assert.equal(reviewTemper(1), 'criticism');
  // Never congratulate a shop for a review we could not read.
  assert.equal(reviewTemper(null), 'criticism');
  assert.equal(reviewTemper(Number.NaN), 'criticism');
});

test('the booking ask stops being answerable, then stops being shown', () => {
  const iso = (ms: number) => new Date(ms).toISOString();
  assert.equal(lockAskPhase(iso(NOW + DAY), NOW), 'answerable');
  assert.equal(lockAskPhase(iso(NOW - 1), NOW), 'lapsed');
  assert.equal(
    lockAskPhase(iso(NOW - (CLOSED_WINDOW_GRACE_DAYS - 1) * DAY), NOW),
    'lapsed',
    'a just-closed ask must still be on the desk — a row that vanishes reads as one you answered',
  );
  assert.equal(lockAskPhase(iso(NOW - (CLOSED_WINDOW_GRACE_DAYS + 1) * DAY), NOW), 'dropped');
  // FAILS TOWARD ANSWERABLE: refusing a live ask leaves a couple blocked by a
  // question the supplier is no longer shown.
  assert.equal(lockAskPhase(null, NOW), 'answerable');
  assert.equal(lockAskPhase('not a date', NOW), 'answerable');
});

test('a meeting is deadlined by the meeting, and leaves the waited-longest order when it passes', () => {
  const iso = (ms: number) => new Date(ms).toISOString();
  assert.equal(meetingAskPhase(iso(NOW + 3 * DAY), NOW), 'answerable');
  assert.equal(meetingAskPhase(iso(NOW - 1), NOW), 'passed');
  assert.equal(meetingAskPhase(iso(NOW - (CLOSED_WINDOW_GRACE_DAYS + 1) * DAY), NOW), 'dropped');
  // A proposal with no time is still a real ask nobody has answered.
  assert.equal(meetingAskPhase(null, NOW), 'answerable');
  assert.equal(meetingAskPhase('sometime soon', NOW), 'answerable');
});

test('a message the shop did not send is a message somebody is waiting on', () => {
  assert.equal(threadOwesReply('couple'), true);
  // A coordinator writes for the couple.
  assert.equal(threadOwesReply('coordinator'), true);
  assert.equal(threadOwesReply('vendor'), false);
  // An empty thread owes nothing.
  assert.equal(threadOwesReply(null), false);
  // A role added tomorrow is still somebody waiting — the rule asks the one
  // question that survives the enum growing.
  assert.equal(threadOwesReply('setnayan'), true);
});

// ── THE WIRING ─────────────────────────────────────────────────────────────

/**
 * Every `kind: '...'` member of the WhatsNewCard union, read out of the source.
 *
 * ⚠ IT IS TWO FILES. The pre-accept enquiry card is declared in
 * `vendor-overview-inquiry-card.ts` — a separate module so the anonymized DTO
 * stays unit-testable — and is imported into the union. Reading only the union
 * block finds ten of eleven kinds and reports a complete survey.
 */
function cardKinds(): string[] {
  const src = read(OVERVIEW);
  const start = src.indexOf('export type WhatsNewCard =');
  assert.ok(start > 0, 'the WhatsNewCard union moved — this guard is now scanning nothing');
  // ⚠ A CODE ANCHOR, NEVER A COMMENT ONE — this scan reads the stripped source,
  // so a docblock marker cannot be found and the guard silently scanned nothing.
  const end = src.indexOf('export type OngoingTask', start);
  assert.ok(end > start, 'could not find the end of the WhatsNewCard union');
  const block = src.slice(start, end);
  const inquiry = read('./vendor-overview-inquiry-card.ts');
  const kinds = [
    ...[...block.matchAll(/kind:\s*'([a-z_]+)'/g)],
    ...[...inquiry.matchAll(/kind:\s*'([a-z_]+)'/g)],
  ]
    .map((m) => m[1])
    .filter((k): k is string => Boolean(k));
  return [...new Set(kinds)];
}

test('the desk carries every kind of answer, and each one has a sort key', () => {
  const kinds = cardKinds();
  // FLOORED: 6 shipped + 5 added. A union that shrinks below this fails rather
  // than quietly guarding less.
  assert.ok(
    kinds.length >= 11,
    `expected at least 11 card kinds on the desk, read ${kinds.length}: ${kinds.join(', ')}`,
  );
  for (const k of ['message', 'meeting', 'quote_draft', 'contract_draft', 'lock_request_lapsed']) {
    assert.ok(kinds.includes(k), `${k} left the desk`);
  }
  const src = read(OVERVIEW);
  const sortStart = src.indexOf('function cardTimestamp');
  assert.ok(sortStart > 0, 'cardTimestamp moved');
  const sortBlock = src.slice(sortStart, sortStart + 3000);
  for (const k of kinds) {
    assert.ok(
      sortBlock.includes(`case '${k}':`),
      `card kind '${k}' has no sort key — it would sort as Invalid Date and land anywhere`,
    );
  }
});

test('every card kind is actually DISPATCHED, not merely mentioned', () => {
  /*
    🪤 REV 1 OF THIS TEST WAS DECORATION, AND THE MUTATION RUN CAUGHT IT. It
    asked whether the file contained `'meeting'` anywhere — which the card body's
    own `Extract<WhatsNewCard, { kind: 'meeting' }>` signature satisfies, so
    deleting the branch that MOUNTS it left the count at 1 → 0 and the guard
    green. A component nothing renders is not a renderer. It asks about the
    dispatch now.
  */
  const sections = read(SECTIONS);
  const start = sections.indexOf('function FeedCard');
  const end = sections.indexOf('function AgeLine');
  assert.ok(start > 0 && end > start, 'FeedCard moved — this guard is scanning nothing');
  const dispatch = sections.slice(start, end);
  // Exactly one kind may be the trailing else — anything else silently draws as
  // that kind. It is `dispute`, and the assertion below says so out loud.
  const undispatched = cardKinds().filter((k) => !dispatch.includes(`card.kind === '${k}'`));
  assert.deepEqual(
    undispatched,
    ['dispute'],
    `these kinds reach the feed with no branch that mounts them, so they draw as the fallback: ${undispatched.join(', ')}`,
  );
  assert.match(dispatch, /<DisputeBody card=\{card\} \/>/, 'the fallback branch is no longer the dispute card');
});

test('the five-star filter is gone, and the rule is asked rather than re-typed', () => {
  const src = read(OVERVIEW);
  assert.doesNotMatch(
    src,
    /rating_overall\s*!==\s*5/,
    'the five-star filter is back — a one-star review can no longer reach the desk',
  );
  assert.match(src, /reviewNeedsReply\(/, 'the review push no longer asks the shared rule');
  assert.match(
    read(SECTIONS),
    /reviewTemper\(/,
    'the card no longer derives its tone from the rating — a one-star review would wear a gold "praise" eyebrow',
  );
});

test('the answer is taken ON the row, not linked away from', () => {
  const sections = read(SECTIONS);
  const start = sections.indexOf('function ReviewBody');
  const end = sections.indexOf('function DisputeBody');
  assert.ok(start > 0 && end > start, 'ReviewBody moved');
  const body = sections.slice(start, end);
  assert.match(body, /action=\{postReviewReply\}/, 'the reply box left the review row');
  assert.match(body, /name="review_id"/, 'the reply form posts no review id');
  assert.match(body, /name="return_to"/, 'the reply would revalidate the wrong page');
  assert.match(
    read(REVIEW_ACTIONS),
    /revalidatePath\('\/vendor-dashboard'\)/,
    'an answered review would sit on the desk still asking to be answered',
  );
  assert.match(read(PAGE), /postReviewReply=\{postVendorReply\}/, 'the desk is not wired to the reply action');
});

test('the money row offers BOTH answers, and shows what they sent', () => {
  /*
    ⚖ OWNER RULING 2026-08-27: *"yes. they can declare it."*
    🔑 RULE 0 — the "no" was already built (`vendorRejectDeposit` → the
    `reject_vendor_deposit` RPC, with its own ownership gate and single-winner
    UPDATE). What was missing was a way to reach it from the desk, which asked a
    money question and offered one answer. This pins the reach, and pins that
    nobody invented a SECOND way to say no.
    🧾 And `proofUrl` had been fetched into this card since it was written and
    never rendered once — a supplier was asked to confirm a payment without
    being shown the proof of it.
  */
  const sections = read(SECTIONS);
  const start = sections.indexOf('function LockBody');
  const end = sections.indexOf('function ReviewBody');
  assert.ok(start > 0 && end > start, 'LockBody moved');
  const body = sections.slice(start, end);
  assert.match(body, /action=\{confirmLock\}/, 'the money row lost its yes');
  assert.match(body, /action=\{rejectLock\}/, 'the money row lost its no — the only answer is yes again');
  /*
    🪤 REV 1 OF THIS ASSERTION WAS DECORATION AND THE MUTATION RUN CAUGHT IT: it
    matched `card.proofUrl` ANYWHERE, and the field is named twice — in the
    branch and in the link. Replacing the branch with `{false ? (` left the
    `href` standing, count 2 → 1, and the guard stayed green while the receipt
    was gone. Both halves are pinned separately now.
  */
  // Both halves of the receipt: the branch that decides, and the link itself.
  // (`receiptUrl` is a local binding of `card.proofUrl` — narrowing the nullable
  // property inline did not survive the typecheck.)
  assert.match(body, /const receiptUrl = card\.proofUrl;/, 'the card no longer reads the receipt at all');
  assert.ok(
    body.includes('{receiptUrl ? ('),
    'the receipt branch is gone — the supplier answers a money question blind',
  );
  assert.ok(
    body.includes('href={receiptUrl}'),
    'nothing links to the receipt any more',
  );
  assert.match(body, /They attached no receipt\./, 'the no-receipt case says nothing at all');
  // The refusal stays behind a fold: a no must not be one mis-tap from a yes.
  assert.match(body, /<details/, 'the refusal came out from behind its fold');
  assert.match(read(PAGE), /rejectLock=\{vendorRejectDeposit\}/, 'the desk is not wired to the shipped reject action');
  // ONE mechanism for one answer. A second RPC would be two ways to say no,
  // which is how they come to disagree.
  for (const invented of ['decline_vendor_deposit', 'deposit_declined_at', 'deposit_not_received']) {
    assert.ok(
      !read(OVERVIEW).includes(invented) && !sections.includes(invented),
      `a second way to say no appeared (${invented}) — reject_vendor_deposit already does this`,
    );
  }
});

test('the desk says what happened when the answer was given on it', () => {
  // A refusal in silence is indistinguishable from one that never happened: the
  // row vanishes either way. Every status the RPC can return has words.
  const page = read(PAGE);
  assert.match(page, /deposit_answer/, 'the desk cannot show the outcome of an answer given on it');
  for (const status of ['ok', 'already', 'already_confirmed', 'not_recorded', 'error']) {
    assert.ok(
      new RegExp(`(^|[^a-z_])${status}:`, 'm').test(page),
      `the RPC can return '${status}' and the desk has no words for it`,
    );
  }
});

test('a closed window carries no control at all', () => {
  const sections = read(SECTIONS);
  for (const [fn, next] of [
    ['function LockRequestLapsedBody', 'function MessageBody'],
    ['function QuoteDraftBody', 'function ContractDraftBody'],
  ] as const) {
    const start = sections.indexOf(fn);
    const end = sections.indexOf(next);
    assert.ok(start > 0 && end > start, `${fn} moved`);
    const body = sections.slice(start, end);
    assert.doesNotMatch(
      body,
      /<form/,
      `${fn} grew a form — a lapsed ask cannot be agreed and a quote must never be sent from a feed card`,
    );
    assert.doesNotMatch(body, /SubmitButton/, `${fn} grew a submit control`);
  }
});

test('the four answers that do not work yet are not on the desk', () => {
  const src = read(OVERVIEW);
  assert.ok(ANSWERS_THAT_DO_NOT_JOIN.length >= 4, 'the withheld list shrank');
  for (const { slug, why } of ANSWERS_THAT_DO_NOT_JOIN) {
    assert.ok(why.length > 30, `${slug} has no reason recorded`);
    assert.ok(
      !src.includes(`kind: '${slug}'`),
      `'${slug}' joined the desk — ${why}`,
    );
  }
});

test('every colour the desk paints with is a token that exists', () => {
  /*
    🪤 THIS IS THE ONE THAT FOUND A LIVE DEFECT. `var(--sn-warn)` — the amber the
    booking-ask card's own comment describes at length — is not a token and never
    was, so the accent bar drew nothing and the eyebrow inherited the body ink.
    An undefined var() is rejected, not thrown; the only symptom is that it looks
    ordinary. Deriving the token list from the file catches the NEXT one.
  */
  const sections = raw(SECTIONS);
  const css = raw(GLOBALS);
  // BOTH families the desk paints with — `--sn-*` (the glass kit) and `--m-*`
  // (the editorial palette it still borrows the overdue tint from). Scanning one
  // family would be the one-spelling survey that let `--sn-warn` live.
  const named = [
    ...new Set(
      [...sections.matchAll(/var\((--(?:sn|m)-[a-z0-9-]+)/g)]
        .map((m) => m[1])
        .filter((tk): tk is string => Boolean(tk)),
    ),
  ];
  assert.ok(named.length >= 8, `expected the desk to name several tokens, found ${named.length}`);
  const missing = named.filter((t) => !css.includes(`${t}:`));
  assert.deepEqual(missing, [], `tokens named by the desk that no stylesheet defines: ${missing.join(', ')}`);
});

test('a text colour on this desk is never a fill-weight token', () => {
  // #B77E2E is 2.92:1 as text and #8A857B is 3.67:1 — both fine for a 4px bar,
  // both AA failures for words. The pairs are named in globals.css itself.
  const sections = read(SECTIONS);
  for (const fill of ['--sn-warning', '--sn-ink-400']) {
    assert.ok(
      !sections.includes(`eye: 'var(${fill})'`),
      `${fill} is a FILL weight and is being used as eyebrow text — use its -deep / -500 sibling`,
    );
  }
});
