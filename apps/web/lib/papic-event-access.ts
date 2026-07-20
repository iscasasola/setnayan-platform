/**
 * papic-event-access.ts — WHICH EVENT TYPES may be sold the flat, event-level
 * Papic guest-camera pass ("Papic Buong Araw" · SKU `PAPIC_GUEST`).
 *
 * Source: `Papic_Access_Scope_Council_Verdict_2026-07-20.md` § 2 ("Access
 * predicate to implement — do NOT hand-maintain an allow-list"), Phase-0 gate
 * **0h**. Before this module the pass had NO event-type predicate anywhere:
 * `platform_retail_catalog_v2` has no event-type column and `/papic/guest`
 * never read `events.event_type`, so every type was implicitly eligible.
 *
 * ── The axis ──────────────────────────────────────────────────────────────
 * The predicate is **who writes the guest roster**, because that is what
 * decides whether a named, consenting guest (RA 10173 § 12(a)/(b)) stands
 * behind every camera. It is NOT:
 *
 *   • `event_type_profiles.event_class` — that column is an OWNERSHIP axis
 *     ("may a community own this type?", migration
 *     `20270807254184_composable_event_foundation.sql:39-52`). It seeds
 *     `anniversary` as `community_eligible`, so a couple's 25th would sort
 *     with a corporation's 10th. Using it here would be the wrong question.
 *   • a life-vs-lifestyle helper — those sets deliberately exclude `wedding`,
 *     which is the single biggest allowed type.
 *
 * ── The rule ──────────────────────────────────────────────────────────────
 *   Phase 1  surfaceEnabled(profile,'rsvp')
 *            AND type ∈ {wedding, debut, birthday, christening,
 *                        gender_reveal, graduation}
 *            OR  (type = 'anniversary' AND community_id IS NULL)
 *   Phase 2  + reunion, celebration, gala_night,
 *              anniversary (community_id IS NOT NULL)   [self-join hardening]
 *   Phase 3  + corporate, tournament                    [CSAM matcher, DPA]
 *   Denied   travel — always, in V1 (explicit; see PAPIC_ACCESS_DENIED_TYPES)
 *
 * PURE + SYNCHRONOUS on purpose: one helper, no I/O, so every surface (Studio
 * hub, the guest camera page, checkout) can share the exact same decision
 * instead of re-deriving a per-surface allow-list. Callers supply the already
 * resolved profile (`resolveProfileByEvent`) and `events.community_id`.
 */
import { surfaceEnabled, type EventTypeProfile } from './event-type-profile';

export type PapicAccessPhase = 1 | 2 | 3;

/**
 * The phase that is LIVE today. Phase 1 only — Phases 2 and 3 each carry their
 * own blocking gates (self-join hardening; CSAM known-hash matcher + an NPC
 * Circular 16-02 processor agreement), so bumping this constant is an
 * owner/DPO decision, never a drive-by edit.
 */
export const PAPIC_ACCESS_CURRENT_PHASE: PapicAccessPhase = 1;

/**
 * Closed-roster personal types — the host writes the guest list and a natural
 * person is the answerable controller. `anniversary` is deliberately ABSENT:
 * it is the one type that splits by controller, not by type, and is resolved
 * from `events.community_id` in `phaseForType()`.
 */
export const PAPIC_ACCESS_PHASE_1_TYPES = [
  'wedding',
  'debut',
  'birthday',
  'christening',
  'gender_reveal',
  'graduation',
] as const;

/** Roster-backed group types — poster-QR self-join is the primary entry path. */
export const PAPIC_ACCESS_PHASE_2_TYPES = [
  'reunion',
  'celebration',
  'gala_night',
] as const;

/** Open-crowd types — spectators/attendees are never RSVP'd. */
export const PAPIC_ACCESS_PHASE_3_TYPES = ['corporate', 'tournament'] as const;

