/**
 * lib/home-first-screen.ts — WHAT THE PHONE HOME SHOWS FIRST (pure, no I/O).
 *
 * Owner-APPROVED 2026-10-01 (DECISION_LOG "THE SIMPLE PHONE APP — APPROVED";
 * `Setnayan/prototypes/phone_app_simple_2026-10-01_fable.html`, frame 1 "Home"):
 * ONE "Next" card → an always-there **Edit your Event Hub** button → three
 * numbers (days to go · coming · no reply) + one Paid / Still owing line.
 * Nothing else above the fold on a 390 × 844 phone.
 *
 * 🔑 NOTHING HERE IS NEW. The Next card is the Home's EXISTING nudges collapsed
 * into one, in the order the Home already stacked them (page.tsx `overlays`):
 *
 *   guide → the Event Hub's guided "What's left" (Details part 5 —
 *           "Round N · x of y · Continue"), for whom Details is
 *   date  → the set-your-date nudge, while no date is set
 *   papic → "Your free camera is ready", until the first photo is shot
 *   ai    → the Setnayan AI offer, last because it is a purchase, not a step
 *   plan  → nothing above is waiting: the full plan, just below
 *
 * The first that applies wins; the rest stay reachable below the fold, exactly
 * where they were. The numbers come from the existing honest reads, and a read
 * that did not happen prints "—", NEVER 0 (the rule of
 * `lib/guests-read-is-honest.test.ts`): a couple with 180 names must never be
 * told "0 coming" because a query was refused.
 */
import { formatCount } from '@/lib/format-number';
import { formatPhp } from '@/lib/php';

export type HomeNextKind = 'guide' | 'date' | 'papic' | 'ai' | 'plan';

/** The order the Home already stacked its nudges in — the first that applies is Next. */
export const HOME_NEXT_ORDER: readonly HomeNextKind[] = ['guide', 'date', 'papic', 'ai', 'plan'];

/** The guided flow's position, as Home reads it (null = nothing left, not for this viewer, or unread). */
export type HomeGuide = {
  round: number;
  roundTitle: string;
  done: number;
  total: number;
  nextTitle: string | null;
} | null;

export type HomeNext = {
  kind: HomeNextKind;
  title: string;
  body: string;
  action: string;
  href: string;
};

export type HomeNextInput = {
  eventId: string;
  guide: HomeGuide;
  hasDate: boolean;
  noun: 'wedding' | 'event';
  papicReady: boolean;
  /** An AI offer exists AND may be shown here (never in the store shell). */
  aiOffer: boolean;
};

/** ONE card, always — the first unfinished thing, else the plan below. */
export function pickHomeNext(input: HomeNextInput): HomeNext {
  const { eventId, guide, hasDate, noun, papicReady, aiOffer } = input;
  const base = `/dashboard/${eventId}`;
  if (guide) {
    return {
      kind: 'guide',
      title: guide.nextTitle ?? guide.roundTitle,
      body: `Your Event Hub · ${guide.roundTitle} · ${formatCount(guide.done)} of ${formatCount(guide.total)} done.`,
      action: 'Continue',
      href: `${base}/launch?tool=details&guide=1`,
    };
  }
  if (!hasDate) {
    return {
      kind: 'date',
      title: `Set your ${noun} date`,
      body: 'Lock it in to start the countdown and open what waits for a date.',
      action: 'Set your date',
      href: `${base}/date-selection`,
    };
  }
  if (papicReady) {
    return {
      kind: 'papic',
      title: 'Your free camera is ready',
      body: 'Hand it to someone you trust and the candids start landing in your gallery.',
      action: 'Open Papic',
      href: `${base}/studio/papic`,
    };
  }
  if (aiOffer) {
    return {
      kind: 'ai',
      title: 'Plan with Setnayan AI',
      body: 'Ask anything about your event.',
      action: 'See Setnayan AI',
      href: `${base}/studio/setnayan-ai`,
    };
  }
  return {
    kind: 'plan',
    title: 'You are on track',
    body: 'Nothing is waiting on you right now. Your whole plan is just below.',
    action: 'See your plan',
    href: '#home-all',
  };
}

/** A count the Home states — "—" when the read did not happen, never 0. */
export function glanceCount(n: number, measured: boolean): string {
  return measured ? formatCount(n) : '—';
}

/** Days to go — "—" with no firm date (never a countdown to a placeholder). */
export function glanceDays(daysOut: number | null): { value: string; label: string } {
  if (daysOut === null || !Number.isFinite(daysOut)) return { value: '—', label: 'days to go' };
  if (daysOut <= 0) return { value: '0', label: daysOut === 0 ? 'today' : 'days to go' };
  return { value: formatCount(daysOut), label: daysOut === 1 ? 'day to go' : 'days to go' };
}

/** The money line — `null` means the read did not happen, and prints "—". */
export function glanceMoney(php: number | null): string {
  return php === null ? '—' : formatPhp(php);
}
