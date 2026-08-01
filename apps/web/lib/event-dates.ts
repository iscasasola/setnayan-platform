/**
 * event-dates.ts — the type-agnostic "earliest date we know about" ladder.
 *
 * ONE fact, ONE implementation. Two surfaces resolve the day an event is
 * pointed at, and until this module existed they each carried their own copy of
 * the same three-step ladder:
 *
 *   - `lib/wedding-roadmap-signals.fetchRoadmapState` → Studio's phase-aware
 *     "Recommended for you now" heuristic (`lib/studio-recommendations.ts`).
 *   - `lib/checklist.checklistAnchorDateFor` → the couple checklist's deadline
 *     anchor, on both the launcher card and the checklist page.
 *
 * WHY IT LIVES HERE, in a module named after neither of them. PR #4020 declined
 * to reuse the roadmap copy, and its reasoning was sound but narrower than it
 * read: importing from a module called *wedding-roadmap-signals* in order to
 * say *"weddings do NOT use this ladder"* would obscure the very rule the
 * checklist anchor exists to state. That is an objection to NAMING and to
 * DEPENDENCY DIRECTION — not to sharing. A neutral third home dissolves it:
 * neither surface depends on the other's module, and the checklist anchor still
 * reads as its own rule.
 *
 * The split is along a real seam. "The earliest date we know about for this
 * event" is a type-agnostic FACT about a row. "Weddings anchor on the locked
 * date alone" is POLICY, and it belongs to the checklist — so it stays in
 * `lib/checklist.ts`, layered on top of this. What this module exports is a
 * primitive, not either surface's contract.
 *
 * WHY IT IS WORTH SHARING AT ALL — the drift risk is asymmetric and has already
 * been demonstrated in this exact code. Fix an edge case in one copy (an empty
 * `date_candidates` array, a malformed value, a non-array) and the other keeps
 * the bug silently. That is precisely the shape of the #4020 defect: two
 * surfaces a click apart answering the same question differently, with the
 * WRONG one under-reporting and therefore never complaining.
 *
 * PURITY IS LOAD-BEARING. No I/O, no `server-only`, no Supabase import, no
 * React — nothing at all, by design. Both of the modules that compose this one
 * pull in server-side machinery, and a value import from a server module into a
 * client-reachable file fails only at `next build`, i.e. only in CI. Keeping
 * this file import-free means any surface, client or server, can read the
 * ladder without dragging a server module behind it. `event-dates.test.ts`
 * asserts the file has no imports.
 */

/**
 * The `events` columns the ladder reads. Every field is optional and nullable:
 * a caller that SELECTed fewer columns must degrade to "we know nothing",
 * never throw.
 */
export type EventDateFields = {
  /** The LOCKED calendar day (Postgres `date`), or null until it locks. */
  event_date?: string | null;
  /** Shortlisted days the host is choosing between. Order is NOT guaranteed. */
  date_candidates?: string[] | null;
  /** First day of a rough target window, when only a window is known. */
  date_window_start?: string | null;
};

/**
 * The earliest day this event is known to be pointed at:
 *
 *     locked `event_date`  →  else earliest `date_candidates`  →  else `date_window_start`
 *
 * Deliberately PRECISION-AGNOSTIC. It answers "how far out are we?" as soon as
 * there is any target at all, even a rough window — which is what planning
 * timing needs. It is NOT the event's date: a candidate is a guess, and callers
 * that would change a user-visible STATE on it (day-of / recap mode, the
 * countdown, "is this event past?") must keep reading `events.event_date`
 * directly. Letting a guess flip an event into day-of, or file it under
 * completed, is a real regression. Both current callers use it only to compute
 * planning timing, never state.
 *
 * ISO `yyyy-mm-dd` sorts chronologically, so the candidate sort is a plain
 * lexicographic one. It is defensive rather than trusting stored order, and it
 * operates on the fresh array `.filter()` returns — the caller's row is never
 * mutated. Falsy candidates (null, undefined, empty string) are dropped, so an
 * all-empty array cannot shadow the window start.
 *
 * Returns null when the row carries no usable date anywhere.
 */
export function earliestKnownEventDate(event: EventDateFields): string | null {
  const earliestCandidate = (event.date_candidates ?? []).filter(Boolean).sort()[0] ?? null;
  return event.event_date ?? earliestCandidate ?? event.date_window_start ?? null;
}
