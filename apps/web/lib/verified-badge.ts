/**
 * verified-badge.ts — THE BADGE HAS A DEADLINE; THE SHOP DOES NOT.
 *
 * ── THE OWNER'S RULINGS (2026-09-11, DECISION_LOG "SEVEN SUPPLIER-SIDE
 *    QUESTIONS", Q4 + Q5) ────────────────────────────────────────────────────
 * • Q4 — the two shops verified BEFORE the papers check existed keep the
 *   Verified badge for six months while their papers come in; after six months
 *   without them the badge comes off — the same deadline as a vouch.
 * • Q5 — when a shop's Mayor's Permit runs out: a reminder 60 days ahead; on
 *   the day, the Verified badge comes off, and the shop STAYS FINDABLE AND
 *   BOOKABLE.
 *
 * ── WHY THE BADGE IS A SEPARATE QUESTION FROM "IS THE SHOP LIVE" ───────────
 * In this codebase `verification_state = 'verified'` is three things at once:
 * the public read policy (`vendor_profiles_public_read`), the booking trigger
 * (`enforce_booking_requires_verified_vendor`) and the badge. Flipping that
 * column at a deadline would therefore HIDE the shop and make it UNBOOKABLE —
 * the exact outcome Q5 rules out. So the state column is never touched at a
 * deadline. The badge alone reads a second fact: `next_renewal_due_at`, which
 * approval already writes, now meaning "the day this badge needs fresh papers".
 *
 * 🔑 EXPIRY ON READ, NOT ON A SCHEDULE. The badge comes off because the date
 * passed, not because a job ran — so it is never late, and a quiet week in
 * production cannot leave a lapsed badge standing. The daily pass
 * (`verified-badge-sweep.ts`) only SPEAKS: the 60-day reminder and the
 * "your badge came off" note. It writes nothing that decides the badge.
 *
 * ⚠ "SAME BADGE" (owner, 2026-09-07) STILL HOLDS: nothing here returns a
 * couple-facing label that tells a vouched shop from a papered one. A couple
 * sees the badge, or does not.
 *
 * PURE — no DB, no network, no `server-only`.
 */

import { formatLongDate } from '@/lib/format-date';

/** The owner's figure (Q5): the reminder goes out this many days ahead. */
export const BADGE_REMINDER_DAYS = 60;

/**
 * A permit date further out than this is a typo, not a permit. A Philippine
 * Mayor's (business) Permit runs for the calendar year and is renewed each
 * January, so no genuine one is valid for much more than twelve months from
 * the day it is checked.
 */
export const PERMIT_MAX_DAYS_AHEAD = 400;

const DAY_MS = 86_400_000;

/**
 * The Q4 deadline for the shops verified before the papers check existed:
 * 182 days (the vouch window, `BYPASS_WINDOW_DAYS`) from the ruling on
 * 2026-09-11, at the END of that day in Manila. Fixed rather than "now() + 182
 * days" at migrate time, so the date the owner is told is the date the badge
 * obeys, however long the PR waits to merge.
 */
export const EARLY_SHOPS_PAPERS_DUE_ISO = '2027-03-12T15:59:59.000Z';

export type BadgeFacts = {
  /** `vendor_profiles.verification_state`. Only `'verified'` can carry a badge. */
  verification_state: string | null | undefined;
  /**
   * `vendor_profiles.next_renewal_due_at` — the day the badge needs fresh
   * papers. `undefined`/null = no deadline recorded.
   */
  next_renewal_due_at?: string | null;
};

/** Epoch ms of a deadline, or null when absent OR unparseable. */
export function badgeDeadlineMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const ms = Date.parse(raw);
  // An unreadable date must NOT read as "lapsed" — that would take the badge
  // off a real shop over a bad string. Absence of a usable date is absence of
  // a deadline (the same rule `bypassState` applies to a vouch).
  return Number.isFinite(ms) ? ms : null;
}

/**
 * THE ONE PREDICATE for "does this shop wear the Verified badge right now?"
 *
 * Verified, and its badge deadline (if it has one) has not passed. It says
 * NOTHING about whether the shop is listed or bookable — those stay on
 * `verification_state` alone, which is the whole point of Q5.
 */
export function hasVerifiedBadge(facts: BadgeFacts, now: Date = new Date()): boolean {
  if (facts.verification_state !== 'verified') return false;
  const deadline = badgeDeadlineMs(facts.next_renewal_due_at);
  if (deadline === null) return true;
  return deadline > now.getTime();
}

