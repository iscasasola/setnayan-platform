/**
 * verified-badge.test.ts — the owner's 2026-09-11 rulings, Q4 and Q5.
 *
 *   Q4: the shops verified before the papers check keep the badge six months,
 *       then it comes off if the papers have not come in.
 *   Q5: a Mayor's Permit that runs out — a reminder 60 days ahead, then the
 *       badge comes off; the shop STAYS findable and bookable.
 *
 * The badge is the only thing a deadline may touch. These tests pin that the
 * badge obeys its date, that the words said to a supplier never threaten the
 * listing, and that the daily pass cannot repeat itself or speak out of order.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { BYPASS_WINDOW_DAYS } from './verification-bypass';
import {
  BADGE_REMINDER_DAYS,
  EARLY_SHOPS_PAPERS_DUE_ISO,
  badgeDeadline,
  badgeLapsedCopy,
  badgeReminderCopy,
  deadlineAtApproval,
  deadlineLabel,
  defaultPermitValidUntil,
  hasVerifiedBadge,
  permitDeadlineFrom,
  planBadgeDeadlineSweep,
  sweepKey,
} from './verified-badge';

const NOW = new Date('2026-09-11T04:00:00.000Z'); // midday Manila, the day of the ruling
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

/* ── THE BADGE ─────────────────────────────────────────────────────────────── */

test('a verified shop with no deadline wears the badge, exactly as before', () => {
  assert.equal(hasVerifiedBadge({ verification_state: 'verified' }, NOW), true);
  assert.equal(hasVerifiedBadge({ verification_state: 'verified', next_renewal_due_at: null }, NOW), true);
});

test('🔑 the badge obeys its deadline: on before it, off after it', () => {
  assert.equal(hasVerifiedBadge({ verification_state: 'verified', next_renewal_due_at: inDays(1) }, NOW), true);
  assert.equal(hasVerifiedBadge({ verification_state: 'verified', next_renewal_due_at: inDays(-1) }, NOW), false);
  // The instant itself is past — a permit valid "until" a moment is not valid at it.
  assert.equal(
    hasVerifiedBadge({ verification_state: 'verified', next_renewal_due_at: NOW.toISOString() }, NOW),
    false,
  );
});

test('no deadline ever GIVES a badge — an unverified shop has none, whatever the date says', () => {
  for (const state of ['unverified', 'pending_review', 'demoted', 'rejected', null, undefined]) {
    assert.equal(
      hasVerifiedBadge({ verification_state: state, next_renewal_due_at: inDays(300) }, NOW),
      false,
      `state ${String(state)} wore the badge`,
    );
  }
});

test('an unreadable deadline never takes a badge off', () => {
  assert.equal(
    hasVerifiedBadge({ verification_state: 'verified', next_renewal_due_at: 'not-a-date' }, NOW),
    true,
  );
});

test('the deadline states: ahead → reminder at 60 days → lapsed', () => {
  const v = (d: string) => badgeDeadline({ verification_state: 'verified', next_renewal_due_at: d }, NOW);
  assert.equal(BADGE_REMINDER_DAYS, 60, 'the owner said 60 days');
  assert.equal(v(inDays(61)).kind, 'ahead');
  assert.deepEqual(v(inDays(60)), { kind: 'reminder', daysLeft: 60 });
  assert.deepEqual(v(inDays(1)), { kind: 'reminder', daysLeft: 1 });
  assert.equal(v(inDays(-2)).kind, 'lapsed');
  assert.equal(badgeDeadline({ verification_state: 'demoted', next_renewal_due_at: inDays(-2) }, NOW).kind, 'none');
});

/* ── Q4 — THE EARLY SHOPS ──────────────────────────────────────────────────── */

test('Q4 · the early shops renew on the one renewal day — 30 March 2027 (owner 12 Nov 2026; was 12 March)', () => {
  assert.equal(EARLY_SHOPS_PAPERS_DUE_ISO, '2027-03-30T15:59:59.000Z', 'the end of 30 March in Manila');
  assert.equal(deadlineLabel(EARLY_SHOPS_PAPERS_DUE_ISO), 'March 30, 2027');
  // The 2026-09-11 backfill gave them exactly the vouch window (12 March 2027) — the move below starts from that day.
  const rulingDayEnd = new Date('2026-09-11T23:59:59+08:00');
  assert.equal((Date.parse('2027-03-12T15:59:59.000Z') - rulingDayEnd.getTime()) / 86_400_000, BYPASS_WINDOW_DAYS);
});

