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

import { TWO_ADMIN_PROMISES, unimplementedPromises } from './two-admin-promise';

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

  const phrases = sentence
    .split(/,\s*(?:and\s+)?/)
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
  // The refund one must keep naming the reason it cannot be specified here —
  // otherwise a later session reads "not built" and invents a threshold.
  const refund = TWO_ADMIN_PROMISES.find((p) => p.key === 'large-refund');
  assert.ok(refund, 'the refund promise row is gone');
  assert.match(
    refund.note,
    /Vendor Agreement/,
    'the refund row must keep saying the threshold lives in the Vendor Agreement, or the next ' +
      'session will pick a number',
  );
});
