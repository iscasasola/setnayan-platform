/**
 * Inquiry velocity gate — Phase A of fake-inquiry protection (couple side).
 *
 * The problem: a couple opening an inquiry is free and frictionless, while a
 * vendor ANSWERING it burns a token. That asymmetry is what a spam/bot flood (or
 * a competitor's sock-puppet farm) exploits — hundreds of junk inquiries the
 * vendor has to triage (and, if they accept, pay for). This gate is the cheap
 * front-door velocity limit that blunts the flood before it reaches vendors.
 *
 * ── Presumption of a real couple (the governing invariant) ───────────────────
 * A false positive on a COUPLE is far worse than a false negative on a fake —
 * couples are the demand engine. So the caps here are deliberately GENEROUS:
 * they are set to catch scripted volume, NOT a thorough real couple shortlisting
 * many vendors. No single-account signal ever "flags" anyone; the harshest thing
 * a real couple can hit is a friendly "you've opened a lot today" nudge, never an
 * accusation. When in doubt we let the inquiry through.
 *
 * Pure by design (no I/O, no Supabase import) — mirrors lib/fraud-detection.ts:
 * the caller supplies the two counts, this module only decides. That keeps the
 * decision unit-testable and the DB typing where it already works (the action).
 *
 * Flag-gated (`NEXT_PUBLIC_INQUIRY_GATE_ENABLED`, default OFF) — merging this
 * changes NOTHING until the owner flips it, and the caps below can be tuned
 * before rollout. Applies ONLY to manual, couple-initiated inquiries; system
 * fan-outs (the pending-pick dispatcher, the onboarding "Your Plan" fan-out) are
 * exempt so a legitimate batch flush never trips it.
 */

/** Master switch. Default OFF → the gate is inert until the owner opts in. */
export function inquiryGateEnabled(): boolean {
  return process.env.NEXT_PUBLIC_INQUIRY_GATE_ENABLED === 'true';
}

/**
 * Phase D — the lead trust badge (the "informed accept"). When ON, the masked
 * lead shows a POSITIVE "Active planner" chip for a couple with real engagement.
 * Purely additive UI, default OFF → the vendor inbox looks exactly as today.
 */
export function leadTrustBadgeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LEAD_TRUST_BADGE_ENABLED === 'true';
}

/**
 * Max NEW inquiries one couple account may open in a rolling 24h window, across
 * all their events. Tuned to sit far above a real planning binge (a couple
 * shortlisting hard across many categories in a day) and only catch scripted
 * volume. Admin-tunable later; a constant is enough for the flag-gated v1.
 */
export const INQUIRY_DAILY_CAP = 25;

/**
 * Max concurrently-open (non-declined) vendor threads on a SINGLE event. A big
 * wedding legitimately spans ~10-15 categories with a few candidates each, so
 * this ceiling is set high enough to never bite a thorough couple — it exists to
 * stop a single event's inbox being weaponised into hundreds of threads.
 */
export const INQUIRY_CONCURRENT_OPEN_CAP = 40;

export type InquiryVelocityVerdict =
  | { ok: true }
  | { ok: false; reason: 'daily' | 'concurrent'; message: string };

/**
 * Decide whether a NEW manual inquiry may proceed, given the couple's current
 * counts. Friendly, non-accusatory copy per the invariant — every message points
 * the couple at a constructive next step, never implies they did something wrong.
 */
export function evaluateInquiryVelocity(counts: {
  /** Threads this couple opened in the last rolling 24h (all their events). */
  dailyCount: number;
  /** Non-declined threads already open on THIS event. */
  concurrentOpenCount: number;
}): InquiryVelocityVerdict {
  if (counts.dailyCount >= INQUIRY_DAILY_CAP) {
    return {
      ok: false,
      reason: 'daily',
      message:
        "You've opened a lot of vendor conversations today — nice work planning! " +
        'Pick things back up tomorrow, or continue with the vendors you’re already talking to.',
    };
  }
  if (counts.concurrentOpenCount >= INQUIRY_CONCURRENT_OPEN_CAP) {
    return {
      ok: false,
      reason: 'concurrent',
      message:
        'You already have a lot of vendor conversations going for this event. ' +
        'Try moving forward with a few of them before starting more — you can always come back.',
    };
  }
  return { ok: true };
}
