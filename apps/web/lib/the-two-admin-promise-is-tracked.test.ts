/**
 * the-two-admin-promise-is-tracked.test.ts — the page promises a control; this
 * keeps the promise and the code from drifting further apart in silence.
 *
 * ── The finding ─────────────────────────────────────────────────────────────
 * `/help` publishes, live, under "What needs two-admin approval":
 *
 *   "Per Vendor Agreement § 9.1: major decisions need two admins. That means
 *    ad-revenue activation, vendor verification override, a large refund above
 *    the policy threshold, force-majeure bulk resolution, payment-method config
 *    change, and any blanket policy update."
 *
 * A contractual commitment to suppliers, citing a numbered clause. Measured
 * against production's `admin_approval_requests` CHECK — which allows
 * `grant_internal_account`, `grant_team_pool`, `promote_to_admin`,
 * `approve_vendor_partnership`, `approve_fraud_wipe_ban`,
 * `approve_journal_spotlight` and now `approve_comp_grant` — **none of the six
 * is implemented.**
 *
 * 🔑 The mechanism is real, works, and is enforced in the database. It is
 * pointed somewhere other than where the contract says it points.
 *
 * ── What this guard does, and deliberately does NOT do ──────────────────────
 * It does not implement anything. It asserts that every phrase the PAGE
 * promises has a row in `TWO_ADMIN_PROMISES`, so:
 *
 *   · adding a promise to the help copy without a row fails here;
 *   · implementing one and forgetting to record it fails here;
 *   · quietly deleting the promise to make this pass also fails here.
 *
 * ⛔ It does not invent the refund threshold. The page says the number is set
 * in the Vendor Agreement. Owner ruling 2026-08-31 on a different invented
 * default: *"don't guess."*
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { stripComments } from './strip-comments';
import {
  TWO_ADMIN_PROMISES,
  unimplementedPromises,
  enforcedPromises,
  refundNeedsTwoAdmins,
  REFUND_TWO_ADMIN_THRESHOLD_PHP,
  COMP_TWO_ADMIN_THRESHOLD_PHP,
} from './two-admin-promise';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

/** The published body of the "what needs two-admin approval" article. */
function publishedBody(): string {
  const src = readFileSync(join(WEB, 'lib/help.ts'), 'utf8');
  const at = src.indexOf("slug: 'what-needs-two-admins'");
  assert.ok(at > 0, 'the two-admin help article has moved or been renamed');
  const body = src.slice(at, src.indexOf('},', at));
  assert.ok(body.includes('Vendor Agreement'), 'the article no longer cites the Vendor Agreement');
  return body;
}

test('every promise the PAGE makes has a row here', () => {
  const body = publishedBody();
  const missing = TWO_ADMIN_PROMISES.filter((p) => !body.includes(p.asPublished));

  console.log(
    `[two-admin] ${TWO_ADMIN_PROMISES.length} promise(s) tracked, ` +
      `${unimplementedPromises().length} with no mechanism`,
  );
  assert.deepEqual(
    missing.map((m) => m.asPublished),
    [],
    'A tracked promise no longer appears in the help copy — either the wording changed (update ' +
      '`asPublished`) or the promise was withdrawn (remove the row, and say so in the changelog: ' +
      'withdrawing a contractual commitment is an owner decision, not a copy edit).',
  );
});

