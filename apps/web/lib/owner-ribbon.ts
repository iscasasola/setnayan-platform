/**
 * Owner-layer ribbon model (owner-locked 2026-07-26 role-surface model).
 *
 * PR #3764 shipped `resolveOwnerCapability` — THE owner gate, server-side, on a
 * real `event_members` / `event_moderators` row — and deliberately left it
 * inert. This module is the first thing to consume it: the pure model behind
 * the owner ribbon that mounts above the guest site.
 *
 * WHY A PURE MODULE AND NOT JUST JSX. Two of the ribbon's three jobs are
 * decisions, not markup — "may this viewer see the ribbon at all?" and "which
 * lifecycle phase is the page actually showing right now?". Both are worth
 * pinning in tests, and neither is testable inside a server component. So the
 * component becomes a thin renderer over `buildOwnerRibbon()` and every rule
 * lives here, where `lib/owner-ribbon.test.ts` can hold it down.
 *
 * THE GATE IS THE CAPABILITY, AND ONLY THE CAPABILITY. `buildOwnerRibbon`
 * returns `null` for a null capability, and the component renders nothing for a
 * null model. There is no second, weaker "is this maybe the host?" signal
 * anywhere on this path — no query param, no cookie, no prop a client could
 * set. The one extra denial below (`ownerEventId` must equal the event being
 * rendered) is STRICTER, not looser: it re-states the capability's own
 * event-binding contract at the point of use, so a capability resolved for
 * event A can never light up the ribbon on event B.
 *
 * READ-ONLY BY CONSTRUCTION. Everything here produces `href` strings. The
 * ribbon writes nothing, posts nothing, and mutates nothing.
 */
import { viewerIsEventHost } from '@/app/[slug]/_lib/site-identity';
import type { OwnerCapability } from '@/app/[slug]/_lib/site-identity';
import type { LifecyclePhase } from '@/lib/invitation-widgets';

/**
 * The four lifecycle phases, in the order the site lives through them — the
 * same order (and the same literal values) `page.tsx` accepts on `?phase=`.
 * `satisfies` keeps this list honest against `LifecyclePhase`: adding a phase
 * to the union without adding it here is fine, but putting a NON-phase here
 * fails `tsc`.
 */
export const OWNER_RIBBON_PHASES = [
  'save_the_date',
  'rsvp',
  'event',
  'editorial',
] as const satisfies readonly LifecyclePhase[];

/** Short human labels for the phase links. Deliberately terse — this is a
 *  discreet ribbon, not a nav bar. */
const PHASE_LABELS: Record<LifecyclePhase, string> = {
  save_the_date: 'Save the Date',
  rsvp: 'Invitation',
  event: 'On the day',
  editorial: 'After',
};

export type OwnerRibbonPhaseLink = {
  phase: LifecyclePhase;
  label: string;
  /** `/[slug]?phase=<phase>` — a link the host can ALREADY follow today
   *  (page.tsx authorises `?phase=` on host membership); the ribbon only makes
   *  it discoverable. */
  href: string;
  /** True for the phase the page actually rendered — including when `?phase=`
   *  overrode the date-derived one, because the caller passes the SAME
   *  `lifecyclePhase` value the body was built from. */
  active: boolean;
};

export type OwnerRibbonModel = {
  /** Back to the planning surface. `/dashboard/[eventId]` stays the place where
   *  editing happens; the ribbon is the doorway to it (repo wayfinding rule:
   *  a page ships with its doorway).
   *
   *  🔴 IT IS NOT ALWAYS THE EDITOR. This link went to `website/editor`
   *  unconditionally, and that route redirects anybody whose
   *  `event_members.member_type` is not `couple` — so a coordinator pressed
   *  "Edit this site" and was silently bounced. The doorway now goes where the
   *  viewer can actually go: the editor for the couple, their planning desk for
   *  every other host. A control that refuses the person it is shown to reads
   *  as a broken product, and REMOVING the only way out of the guest site would
   *  have been a second defect, not a fix. */
  editorHref: string;
  /** What the doorway says. Lives in the model, not the component, because
   *  which door it opens is a decision and every decision here is tested. */
  editorLabel: string;
  /**
   * The four phase-preview links, or an EMPTY array when the lifecycle engine
   * is off for this event (`phasesEnabled === false`). Empty rather than
   * disabled-looking chips, because with the engine off `?phase=` is a no-op:
   * page.tsx only honours the override when `phasesEnabled` is true, so
   * offering the links would promise a preview that cannot happen.
   */
  phaseLinks: OwnerRibbonPhaseLink[];
};

/**
 * Build the ribbon model, or `null` when no ribbon should exist.
 *
 * Returns null when:
 *   - `ownerCapability` is null — the ONLY visibility gate (no capability, no
 *     ribbon, for guests and anonymous visitors alike);
 *   - the capability was resolved for a different event than the one being
 *     rendered (the stricter re-statement described in the module doc);
 *   - the event has no slug, so there is no `/[slug]` URL to link phases on.
 */
export function buildOwnerRibbon(input: {
  ownerCapability: OwnerCapability | null;
  /** The event this page is rendering — checked against the capability's own
   *  `ownerEventId`. */
  eventId: string;
  /** Public slug of the event (`events.slug`), or null. */
  slug: string | null;
  /** `phasesEnabled` exactly as page.tsx computed it. */
  phasesEnabled: boolean;
  /** The phase the page ACTUALLY rendered — `phaseOverride ?? getLifecyclePhase(date)`. */
  lifecyclePhase: LifecyclePhase;
}): OwnerRibbonModel | null {
  const { ownerCapability, eventId, slug, phasesEnabled, lifecyclePhase } = input;
  // The first two refusals are ONE question — "is this viewer a verified host of
  // THIS event?" — and it is asked by the shared `viewerIsEventHost`, which the
  // host body copy in site-body.tsx also asks. Two copies of this rule is how
  // the ribbon and the body drift into disagreeing about the same person.
  if (!viewerIsEventHost(ownerCapability, eventId)) return null;
  // The slug refusal is NOT part of that question: it is this model's own
  // requirement (there is no `/[slug]` URL to build phase links on). Kept
  // separate for exactly that reason — see viewerIsEventHost's docblock.
  if (!slug) return null;

  const base = `/${encodeURIComponent(slug)}`;
  const dash = `/dashboard/${encodeURIComponent(eventId)}`;
  // Read off the capability the DATABASE minted, never off anything the request
  // carries. `maySiteEdit` is a stricter fact about a host already confirmed,
  // so an absent or false value can only ever send somebody to the planning
  // desk — a page the event layout already admits every host to.
  const maySiteEdit = ownerCapability?.maySiteEdit === true;
  return {
    editorHref: maySiteEdit ? `${dash}/website/editor` : dash,
    editorLabel: maySiteEdit ? 'Edit this site' : 'Open the planning desk',
    phaseLinks: phasesEnabled
      ? OWNER_RIBBON_PHASES.map((phase) => ({
          phase,
          label: PHASE_LABELS[phase],
          href: `${base}?phase=${phase}`,
          active: phase === lifecyclePhase,
        }))
      : [],
  };
}