export type BadgeDeadline =
  /** Not verified, or verified with no deadline on record. */
  | { kind: 'none' }
  /** Deadline more than 60 days away. */
  | { kind: 'ahead'; daysLeft: number }
  /** Inside the 60-day reminder window, badge still on. */
  | { kind: 'reminder'; daysLeft: number }
  /** Deadline passed — the badge is off (the shop is still listed). */
  | { kind: 'lapsed'; daysOver: number };

export function badgeDeadline(facts: BadgeFacts, now: Date = new Date()): BadgeDeadline {
  if (facts.verification_state !== 'verified') return { kind: 'none' };
  const deadline = badgeDeadlineMs(facts.next_renewal_due_at);
  if (deadline === null) return { kind: 'none' };
  const ms = deadline - now.getTime();
  if (ms <= 0) return { kind: 'lapsed', daysOver: Math.floor(-ms / DAY_MS) };
  const daysLeft = Math.ceil(ms / DAY_MS);
  return daysLeft <= BADGE_REMINDER_DAYS
    ? { kind: 'reminder', daysLeft }
    : { kind: 'ahead', daysLeft };
}

// ---------------------------------------------------------------------------
// The Mayor's Permit date — read off the permit by the reviewer at approval.
// ---------------------------------------------------------------------------

/** Today's date in Manila as `YYYY-MM-DD`. */
export function manilaDateKey(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/**
 * The prefill for the reviewer's "valid until" field: 31 December of the
 * current Manila year, because a Mayor's Permit runs for the calendar year.
 * A PREFILL, not an answer — the field sits under a label telling the reviewer
 * to read the date printed on the permit.
 */
export function defaultPermitValidUntil(now: Date = new Date()): string {
  return `${manilaDateKey(now).slice(0, 4)}-12-31`;
}

export type PermitDateResult =
  | { ok: true; deadlineIso: string }
  | { ok: false; error: string };

/**
 * The reviewer's `YYYY-MM-DD` as the badge deadline: the END of that day in
 * Manila (23:59:59 +08:00). A permit valid "until December 31" is valid all of
 * December 31; the badge comes off as January 1 begins.
 */
export function permitDeadlineFrom(raw: string, now: Date = new Date()): PermitDateResult {
  const key = raw.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return { ok: false, error: 'Write the permit date as YYYY-MM-DD.' };
  const [, y, mo, d] = m;
  const iso = new Date(`${y}-${mo}-${d}T23:59:59+08:00`);
  if (!Number.isFinite(iso.getTime()) || manilaDateKey(iso) !== key) {
    return { ok: false, error: 'That permit date is not a real day.' };
  }
  const ms = iso.getTime() - now.getTime();
  if (ms <= 0) {
    return { ok: false, error: 'That Mayor’s Permit has already run out — ask for the current one.' };
  }
  if (ms > PERMIT_MAX_DAYS_AHEAD * DAY_MS) {
    return {
      ok: false,
      error: 'That permit date is more than a year away — check the date printed on the permit.',
    };
  }
  return { ok: true, deadlineIso: iso.toISOString() };
}

/**
 * The deadline an approval writes. The permit's own date when the reviewer
 * recorded one; otherwise the one-year renewal the approval has always
 * written (so an approval with no permit date behaves exactly as before).
 */
export function deadlineAtApproval(approvedAt: Date, permitDeadlineIso: string | null): string {
  if (permitDeadlineIso) return permitDeadlineIso;
  const d = new Date(approvedAt.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// The daily pass — what to SAY, decided purely.
// ---------------------------------------------------------------------------

/**
 * WHY the deadline exists, which decides the words — never whether it applies.
 *   • `papers`  — the shop is on Setnayan's word (a vouch, or one of the two
 *                 shops verified before the papers check): papers are owed.
 *   • `permit`  — papers were approved; the deadline is the Mayor's Permit's.
 *   • `renewal` — verified with no papers and no vouch on record: the yearly
 *                 renewal the approval wrote.
 */
export type DeadlineReason = 'papers' | 'permit' | 'renewal';

export type SweepCandidate = {
  vendorProfileId: string;
  verificationState: string | null;
  deadline: string | null;
};

export type SweepAction =
  | { kind: 'remind'; vendorProfileId: string; deadlineIso: string; daysLeft: number }
  | { kind: 'lapse'; vendorProfileId: string; deadlineIso: string };

/** The dedupe key: one reminder and one lapse note per shop PER DEADLINE. */
export function sweepKey(kind: SweepAction['kind'], vendorProfileId: string, deadlineIso: string): string {
  return `${kind}:${vendorProfileId}:${deadlineIso}`;
}

/**
 * Decide, for each shop near or past its deadline, whether to remind, note
 * the lapse, or stay quiet.
 *
 * ⚠ A LAPSE NEVER SENDS A REMINDER. Passes ride request traffic, so a shop can
 * cross into the window and past the deadline between two of them. "60 days
 * left" delivered after the badge is already off is worse than silence — the
 * same order the lock-request fuse keeps. It gets the lapse note alone.
 *
 * Keyed by the deadline itself, so a renewal (a NEW deadline) earns a fresh
 * reminder and a fresh note, and a re-run on the same deadline is a no-op.
 */
export function planBadgeDeadlineSweep(
  candidates: readonly SweepCandidate[],
  alreadyDone: ReadonlySet<string>,
  now: Date = new Date(),
): SweepAction[] {
  const out: SweepAction[] = [];
  for (const c of candidates) {
    const state = badgeDeadline(
      { verification_state: c.verificationState, next_renewal_due_at: c.deadline },
      now,
    );
    const ms = badgeDeadlineMs(c.deadline);
    if (ms === null) continue;
    const deadlineIso = new Date(ms).toISOString();
    if (state.kind === 'lapsed') {
      if (!alreadyDone.has(sweepKey('lapse', c.vendorProfileId, deadlineIso))) {
        out.push({ kind: 'lapse', vendorProfileId: c.vendorProfileId, deadlineIso });
      }
    } else if (state.kind === 'reminder') {
      if (!alreadyDone.has(sweepKey('remind', c.vendorProfileId, deadlineIso))) {
        out.push({
          kind: 'remind',
          vendorProfileId: c.vendorProfileId,
          deadlineIso,
          daysLeft: state.daysLeft,
        });
      }
    }
  }
  return out;
}

/** "March 12, 2027" — the deadline's day in Manila. */
export function deadlineLabel(deadlineIso: string): string {
  return formatLongDate(manilaDateKey(new Date(deadlineIso)));
}

const STAYS_LISTED =
  'Your shop stays listed and couples can still book you either way — only the badge is affected.';

/** The 60-day reminder, to the supplier. Email + in-app, through the usual path. */
export function badgeReminderCopy(args: {
  reason: DeadlineReason;
  deadlineIso: string;
  daysLeft: number;
}): { title: string; body: string } {
  const date = deadlineLabel(args.deadlineIso);
  const days = `${args.daysLeft} ${args.daysLeft === 1 ? 'day' : 'days'}`;
  switch (args.reason) {
    case 'papers':
      return {
        title: `Your papers are due by ${date}`,
        body:
          `You have ${days} to send your DTI or SEC registration, BIR 2303, Mayor's Permit and ` +
          `bank proof to keep your Verified badge. ${STAYS_LISTED}`,
      };
    case 'permit':
      return {
        title: `Your Mayor's Permit runs out on ${date}`,
        body:
          `The Mayor's Permit we have on file expires in ${days}. Send the renewed one before ` +
          `then to keep your Verified badge. ${STAYS_LISTED}`,
      };
    case 'renewal':
      return {
        title: `Your Verified badge is up for renewal on ${date}`,
        body:
          `In ${days} your Verified badge needs your current papers — including this year's ` +
          `Mayor's Permit. ${STAYS_LISTED}`,
      };
  }
}

/** The note on the day the badge comes off. */
export function badgeLapsedCopy(args: {
  reason: DeadlineReason;
  deadlineIso: string;
}): { title: string; body: string } {
  const date = deadlineLabel(args.deadlineIso);
  const why =
    args.reason === 'papers'
      ? `your papers did not arrive by ${date}`
      : args.reason === 'permit'
        ? `the Mayor's Permit we have on file ran out on ${date}`
        : `your verification was due for renewal on ${date}`;
  return {
    title: 'Your Verified badge is off for now',
    body:
      `The Verified badge came off your shop because ${why}. Your shop is still listed and ` +
      `couples can still book you. Send your papers and the badge comes back once they are checked.`,
  };
}