test('the page makes no promise that is untracked', () => {
  // The article lists its items comma-separated after "That means". Anything
  // there that no row claims would be a promise nobody is counting.
  const body = publishedBody();
  const tracked = TWO_ADMIN_PROMISES.map((p) => p.asPublished);

  // ⚠ THE WINDOW ENDS AT THE SENTENCE, not at the end of the article. The
  // promise list is one sentence — "That means A, B, … and F." — and the
  // sentences after it say the OPPOSITE: "Routine ops (review moderation, user
  // lookup, manual help reply) stay single-admin." The first version of this
  // read to the end and reported "user lookup" as an untracked PROMISE, which
  // is the exact inverse of what the page says about it.
  const from = body.indexOf('That means') + 'That means'.length;
  const to = body.indexOf('.', from);
  assert.ok(to > from, 'the promise sentence has no terminator — has the copy been restructured?');
  const sentence = body.slice(from, to);

  // ⚠ SPLIT ON A COMMA THAT IS NOT INSIDE A NUMBER. The clause's own figures
  // are "₱25,000" and "₱10,000"; a bare /,/ cuts them in half and then reports
  // "000 retail" as an untracked PROMISE. The thousands separator is the only
  // comma in this sentence that does not end a phrase.
  const phrases = sentence
    .split(/,(?!\d)\s*(?:and\s+)?/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);

  const untracked = phrases.filter((p) => !tracked.some((t) => p.includes(t) || t.includes(p)));
  assert.deepEqual(
    untracked,
    [],
    'The help page promises two-admin approval for something with no row in TWO_ADMIN_PROMISES. ' +
      'Every promise must be counted, implemented or not.\n  ' + untracked.join('\n  '),
  );
});

test('an implemented promise must name a REAL action type', () => {
  // Today every row is null. When one is implemented, its action_type must be
  // one the database will actually accept — a typo here would record the
  // promise as kept while the insert fails a CHECK.
  const live = new Set([
    'grant_internal_account',
    'grant_team_pool',
    'promote_to_admin',
    'approve_vendor_partnership',
    'approve_fraud_wipe_ban',
    'approve_journal_spotlight',
    'approve_comp_grant',
    'approve_large_refund',
  ]);
  for (const p of TWO_ADMIN_PROMISES) {
    if (p.actionType === null) continue;
    assert.ok(
      live.has(p.actionType),
      `${p.key} claims action_type "${p.actionType}", which the CHECK does not allow. Add it in ` +
        'the same migration, re-listing the vocabulary FROM PRODUCTION.',
    );
  }
});

test('every unimplemented promise says what implementing it would need', () => {
  for (const p of unimplementedPromises()) {
    assert.ok(
      p.note.trim().length >= 60,
      `${p.key} has no usable note. "Not built" is not a finding; what it would take is.`,
    );
  }
});

/**
 * ── This test replaced one whose premise expired ────────────────────────────
 * It used to assert that the refund row kept SAYING the threshold "lives in the
 * Vendor Agreement" — a guard against a later session inventing a number.
 *
 * 🔑 That guard was doing real work and was still wrong, because the number was
 * never missing: § 9.1 states "> ₱25,000" outright, and a comment in
 * `app/admin/payments/actions.ts` had repeated it since the pilot. The guard
 * protected an absence that was actually a failure to look, and each session
 * that read it was told, with authority, not to go looking.
 *
 * ⚠ A GUARD CAN PRESERVE THE THING IT WAS WRITTEN TO PREVENT. This one now
 * asserts the opposite and stronger property: the refund row is ENFORCED, and
 * names where.
 */
test('the refund promise is enforced, and says by what', () => {
  const refund = TWO_ADMIN_PROMISES.find((p) => p.key === 'large-refund');
  assert.ok(refund, 'the refund promise row is gone');
  assert.equal(
    refund.actionType,
    'approve_large_refund',
    'the § 9.1 refund gate lost its action type — a refund over the threshold would go through ' +
      'on one admin again',
  );
  assert.match(
    refund.note,
    /migration \d{14}/,
    'the refund row must name the migration that put approve_large_refund in the CHECK, so the ' +
      'next person can verify the gate exists rather than trust this row',
  );
});

/**
 * ── The threshold itself ────────────────────────────────────────────────────
 * § 9.1 names two figures and puts the boundary on the SINGLE-admin side of
 * both. These tests exist because the number was, for months, reported as
 * unknowable — "the exact refund threshold is set in the Vendor Agreement" —
 * while the clause stated it plainly and a comment in `app/admin/payments/
 * actions.ts` repeated it.
 */