const HERE = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = resolve(HERE, '../../../supabase/migrations');
const MIG_FILE = readdirSync(MIG_DIR).find((n) => n.endsWith('_verified_badge_deadlines.sql'));
const MIG_SQL = MIG_FILE ? readFileSync(resolve(MIG_DIR, MIG_FILE), 'utf8').replace(/--[^\n]*/g, '') : '';

test('Q4 · the backfill wrote 12 March 2027 everywhere — the day the 30 March move looks for, to the second', () => {
  assert.ok(MIG_FILE, 'the badge-deadline migration is missing');
  const stamps = MIG_SQL.match(/TIMESTAMPTZ '([^']+)'/g) ?? [];
  assert.ok(stamps.length >= 2, `expected the deadline on the vouch row AND the profile, found ${stamps.length}`);
  for (const st of stamps) {
    const raw = /TIMESTAMPTZ '([^']+)'/.exec(st)![1]!;
    assert.equal(
      new Date(raw.replace(' ', 'T').replace(/\+08$/, '+08:00')).toISOString(),
      '2027-03-12T15:59:59.000Z',
      `the backfill writes ${raw} — the 30 March move (…_early_shops_renew_on_march_30) would miss it`,
    );
  }
});

test('Q4 · the early shops are chosen by a CONDITION, never by an id', () => {
  const block = MIG_SQL.slice(MIG_SQL.indexOf('WITH early AS'), MIG_SQL.indexOf('DO $$'));
  assert.ok(block.length > 0, 'the backfill is gone');
  assert.ok(
    !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|S89B-/i.test(block),
    'the backfill names a shop by id',
  );
  assert.match(block, /a\.status = 'approved'/, 'the "no approved papers" condition is gone');
  assert.match(block, /vendor_verification_bypasses b/, 'the "not already vouched" condition is gone');
});

test('⛔ Q5 · the migration never hides, unpublishes or un-verifies a shop', () => {
  assert.ok(
    !/SET[^;]*(public_visibility|verification_state)\s*=/i.test(MIG_SQL),
    'the badge-deadline migration writes a listing or verification column',
  );
});

/* ── Q5 — THE PERMIT DATE ──────────────────────────────────────────────────── */

test('Q5 · the permit date is the END of that day in Manila', () => {
  const r = permitDeadlineFrom('2026-12-31', NOW);
  assert.deepEqual(r, { ok: true, deadlineIso: '2026-12-31T15:59:59.000Z' });
  assert.equal(deadlineLabel('2026-12-31T15:59:59.000Z'), 'December 31, 2026');
});

test('Q5 · a permit already run out, a far-future date, or garbage is refused', () => {
  assert.equal(permitDeadlineFrom('2026-09-10', NOW).ok, false, 'an expired permit was accepted');
  assert.equal(permitDeadlineFrom('2029-12-31', NOW).ok, false, 'a three-year "permit" was accepted');
  assert.equal(permitDeadlineFrom('31/12/2026', NOW).ok, false);
  assert.equal(permitDeadlineFrom('2026-02-30', NOW).ok, false, 'a non-existent day was accepted');
});

test('Q5 · the reviewer is prefilled with 31 December — a Mayor’s Permit runs for the calendar year', () => {
  assert.equal(defaultPermitValidUntil(NOW), '2026-12-31');
  // Manila's year, not the server's: 31 Dec 17:00 UTC is already 1 Jan in Manila.
  assert.equal(defaultPermitValidUntil(new Date('2026-12-31T17:00:00Z')), '2027-12-31');
});

test('approval writes the one renewal day — 30 March of the next year (owner 12 Nov 2026)', () => {
  assert.equal(deadlineAtApproval(new Date('2026-09-11T04:00:00.000Z')), '2027-03-30T15:59:59.000Z');
  assert.equal(deadlineAtApproval(new Date('2027-02-10T04:00:00.000Z')), '2028-03-30T15:59:59.000Z', 'a February approval renews the year after');
  // Manila's year: 31 Dec 17:00 UTC is already 1 Jan in Manila.
  assert.equal(deadlineAtApproval(new Date('2026-12-31T17:00:00Z')), '2028-03-30T15:59:59.000Z');
  assert.equal(deadlineLabel(deadlineAtApproval(new Date('2026-11-13T05:00:00Z'))), 'March 30, 2027');
});

