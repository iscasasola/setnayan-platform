/**
 * Wedding Essentials · the 7-card free DIY surface model.
 *
 * Owner directive 2026-05-29 in conversation closing CLAUDE.md "today's
 * focus is paid" reminder. Iterated across multiple turns to lock the
 * shape:
 *
 *   - Free DIY couples see 7 always-visible Wedding Essentials on the
 *     Today tab (the canonical free planning surface).
 *   - Paid Setnayan AI ₱1,499 couples see the full 65-card guided
 *     wizard substrate (WizardHero · iteration 0016 · CLAUDE.md
 *     2026-05-23 row 6).
 *   - The marketplace + Compare drawer + Lock flow is the SAME for
 *     both tiers — only the guided wizard intelligence (hard-floor
 *     scheduler · religion-adaptive copy · prereq enforcement ·
 *     coordinator-scheduled meetings) is gated behind ₱1,499.
 *
 * The 7 essentials reduce 65 wizard cards + 22 plan groups down to the
 * non-negotiable minimum for a Filipino wedding. Couples who want
 * comprehensive guidance upgrade to Setnayan AI · couples who want
 * simple planning use these 7.
 *
 * Two essential kinds:
 *
 *   - `vendor_pick` · maps to a PlanGroup · couple browses scoped
 *     marketplace → shortlists → compares → locks · 4 of the 7
 *     (ceremony_venue · reception_venue · officiant · catering).
 *
 *   - `attribute` · maps to a column or sub-route · couple fills in
 *     directly · 3 of the 7 (date · guest_list · marriage_license).
 *
 * WHY ceremony_venue + reception_venue are split (not combined): owner
 * directive at simplest-form turn locked "Venue" as ONE essential, but
 * the underlying PLAN_GROUPS keep them disjoint (per the PlanGroup spec
 * comments — combined-venue weddings add to both groups manually).
 * Showing them as ONE essential card with TWO status pills (Ceremony
 * locked · Reception 3 considering) honors the owner's mental model
 * without breaking the PlanGroup invariant. The Wedding Essentials hero
 * renders a single "Venue" card; under the hood it queries both
 * PlanGroups.
 *
 * WHY budget is NOT in the 7 (despite owner explicit ask): the conversation
 * locked 7 essentials initially including budget, then iterated. Re-reading
 * the locked list — Date · Venue · Budget · Guest list · Catering ·
 * Officiant · Marriage license — yes budget is in. Including it as the 4th
 * attribute essential.
 *
 * Final 7:
 *   1. date           · attribute · events.event_date
 *   2. venue          · vendor_pick (combined) · PlanGroup ceremony_venue + reception_venue
 *   3. budget         · attribute · events.estimated_budget_centavos
 *   4. guest_list     · attribute · /dashboard/[eventId]/guests
 *   5. catering       · vendor_pick · PlanGroup catering
 *   6. officiant      · vendor_pick · PlanGroup officiant
 *   7. marriage_license · attribute · /dashboard/[eventId]/documents
 *
 * NOT in scope this PR (queued post-pilot):
 *   - "+ Add category" picker — couples opt-in to additional categories
 *     beyond the 7 essentials. Schema (events.tracked_categories) ships
 *     this PR · UI ships next.
 *   - Dismissed-categories list for explicit opt-outs + hard-floor nudge
 *     surface that bypasses dismissals when T-Nmo floor approaches.
 *   - Plan grid filter by tracked_categories (DIY couples see only
 *     tracked + essentials). Free DIY couples currently see all 22
 *     PlanGroups in the grid until the filter ships.
 */

import type { PlanGroupId } from './wedding-plan-groups';

/**
 * The 7 essential surfaces a Filipino wedding cannot skip.
 *
 * Order is the rendering order on the Wedding Essentials hero (Date
 * first because it anchors every other floor · Marriage license last
 * because it's the legal track that runs in parallel).
 */
export type WeddingEssentialId =
  | 'date'
  | 'venue'
  | 'budget'
  | 'guest_list'
  | 'catering'
  | 'officiant'
  | 'marriage_license';

/**
 * What kind of action the essential card surfaces.
 */
export type WeddingEssentialKind =
  /** Vendor-pick · scoped marketplace → shortlist → compare → lock. */
  | 'vendor_pick'
  /** Attribute · couple fills in inline OR via a sub-route. */
  | 'attribute';

/**
 * One Wedding Essential card definition.
 */