test('§ 9.1 thresholds are the contract\'s numbers, and the boundary is single-admin', () => {
  assert.equal(REFUND_TWO_ADMIN_THRESHOLD_PHP, 25_000);
  assert.equal(COMP_TWO_ADMIN_THRESHOLD_PHP, 10_000);

  // "Process a refund ≤ ₱25,000" is named as single-admin authority for the
  // Disputes and Payments Handlers. Exactly at the line, one admin is enough.
  assert.equal(refundNeedsTwoAdmins(25_000), false, '₱25,000 exactly is single-admin per § 9.1');
  assert.equal(refundNeedsTwoAdmins(24_999.99), false);
  assert.equal(refundNeedsTwoAdmins(0.01), false);

  // "Refund any single transaction > ₱25,000" is a major decision.
  assert.equal(refundNeedsTwoAdmins(25_000.01), true);
  assert.equal(refundNeedsTwoAdmins(100_000), true);
});

test('the page states the same figures the constants hold', () => {
  const body = publishedBody();
  // Written as the page writes them, with the thousands separator.
  for (const n of [REFUND_TWO_ADMIN_THRESHOLD_PHP, COMP_TWO_ADMIN_THRESHOLD_PHP]) {
    assert.ok(
      body.includes(n.toLocaleString('en-US')),
      `the help copy no longer states ₱${n.toLocaleString('en-US')}. The page and the gate must ` +
        'quote one number — a page that names a different figure from the one the code enforces ' +
        'is the defect this whole module exists to close.',
    );
  }
});

/**
 * ⚠ THE GATE MUST READ THE SHARED RULE, NOT ITS OWN COPY OF THE NUMBER.
 * A literal `25000` in the action would pass every test above and then drift
 * the day the contract is renegotiated. One rule, imported by both sides.
 */
test('refundOrder gates on the shared rule and holds no threshold of its own', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/admin/payments/actions.ts'), 'utf8'));

  assert.ok(
    src.includes('refundNeedsTwoAdmins('),
    'refundOrder no longer calls refundNeedsTwoAdmins — the § 9.1 refund gate is gone. If the ' +
      'clause changed, change two-admin-promise.ts and say so in the changelog; do not remove ' +
      'the gate.',
  );
  assert.ok(
    src.includes('approve_large_refund'),
    'refundOrder no longer opens an approve_large_refund request',
  );

  // The number may appear ONLY via the imported constant.
  const literals = src.match(/\b25[_,]?000\b/g) ?? [];
  console.log(`[two-admin] ${literals.length} hard-coded 25,000 literal(s) in payments/actions.ts`);
  assert.deepEqual(
    literals,
    [],
    'The refund threshold is written as a literal in payments/actions.ts. Import ' +
      'REFUND_TWO_ADMIN_THRESHOLD_PHP instead — a second copy of a contractual number is a ' +
      'second thing to forget.',
  );
});

test('every enforced promise has an arm in the approvals dispatcher', () => {
  // Complements every-approval-type-can-be-approved.test.ts from the other
  // direction: that one starts from the types the code CREATES, this one from
  // the promises the CONTRACT makes.
  const dispatcher = stripComments(
    readFileSync(join(WEB, 'app/admin/approvals/actions.ts'), 'utf8'),
  );
  const missing = enforcedPromises()
    .filter((p) => !dispatcher.includes(`'${p.actionType}'`))
    .map((p) => `${p.key} (${p.actionType})`);

  console.log(`[two-admin] ${enforcedPromises().length} enforced, ${unimplementedPromises().length} not`);
  assert.deepEqual(
    missing,
    [],
    'A § 9.1 promise claims an action_type the dispatcher cannot execute. The request would open, ' +
      'sit in the queue, and throw when the second admin pressed Approve — money stuck at the ' +
      'last step.\n  ' + missing.join('\n  '),
  );
});
