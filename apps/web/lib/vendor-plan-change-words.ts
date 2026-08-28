/**
 * lib/vendor-plan-change-words.ts — what a shop is told about a plan change.
 *
 * A scheduled plan change is a PROMISE ABOUT THE FUTURE: "you are on Pro now,
 * you become Solo on 19 October, and the ₱1,400 you are holding comes off your
 * next bill automatically." If that cannot be said in one plain sentence, the
 * mechanism behind it is wrong — so the sentences live here, pure and tested,
 * rather than being assembled inline in JSX where nothing can check them.
 *
 * PURE: no I/O, no clock of its own (it takes `nowMs`), no DB types. Everything
 * it says is derived from values the server already read.
 *
 * ⚖ NO JARGON. Not "proration", not "tier", not "billing cycle", not "credit
 * balance". A supplier reads *plan*, *changes to*, *on <date>*, and *money left
 * on your account*. The owner's standing rule is that the reply is about what a
 * person experiences, and a screen is a reply.
 */

export type PlanWord = 'Free' | 'Free · Verified' | 'Solo' | 'Pro' | 'Enterprise' | 'Custom';

/** The plan names a supplier actually reads. */
export function planWord(tier: string | null | undefined): PlanWord {
  switch (tier) {
    case 'custom':
      return 'Custom';
    case 'enterprise':
      return 'Enterprise';
    case 'pro':
      return 'Pro';
    case 'solo':
      return 'Solo';
    case 'verified':
      return 'Free · Verified';
    default:
      return 'Free';
  }
}

/** ₱1,400 · ₱1,857.14 — pesos, with centavos only when there are any. */
export function pesos(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '₱0';
  const whole = Math.round(n * 100) % 100 === 0;
  return (
    '₱' +
    n.toLocaleString('en-PH', {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

function dayWords(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export interface PlanSituation {
  /** What they are on right now. */
  currentTier: string | null;
  /** The plan that takes over when the current term ends, if any. */
  pendingTier: string | null;
  /**
   * When the current term ends. THIS IS THE DATE THE CHANGE LANDS — there is no
   * separate stored effective date, deliberately, because a second copy of this
   * value goes wrong the first time somebody renews while a change is waiting.
   */
  tierExpiresAt: string | null;
  /** Money already paid that is waiting to be spent on the next bill. */
  creditPhp: number;
}

export interface PlanLines {
  /** "You are on Pro." — always present. */
  now: string;
  /** "It changes to Solo on 19 October 2026." — only when one is scheduled. */
  change: string | null;
  /** "You have ₱1,400 on your account…" — only when they hold money. */
  credit: string | null;
}

/**
 * The three sentences. Any of them may be shown alone; together they are the
 * whole story a supplier needs about where their plan stands.
 *
 * The change sentence is deliberately WITHDRAWN when there is no date to name.
 * "It changes to Solo" with no date is worse than saying nothing: it is a
 * promise with no due date, and the reader cannot tell whether it means today.
 */
export function planLines(s: PlanSituation): PlanLines {
  const nowWord = planWord(s.currentTier);
  const lines: PlanLines = {
    now: `You are on ${nowWord}.`,
    change: null,
    credit: null,
  };

  if (s.pendingTier && s.tierExpiresAt) {
    lines.change =
      `It changes to ${planWord(s.pendingTier)} on ${dayWords(s.tierExpiresAt)}. ` +
      `Nothing changes before then — you keep ${nowWord} until that day.`;
  }

  if (Number.isFinite(s.creditPhp) && s.creditPhp > 0) {
    lines.credit =
      `You have ${pesos(s.creditPhp)} left on your account from what you have ` +
      `already paid. We take it off your next bill automatically — you do not ` +
      `need to do anything, and it does not run out on a date.`;
  }

  return lines;
}

/**
 * What the buy button should promise for a given move, before any money changes
 * hands. Mirrors the two rules exactly: up is today and prorated, down waits.
 */
export function moveSentence(
  direction: 'upgrade' | 'downgrade' | 'renewal' | 'new',
  opts: { toTier: string; tierExpiresAt: string | null },
): string {
  const to = planWord(opts.toTier);
  switch (direction) {
    case 'upgrade':
      return `${to} starts as soon as we confirm your payment. Whatever you have not used of your current plan comes off the price.`;
    case 'downgrade':
      return opts.tierExpiresAt
        ? `${to} starts on ${dayWords(opts.tierExpiresAt)}, when your current plan runs out. You keep everything you are paying for until then.`
        : `${to} starts when your current plan runs out.`;
    default:
      return `This adds another term of ${to} on top of the time you already have.`;
  }
}
