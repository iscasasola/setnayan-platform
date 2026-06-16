/**
 * Build 3d-C — the VENDOR RE-QUOTE NUDGE (Build_3State_Solver_2026-06-16.md §7).
 *
 * When the 3-state Build's Auto resolution turns a QUOTED vendor away because
 * their price exceeded the remaining budget — but that vendor still PASSES the
 * date + location gate — we message that vendor IN their chat thread inviting a
 * fresh proposition ("your service fits their date and venue; their budget is a
 * little under your last proposal — want to re-propose?"). It is opportunity-
 * framed, never a rejection, and NEVER prints the couple's budget number.
 *
 * ── THE DEFINING SAFETY RULE ─────────────────────────────────────────────────
 * The nudge fires ONLY from `runBuild3State`, which is gated by
 * `BUILD_3STATE_ENABLED`. With the flag OFF (the default), `runBuild3State`
 * returns before any resolution runs, so NO nudge can ever fire. This module is
 * pure (no DB, no env) — the flag check lives at the single call site. It does
 * NOT depend on Setnayan AI; the nudge fires for both the cheapest-fit (AI-off)
 * and compat (AI-on) Auto paths.
 *
 * ── THE GATE (owner-locked) ──────────────────────────────────────────────────
 * Nudge a quoted vendor ONLY when ALL hold:
 *   (a) they have a quote (the resolver only ever puts vendors with a quote into
 *       `budgetRejected`, so this is guaranteed upstream);
 *   (b) they PASS the date + location gate — represented here by a live,
 *       non-committed inquiry the couple solicited for THIS event (a date/
 *       location miss never reaches the quoted set, so re-quoting couldn't fix
 *       it → SILENT);
 *   (c) their quote exceeded the remaining budget (i.e. they're in
 *       `budgetRejected`).
 * A vendor with no chat thread (off-platform / custom — no marketplace link) has
 * nowhere to post, so it is silently skipped.
 *
 * ── THE THROTTLE (owner-locked) ──────────────────────────────────────────────
 * ONE nudge per (event_id, vendor, plan_group). A service with a PENDING,
 * un-replied nudge is opted out. The vendor must REPLY (any vendor message in
 * the thread created AFTER the nudge's sent_at) before another auto-nudge can be
 * sent for that service. `selectNudgesToSend` is the pure decision: it takes the
 * budget-rejected candidates + the prior-nudge throttle rows and returns exactly
 * the (event, vendor, plan_group) keys that are eligible to fire NOW.
 *
 * This is the PURE core (no DB, no React) — unit-tested in
 * `build-requote-nudge.test.ts`. The DB read/write + message post live in
 * `app/dashboard/[eventId]/vendors/build-3state-actions.ts`.
 */

/** A quoted vendor an Auto row turned away purely on budget, resolved to its
 *  chat thread. Only vendors WITH a thread (marketplace-linked) are candidates;
 *  off-platform vendors are dropped before this stage (nowhere to post). */
export type NudgeCandidate = {
  planGroupId: string;
  /** The marketplace vendor_profiles id (the chat thread's vendor key). */
  vendorProfileId: string;
  /** The open chat thread between this couple and vendor. */
  threadId: string;
};

/**
 * The throttle state for one (vendor, plan_group) we previously nudged on this
 * event. `repliedSince` is true when the vendor posted ANY message in the
 * thread AFTER the nudge's `sentAt` — that "reply" re-opens the service for a
 * future nudge. A row that is present with `repliedSince=false` is a PENDING,
 * un-replied nudge → that (vendor, plan_group) is opted out this run.
 */
export type PriorNudge = {
  vendorProfileId: string;
  planGroupId: string;
  /** Vendor replied in-thread after the last nudge → no longer opted out. */
  repliedSince: boolean;
};

/** A nudge cleared to send: the thread to post in + the throttle key to stamp. */
export type NudgeToSend = {
  planGroupId: string;
  vendorProfileId: string;
  threadId: string;
};

/** Stable throttle key for a (vendor, plan_group) on a given event. */
export function nudgeThrottleKey(vendorProfileId: string, planGroupId: string): string {
  return `${vendorProfileId}::${planGroupId}`;
}

/**
 * PURE throttle decision: among the budget-rejected candidates (already gated to
 * date/location-passing, quote-bearing, thread-linked vendors), return exactly
 * the ones eligible to nudge NOW under the one-per-(event,vendor,service)
 * reply-gated throttle.
 *
 * Eligibility for a candidate `(vendorProfileId, planGroupId)`:
 *   • No prior nudge row for this (vendor, plan_group) → eligible (first nudge).
 *   • A prior nudge row exists AND the vendor REPLIED since (`repliedSince`)
 *     → eligible again (the reply re-opened the service).
 *   • A prior nudge row exists and the vendor has NOT replied → OPTED OUT (a
 *     pending, un-replied nudge already holds the slot) → skipped.
 *
 * Deterministic + de-duped: at most ONE nudge per (vendor, plan_group) per run,
 * even if the same pair appears twice in `candidates` (e.g. a multi-pick group
 * passed the same vendor over twice — impossible today, but the de-dupe makes
 * the contract robust). Order follows first appearance in `candidates`.
 */
export function selectNudgesToSend(args: {
  candidates: ReadonlyArray<NudgeCandidate>;
  priorNudges: ReadonlyArray<PriorNudge>;
}): NudgeToSend[] {
  const { candidates, priorNudges } = args;

  // Index the throttle rows by (vendor, plan_group). A pending un-replied row
  // opts the pair out; a replied row does not.
  const optedOut = new Set<string>();
  for (const p of priorNudges) {
    if (!p.repliedSince) optedOut.add(nudgeThrottleKey(p.vendorProfileId, p.planGroupId));
  }

  const out: NudgeToSend[] = [];
  const emitted = new Set<string>();
  for (const c of candidates) {
    const key = nudgeThrottleKey(c.vendorProfileId, c.planGroupId);
    if (optedOut.has(key)) continue; // pending un-replied nudge → opted out.
    if (emitted.has(key)) continue; // already cleared once this run → de-dupe.
    emitted.add(key);
    out.push({
      planGroupId: c.planGroupId,
      vendorProfileId: c.vendorProfileId,
      threadId: c.threadId,
    });
  }
  return out;
}

/**
 * The in-thread nudge copy (Build 3d-C). ENGLISH, opportunity-framed (never a
 * rejection), and the couple's BUDGET NUMBER is WITHHELD — we only say it's "a
 * little under your last proposal". Mentions the date + venue fit (the gate the
 * vendor passed) and points at the proposals surface to send a fresh one.
 *
 * Pure (string in → string out) so it's snapshot-testable and carries no PII
 * beyond the couple's display name + the category label, both already visible to
 * the vendor on the thread.
 */
export function buildRequoteNudgeBody(args: {
  coupleLabel: string;
  categoryLabel: string;
}): string {
  const couple = args.coupleLabel.trim() || 'A couple';
  const category = args.categoryLabel.trim() || 'this service';
  return (
    `Good news — ${couple} is building their plan and your service fits their ` +
    `date and venue. Their budget for ${category} is currently a little under ` +
    `your last proposal. Want to send them a new proposition? You can put one ` +
    `together here: /vendor-dashboard/proposals`
  );
}