/**
 * EXPLICIT DENY — never eligible in V1, at any phase.
 *
 * `travel` is `layer_mode='roaming'` + `multi_day=TRUE`
 * (`20270807254184_composable_event_foundation.sql:37-44`), so a pass metered
 * "per event-day" is structurally the wrong unit, and a roaming trip has the
 * maximal bystander density of any type. It must be listed HERE rather than
 * left to `surfaceEnabled` because migration
 * `20270804110223_unlock_nonwedding_guest_surfaces.sql` added `rsvp` to EVERY
 * non-wedding profile row — travel's profile enables `rsvp` in prod today, so
 * the surface check alone would let it through and merchandise a fake door.
 */
export const PAPIC_ACCESS_DENIED_TYPES = ['travel'] as const;

export type PapicAccessDenyReason =
  /** Type is on the permanent V1 deny list (travel). */
  | 'type_denied_v1'
  /** The type's profile has no `rsvp` surface ⇒ no guest identity to consent. */
  | 'no_rsvp_surface'
  /** Known type, but its phase has not shipped yet. */
  | 'phase_not_reached'
  /** Type is in no phase set at all (e.g. simple_event, or a future type). */
  | 'type_out_of_scope';

export type PapicAccessDecision =
  | { allowed: true; phase: PapicAccessPhase }
  | {
      allowed: false;
      /** The phase this type WOULD unlock at, when that is knowable. */
      phase: PapicAccessPhase | null;
      reason: PapicAccessDenyReason;
    };

export type PapicAccessInput = {
  /** Resolved event-type profile — `resolveProfileByEvent(eventId)`. */
  profile: EventTypeProfile;
  /** `events.community_id` — NULL for a personal event. Only splits anniversary. */
  communityId?: string | null;
  /** Override the shipped phase (tests + a future owner-gated flip). */
  phase?: PapicAccessPhase;
};

function includes(list: readonly string[], value: string): boolean {
  return list.includes(value);
}

/**
 * The phase at which a type becomes eligible, or `null` if it is in no phase.
 * `anniversary` splits on the controller: personally-owned (`community_id IS
 * NULL`) is Phase 1; Samahan-owned is Phase 2. This mirrors the shipped CHECK
 * `events_community_class_consistency`.
 */
function phaseForType(
  eventType: string,
  communityId: string | null | undefined,
): PapicAccessPhase | null {
  if (eventType === 'anniversary') return communityId == null ? 1 : 2;
  if (includes(PAPIC_ACCESS_PHASE_1_TYPES, eventType)) return 1;
  if (includes(PAPIC_ACCESS_PHASE_2_TYPES, eventType)) return 2;
  if (includes(PAPIC_ACCESS_PHASE_3_TYPES, eventType)) return 3;
  return null;
}

/**
 * THE predicate. Every Papic Buong Araw surface must call this — do not
 * re-derive a per-surface allow-list.
 */
export function papicGuestPassAccess(input: PapicAccessInput): PapicAccessDecision {
  const { profile, communityId = null, phase = PAPIC_ACCESS_CURRENT_PHASE } = input;
  const eventType = profile.eventType;

  // 1) Permanent deny first — travel's profile DOES enable `rsvp` in prod, so
  //    this must not be left to the surface check below.
  if (includes(PAPIC_ACCESS_DENIED_TYPES, eventType)) {
    return { allowed: false, phase: null, reason: 'type_denied_v1' };
  }

  // 2) No RSVP surface ⇒ no guest roster ⇒ no named, consenting subject. This
  //    is how `simple_event` is excluded — for the right reason, not by name.
  if (!surfaceEnabled(profile, 'rsvp')) {
    return { allowed: false, phase: null, reason: 'no_rsvp_surface' };
  }

  // 3) Positive scope. A type in NO phase set is denied (fail-closed): a new
  //    event type does not inherit the pass by simply having an RSVP surface.
  const typePhase = phaseForType(eventType, communityId);
  if (typePhase === null) {
    return { allowed: false, phase: null, reason: 'type_out_of_scope' };
  }

  if (typePhase > phase) {
    return { allowed: false, phase: typePhase, reason: 'phase_not_reached' };
  }

  return { allowed: true, phase: typePhase };
}

/** Boolean convenience over `papicGuestPassAccess`. */
export function papicGuestPassAllowed(input: PapicAccessInput): boolean {
  return papicGuestPassAccess(input).allowed;
}
