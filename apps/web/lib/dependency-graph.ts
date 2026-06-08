/**
 * Dependency-awareness engine — §4B of What_Is_Setnayan_AI_2026-06-08.md
 * (edge set LOCKED 2026-06-08, owner-ratified). Encodes the Concierge-Brain
 * planning cascade (venue → date → officiant → caterer → …) as DATA instead of
 * prose, so Setnayan AI can tell a couple "finalize X first, then your Y
 * matches better."
 *
 * Two relationship types:
 *   • dependsOn (one-way) — a prerequisite that should be finalized first.
 *   • mutual (order-resolved pair) — either node can go first; whichever the
 *     couple locks first anchors, the second complements. Mutual pairs NEVER
 *     produce a "lock X first" nudge (both orders are valid) — they're recorded
 *     here for completeness + the future matching-anchor logic.
 *
 * ALWAYS SOFT (owner-locked): a dependency is a NUDGE, never a hard block. The
 * `(H)` / `(s)` prominence only sets how loud the reminder is — `H` = strong
 * (the downstream match is materially worse without it), `s` = gentle. Neither
 * is a gate.
 *
 * 🔒 Locked invariant: no matter which venue locks first, the RECEPTION venue is
 * always the proximity anchor for reception-anchored services (§3.3). The
 * ceremony↔reception mutual pair is about browse order, not the anchor.
 *
 * This module is PURE (no DB, no React) — the caller resolves which nodes are
 * "satisfied" (a finalized vendor category / a set planning artifact) and calls
 * resolveDependency(). Unknown signals FAIL OPEN (treated as satisfied) so the
 * engine never shows a wrong nudge.
 */

import type { PlanGroupId } from '@/lib/wedding-plan-groups';

/** Prominence of a dependency nudge — display loudness only, never a gate. */
export type DependencyProminence = 'H' | 's';

/**
 * A node in the graph: a plan-group (vendor category) OR a non-vendor planning
 * artifact ("decision node") that lives on another surface.
 */
export type DependencyNodeId =
  | PlanGroupId
  | 'wedding_date'
  | 'mood_board'
  | 'sponsors_confirmed'
  | 'invitations_sent'
  | 'rsvp_headcount'
  | 'seating_chart';

type Edge = { prereq: DependencyNodeId; prominence: DependencyProminence };

/**
 * One-way `dependsOn` edges, keyed by the dependent plan-group (§4B.2). Each
 * value lists the prerequisites that should be finalized first. Every edge
 * points at an equal-or-earlier deadline tier, so the graph never contradicts
 * the per-category deadlines (§3.1).
 */
export const DEPENDS_ON: Partial<Record<PlanGroupId, ReadonlyArray<Edge>>> = {
  coordinator: [{ prereq: 'wedding_date', prominence: 's' }],
  officiant: [{ prereq: 'ceremony_venue', prominence: 'H' }],
  catering: [{ prereq: 'reception_venue', prominence: 'H' }],
  photography: [{ prereq: 'wedding_date', prominence: 'H' }],
  hair_makeup: [{ prereq: 'wedding_date', prominence: 's' }],
  florals_decor: [
    { prereq: 'mood_board', prominence: 'H' },
    { prereq: 'reception_venue', prominence: 's' },
  ],
  live_band: [{ prereq: 'wedding_date', prominence: 'H' }],
  music_entertainment: [{ prereq: 'wedding_date', prominence: 'H' }],
  host_mc: [{ prereq: 'wedding_date', prominence: 'H' }],
  lights_sound: [{ prereq: 'reception_venue', prominence: 'H' }],
  led_background: [
    { prereq: 'mood_board', prominence: 'H' },
    { prereq: 'reception_venue', prominence: 's' },
  ],
  cocktail_booths: [{ prereq: 'reception_venue', prominence: 'H' }],
  photobooth: [{ prereq: 'reception_venue', prominence: 'H' }],
  cake: [
    { prereq: 'catering', prominence: 's' },
    { prereq: 'mood_board', prominence: 's' },
  ],
  bridal_car: [{ prereq: 'wedding_date', prominence: 's' }],
  guest_shuttle: [
    { prereq: 'reception_venue', prominence: 'H' },
    { prereq: 'ceremony_venue', prominence: 's' },
  ],
  accommodation: [{ prereq: 'reception_venue', prominence: 'H' }],
  invitations_stationery: [
    { prereq: 'sponsors_confirmed', prominence: 'H' },
    { prereq: 'mood_board', prominence: 's' },
  ],
  logistics: [
    { prereq: 'reception_venue', prominence: 's' },
    { prereq: 'rsvp_headcount', prominence: 's' },
  ],
  // rings — standalone (no prerequisite), but still carries its own deadline.
};

/**
 * Order-resolved `mutual` pairs (§4B.2): either node may be locked first; the
 * first anchors, the second complements. NOT used for nudges (both orders are
 * valid). Exposed for the matching layer + documentation.
 */
export const MUTUAL_PAIRS: ReadonlyArray<readonly [DependencyNodeId, DependencyNodeId]> = [
  ['ceremony_venue', 'reception_venue'],
  ['attire', 'mood_board'],
];

/** Human labels for the non-plan-group prerequisite nodes (plan groups carry
 *  their own label in PLAN_GROUPS). Used to build the nudge copy. */
export const DEPENDENCY_NODE_LABEL: Partial<Record<DependencyNodeId, string>> = {
  wedding_date: 'wedding date',
  mood_board: 'mood board',
  sponsors_confirmed: 'principal sponsors',
  invitations_sent: 'invitations',
  rsvp_headcount: 'RSVP headcount',
  seating_chart: 'seating chart',
  ceremony_venue: 'ceremony venue',
  reception_venue: 'reception venue',
  catering: 'caterer',
};

export type DependencyState =
  | {
      status: 'blocked';
      /** The single prerequisite to nudge (highest prominence, unmet). */
      prereqId: DependencyNodeId;
      prereqLabel: string;
      prominence: DependencyProminence;
    }
  | { status: 'ready' }
  | null;

/**
 * Resolve the dependency state for one plan-group given the set of SATISFIED
 * nodes (finalized vendor categories + set planning artifacts; unknown signals
 * are simply absent from the set when the caller fails open by ADDING them).
 *
 * - No `dependsOn` edges, or the group is already finalized → null (no nudge).
 * - Any prerequisite unmet → `blocked`, nudging the highest-prominence one.
 * - All prerequisites met → `ready` (the flip from "lock X first" to "go").
 *
 * Always soft: the result is advisory copy, never a gate. The CALLER decides
 * WHEN to surface it (e.g. only once the category is in its action window).
 */
export function resolveDependency(
  groupId: PlanGroupId,
  satisfied: ReadonlySet<DependencyNodeId>,
  groupFinalized: boolean,
  labelFor?: (id: DependencyNodeId) => string | undefined,
): DependencyState {
  const edges = DEPENDS_ON[groupId];
  if (!edges || edges.length === 0) return null;
  if (groupFinalized) return null;

  const unmet = edges.filter((e) => !satisfied.has(e.prereq));
  if (unmet.length === 0) return { status: 'ready' };

  // Loudest first (H before s), preserving declaration order within a band.
  const top =
    unmet.find((e) => e.prominence === 'H') ?? unmet[0];
  if (!top) return { status: 'ready' }; // unreachable (unmet is non-empty)

  const label =
    labelFor?.(top.prereq) ?? DEPENDENCY_NODE_LABEL[top.prereq] ?? top.prereq;
  return {
    status: 'blocked',
    prereqId: top.prereq,
    prereqLabel: label,
    prominence: top.prominence,
  };
}