export type WeddingEssential = {
  id: WeddingEssentialId;
  kind: WeddingEssentialKind;
  /** Display title rendered as the card H3. */
  label: string;
  /** Brand-voice one-line copy under the title (Filipino-aware, no jargon). */
  hint: string;
  /**
   * For `vendor_pick` essentials: PlanGroupIds that the card bucket-receives
   * from. Single PlanGroup for most · the `venue` essential is the only
   * 2-PlanGroup essential (ceremony_venue + reception_venue rolled into
   * one couple-facing card).
   *
   * For `attribute` essentials: empty array · the card reads from event
   * columns or sub-routes.
   */
  planGroups: ReadonlyArray<PlanGroupId>;
  /**
   * Where the primary CTA navigates.
   *
   * For `vendor_pick` essentials: the scoped marketplace URL (e.g.
   * `/explore?folder=reception`). When the card has 2 planGroups (venue),
   * the marketplace URL points at the combined ceremony+reception folder
   * landing — couples pick which side they're shopping for there.
   *
   * For `attribute` essentials: the sub-route or in-card form anchor.
   */
  primaryHref: (eventId: string) => string;
  /**
   * Label for the primary CTA. Short, action-shaped, brand-voice editorial
   * register.
   */
  primaryCtaLabel: string;
  /**
   * Months before the wedding date this essential should be locked by.
   * Drives the urgency hint copy ("Most couples lock this 9 months out").
   *
   * NOT a hard floor — hard-floor scheduler is paid Setnayan AI only.
   * This is just the soft "when most couples handle it" guidance for the
   * DIY tier. The simplest signal we can give without the full scheduler.
   */
  softMonthsBefore: number;
};

/**
 * The 7 canonical Wedding Essentials in rendering order.
 *
 * Date first — every floor depends on it. Marriage license last — it's
 * the parallel legal track that doesn't gate the event itself, so couples
 * can think about it after they've nailed the event-shaping decisions.
 */
export const WEDDING_ESSENTIALS: ReadonlyArray<WeddingEssential> = [
  {
    id: 'date',
    kind: 'attribute',
    label: 'Wedding date',
    hint: 'Pick your date. Everything else anchors here.',
    planGroups: [],
    primaryHref: (eventId) => `/dashboard/${eventId}/settings`,
    primaryCtaLabel: 'Set date',
    softMonthsBefore: 12,
  },
  {
    id: 'venue',
    kind: 'vendor_pick',
    label: 'Venue',
    hint: 'Where you say I do + where you celebrate. Often two different places.',
    planGroups: ['ceremony_venue', 'reception_venue'],
    primaryHref: (_eventId) => `/explore?folder=reception`,
    primaryCtaLabel: 'Browse venues',
    softMonthsBefore: 12,
  },
  {
    id: 'budget',
    kind: 'attribute',
    label: 'Budget',
    hint: 'Set the ceiling. Every vendor pick reads against it.',
    planGroups: [],
    primaryHref: (eventId) => `/dashboard/${eventId}/budget`,
    primaryCtaLabel: 'Set budget',
    softMonthsBefore: 12,
  },
  {
    id: 'guest_list',
    kind: 'attribute',
    label: 'Guest list',
    hint: 'Who you want there. Locks headcount for catering and seating.',
    planGroups: [],
    primaryHref: (eventId) => `/dashboard/${eventId}/guests`,
    primaryCtaLabel: 'Add guests',
    softMonthsBefore: 9,
  },
  {
    id: 'catering',
    kind: 'vendor_pick',
    label: 'Catering',
    hint: 'Food + service. Tastings happen 4-6 months out; book the team earlier.',
    planGroups: ['catering'],
    primaryHref: (_eventId) => `/explore?folder=catering`,
    primaryCtaLabel: 'Browse caterers',
    softMonthsBefore: 9,
  },
  {
    id: 'officiant',
    kind: 'vendor_pick',
    label: 'Officiant',
    hint: 'Priest, pastor, or judge. Civil ceremonies need them booked early too.',
    planGroups: ['officiant'],
    primaryHref: (_eventId) => `/explore?folder=ceremony`,
    primaryCtaLabel: 'Browse officiants',
    softMonthsBefore: 9,
  },
  {
    id: 'marriage_license',
    kind: 'attribute',
    label: 'Marriage license',
    hint: 'CENOMAR, paperwork, and the license itself. 120-day validity — start early.',
    planGroups: [],
    primaryHref: (eventId) => `/dashboard/${eventId}/documents`,
    primaryCtaLabel: 'Open paperwork',
    softMonthsBefore: 4,
  },
];

/**
 * Lookup helper · returns the essential definition for a given id, or
 * undefined if the id doesn't match the canonical 7.
 */
export function getWeddingEssential(
  id: WeddingEssentialId,
): WeddingEssential | undefined {
  return WEDDING_ESSENTIALS.find((e) => e.id === id);
}

/**
 * The 4 vendor-pick PlanGroupIds that map into Wedding Essentials.
 *
 * Used as the default value for `events.tracked_categories` per migration
 * 20260706000000 · couples on Free DIY tier start with these 4 PlanGroups
 * automatically tracked, can opt in to more via "+ Add category" (queued
 * post-pilot).
 */
export const ESSENTIAL_PLAN_GROUP_IDS: ReadonlyArray<PlanGroupId> = [
  'ceremony_venue',
  'reception_venue',
  'officiant',
  'catering',
];

/**
 * Returns true if a PlanGroupId is part of the Wedding Essentials default
 * set · used to render the "essential" badge on plan grid cards even
 * when the host is on the paid Setnayan AI tier (so they can see which
 * cells are the non-negotiable floor).
 */
export function isEssentialPlanGroup(planGroupId: PlanGroupId): boolean {
  return ESSENTIAL_PLAN_GROUP_IDS.includes(planGroupId);
}