/* ── THE DAILY PASS ────────────────────────────────────────────────────────── */

const shop = (id: string, deadline: string | null, state = 'verified') => ({
  vendorProfileId: id,
  verificationState: state,
  deadline,
});

test('the pass reminds inside 60 days, notes a lapse, and ignores everything else', () => {
  const plan = planBadgeDeadlineSweep(
    [
      shop('far', inDays(90)),
      shop('near', inDays(30)),
      shop('gone', inDays(-1)),
      shop('none', null),
      shop('demoted', inDays(-1), 'demoted'),
    ],
    new Set(),
    NOW,
  );
  assert.deepEqual(
    plan.map((a) => `${a.kind}:${a.vendorProfileId}`),
    ['remind:near', 'lapse:gone'],
  );
});

test('🔑 the pass never says the same thing twice about the same deadline', () => {
  const near = inDays(30);
  const gone = inDays(-1);
  const done = new Set([sweepKey('remind', 'near', near), sweepKey('lapse', 'gone', gone)]);
  assert.deepEqual(planBadgeDeadlineSweep([shop('near', near), shop('gone', gone)], done, NOW), []);
});

test('🔑 a renewed deadline earns a fresh reminder — the key is the DEADLINE, not the shop', () => {
  const done = new Set([sweepKey('remind', 'near', inDays(-300))]);
  const plan = planBadgeDeadlineSweep([shop('near', inDays(30))], done, NOW);
  assert.equal(plan.length, 1);
  assert.equal(plan[0]!.kind, 'remind');
});

test('⚠ a lapse is never preceded, in the same pass, by a "days left" reminder', () => {
  // Passes ride traffic; a shop can cross the window AND the deadline between
  // two of them. "60 days left" after the badge is off is worse than silence.
  const plan = planBadgeDeadlineSweep([shop('gone', inDays(-1))], new Set(), NOW);
  assert.deepEqual(plan.map((a) => a.kind), ['lapse']);
});

/* ── THE WORDS ─────────────────────────────────────────────────────────────── */

test('⚖ every sentence says the shop stays listed and bookable, and none threatens the listing', () => {
  const lines: string[] = [];
  for (const reason of ['papers', 'permit', 'renewal'] as const) {
    const r = badgeReminderCopy({ reason, deadlineIso: inDays(60), daysLeft: 60 });
    const l = badgeLapsedCopy({ reason, deadlineIso: inDays(-1) });
    lines.push(`${r.title} ${r.body}`, `${l.title} ${l.body}`);
    assert.match(r.body, /stays listed and couples can still book you/, `${reason} reminder`);
    assert.match(l.body, /still listed and couples can still book you/, `${reason} lapse`);
  }
  for (const line of lines) {
    assert.ok(
      !/(stops showing|no longer showing|withdraw|taken down|hidden|unlist|unpublish)/i.test(line),
      `a note threatens the listing: ${line}`,
    );
  }
});

test('the reminder names the date and the days, and the permit one names the permit', () => {
  const r = badgeReminderCopy({ reason: 'permit', deadlineIso: '2026-12-31T15:59:59.000Z', daysLeft: 60 });
  assert.match(r.title, /Mayor's Permit runs out on December 31, 2026/);
  assert.match(r.body, /60 days/);
  const p = badgeReminderCopy({ reason: 'papers', deadlineIso: EARLY_SHOPS_PAPERS_DUE_ISO, daysLeft: 1 });
  assert.match(p.title, /March 30, 2027/);
  assert.match(p.body, /1 day to send/);
});

test('"same badge" still holds: nothing here labels a vouched shop for a couple', () => {
  const text = stripComments(readFileSync(resolve(HERE, 'verified-badge.ts'), 'utf8'));
  assert.ok(
    !/(Vouched|Provisional|Pending documents|Trial|Unverified badge)/.test(text),
    'a couple-facing distinction crept into the badge module',
  );
});
