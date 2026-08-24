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
 * The predicate WAS "who writes the guest roster", because that is what decides
 * whether a named, consenting guest (RA 10173 § 12(a)/(b)) stands behind every
 * camera. On 2026-08-01 the OWNER collapsed that axis to a single rule — "Drop
 * the travel exclusion — offer Papic everywhere" — so the type ladder no longer
 * narrows anything and **`surfaceEnabled(profile,'rsvp')` is the only gate with
 * teeth today.** See PAPIC_ACCESS_PHASE_1_TYPES for the full record.
 *
 * The two axes that were rejected for this job stay rejected, because they would
 * be the wrong question if the ladder is ever re-tiered:
 *
 *   • `event_type_profiles.event_class` — that column is an OWNERSHIP axis
 *     ("may a community own this type?", migration
 *     `20270807254184_composable_event_foundation.sql:39-52`). It seeds
 *     `anniversary` as `community_eligible`, so a couple's 25th would sort
 *     with a corporation's 10th. Using it here would be the wrong question.
 *   • a life-vs-lifestyle helper — those sets deliberately exclude `wedding`,
 *     which is the single biggest allowed type.
 *
 * ── The rule (since 2026-08-01) ────────────────────────────────────────────
 *   Phase 1  surfaceEnabled(profile,'rsvp')
 *            AND type ∈ PAPIC_ACCESS_PHASE_1_TYPES  — ALL 16 live types
 *   Phase 2  (empty)
 *   Phase 3  (empty)
 *
 * All 16 rows of `public.event_type_vocab` are `status='active' AND
 * enabled=true`, and all 16 `event_type_profiles` rows carry `rsvp` (verified
 * against prod 2026-08-01), so every type the product can create is offered
 * Papic. A SEVENTEENTH type still fails closed — see `phaseForType()`.
 *
 * There is NO deny list. See PAPIC_ACCESS_PHASE_1_TYPES.
 *
 * PURE + SYNCHRONOUS on purpose: one helper, no I/O, so every surface (Studio
 * hub, the guest camera page, checkout) can share the exact same decision
 * instead of re-deriving a per-surface allow-list. Callers supply the already
 * resolved profile (`resolveProfileByEvent`) and `events.community_id`.
 */
import { surfaceEnabled, type EventTypeProfile } from './event-type-profile';

export type PapicAccessPhase = 1 | 2 | 3;

/**
 * The phase that is LIVE today. Still 1 — but since 2026-08-01 every live type
 * sits in Phase 1, so this constant no longer narrows anything. It is kept as
 * the re-tiering mechanism: if a type ever has to be pulled back behind a
 * compliance gate, it moves to PHASE_2/PHASE_3 and this stays at 1.
 */
export const PAPIC_ACCESS_CURRENT_PHASE: PapicAccessPhase = 1;

/**
 * EVERY live event type. All 16 rows of `event_type_vocab`, in roster order
 * after the six original closed-roster types.
 *
 * ⚠ THE ONLY WAY TO ADD A TYPE HERE IS TO ADD IT TO THE PRODUCT. A brand-new
 * type is NOT admitted automatically — `phaseForType()` still fails closed —
 * and `papic-event-access.test.ts` fails if a type known to the code roster
 * (`ANCHOR_BY_TYPE` / `AI_TIER_BY_EVENT_TYPE`) is missing from this list.
 */
export const PAPIC_ACCESS_PHASE_1_TYPES = [
  'wedding',
  'debut',
  'birthday',
  'christening',
  'gender_reveal',
  'graduation',
  // `simple_event` — added 2026-07-31. It satisfies the axis this predicate is
  // built on: the HOST writes the roster (role set 'simple', a single flat
  // 'guest'), its profile enables `rsvp` in prod, and it is single-day and
  // anchored, so a pass metered per event-day is the right unit.
  //
  // It is here because the product already sells the pool there and has since
  // 2026-07-27: `commitSimpleEvent` arms the free 50-pt pool grant at create,
  // and the onboarding services card prints all three paid Pool rungs on this
  // exact type. Leaving it out of the phase set while wiring the gate into
  // Suite would not have been "failing closed" — it would have retracted a
  // live, owner-locked offer ("Papic on ALL 16 event types", 2026-07-27) from
  // the one type whose entire purpose is to exercise the in-app services.
  'simple_event',
  // `travel` — added 2026-08-01 by OWNER DECISION: "Drop the travel exclusion —
  // offer Papic everywhere."
  //
  // ⚠ DO NOT "restore" this as a bug fix. Until this date `travel` sat on an
  // explicit deny list (`PAPIC_ACCESS_DENIED_TYPES`, now deleted) on the
  // reasoning that a roaming, multi-day trip has the maximal bystander density
  // of any type and that a pass metered per event-day is the wrong unit for it.
  // The owner was shown that reasoning and overrode it. It also aligns the
  // predicate with the older standing lock "Papic on ALL 16 event types"
  // (2026-07-27), which the deny list had been contradicting.
  //
  // Placed in PHASE 1 because Phase 1 is the only phase live today
  // (PAPIC_ACCESS_CURRENT_PHASE) — anywhere else would still read as "denied".
  //
  // KNOWN FOLLOW-UP, deliberately NOT changed here: travel is the only allowed
  // type with `multi_day=TRUE` + `layer_mode='roaming'`, so the per-event-day
  // metering unit is a real open question. This PR changes ELIGIBILITY only —
  // pricing, entitlements and the free-grant paths are untouched. The separate
  // multi-day capture-window model (`lib/papic-window.ts` `isTravelEventType`)
  // already handles travel and is unaffected.
  'travel',

  // ─────────────────────────────────────────────────────────────────────────
  // THE REMAINING EIGHT — added 2026-08-01, SAME OWNER DECISION as `travel`:
  // "Drop the travel exclusion — offer Papic everywhere."
  //
  // ⚠ DO NOT "restore" any of these exclusions as a bug fix. Read this block
  //   and `DECISION_LOG.md` 2026-08-01 first. Dropping `travel` alone did NOT
  //   make "everywhere" true — travel was the only type on a DENY LIST, but
  //   eight more were denied by the LADDER and by a hardcoded controller split,
  //   which is a different mechanism and was easy to miss:
  //
  //     • `date`, `hangout` — in no phase set at all, so they hit the
  //       fail-closed default and returned `type_out_of_scope`.
  //     • `reunion`, `celebration`, `gala_night` — Phase 2, i.e.
  //       `phase_not_reached` while PAPIC_ACCESS_CURRENT_PHASE = 1.
  //     • `corporate`, `tournament` — Phase 3, likewise unreachable.
  //     • `anniversary` — Phase 1 ONLY when personally owned. Samahan-owned
  //       (`community_id IS NOT NULL`) was Phase 2 via a hardcoded early return
  //       in `phaseForType()` that ran BEFORE this list, so adding the type
  //       here would have changed nothing on its own. That split is gone; see
  //       `phaseForType()`.
  //
  // WHAT THIS COSTS, stated plainly rather than deleted with the code — the
  // phase ladder was a COMPLIANCE ladder, and its preconditions were NOT met
  // when the owner widened access:
  //
  //   Phase 2 (reunion · celebration · gala_night · Samahan anniversary) was
  //   gated on SELF-JOIN HARDENING, because poster-QR self-join — not a
  //   host-written roster — is the primary entry path for group types. Nobody
  //   writes down who is in the room.
  //
  //   Phase 3 (corporate · tournament) was gated on a CSAM known-hash matcher
  //   and an NPC Circular 16-02 processor agreement, because spectators and
  //   attendees at an open-crowd event are never RSVP'd and never consented.
  //
  //   `date` and `hangout` were never tiered at all — nobody had asked whether
  //   a two-person outing has a "guest roster" in the RA 10173 sense.
  //
  // These are now OPEN COMPLIANCE ITEMS on a shipping product, not blockers, in
  // line with the standing "document, don't block" default — the same posture
  // as verdict gates 0d/0e (guest-media ROPA row + DPO sign-off on the RSVP
  // consent text), which are likewise open while the pool sells. Escalated to
  // the owner/DPO in the PR that made this change; recorded here so the next
  // reader finds the debt attached to the code that incurred it.
  //
  // Source: `Papic_Access_Scope_Council_Verdict_2026-07-20.md` § 2, Phase-0
  // gate 0h — superseded on the TYPE AXIS ONLY. Its `rsvp` requirement below
  // still stands and is the last live gate.
  //
  // ELIGIBILITY ONLY. No pricing, entitlement, metering, pool size or
  // free-grant path is touched by this change; this widens WHO MAY BUY.
  'anniversary',
  'reunion',
  'celebration',
  'gala_night',
  'corporate',
  'tournament',
  'date',
  'hangout',
  // `funeral` — added 2026-08-24 with the type itself (W4-WORDS), following
  // the standing owner ruling above: "offer Papic everywhere." The type
  // arrived AFTER that ruling, so it landed on the fail-closed default and
  // this line is the deliberate edit that default exists to force. It also
  // fits the wake in substance, not just by rule — visitors' photographs of
  // the vigil nights landing in one family gallery is remembrance, and the
  // funeral profile enables `rsvp`, the last live gate below. The guest-tree
  // surfaces it renders on speak the solemn register. If the owner wants
  // wakes excluded from the camera, this one line is the whole change.
  'funeral',
] as const;

/**
 * EMPTY since 2026-08-01 — `reunion` · `celebration` · `gala_night` were moved
 * into Phase 1 by the owner's "offer Papic everywhere" ruling. Kept as the
 * re-tiering mechanism (and so the self-join-hardening gate that used to live
 * here stays greppable), not emptied by accident.
 */
export const PAPIC_ACCESS_PHASE_2_TYPES: readonly string[] = [];

/**
 * EMPTY since 2026-08-01 — `corporate` · `tournament` were moved into Phase 1
 * by the same ruling. The CSAM known-hash matcher + NPC Circular 16-02
 * processor agreement this tier was waiting on remain OPEN; they are now
 * tracked as compliance debt rather than as an access gate.
 */
export const PAPIC_ACCESS_PHASE_3_TYPES: readonly string[] = [];

/**
 * There is deliberately NO deny list.
 *
 * `PAPIC_ACCESS_DENIED_TYPES = ['travel']` lived here until 2026-08-01, when the
 * owner ruled: "Drop the travel exclusion — offer Papic everywhere." Travel now
 * sits in PAPIC_ACCESS_PHASE_1_TYPES like any other eligible type; the deny
 * mechanism is gone rather than emptied, so re-denying a type is a deliberate
 * act and not a one-word edit.
 */

export type PapicAccessDenyReason =
  /** The type's profile has no `rsvp` surface ⇒ no guest identity to consent.
   *  The ONLY reason that can fire for a live type since 2026-08-01, and only
   *  on a DEGRADED read (every prod profile row carries `rsvp`). */
  | 'no_rsvp_surface'
  /** Known type, but its phase has not shipped yet. Unreachable while Phases 2
   *  and 3 are empty; kept as the re-tiering mechanism. */
  | 'phase_not_reached'
  /** Type is in no phase set at all. Since 2026-08-01 this means a type NEWER
   *  than the owner's "everywhere" ruling — every one of the 16 live types is
   *  in Phase 1. */
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
 *
 * ⚠ THE ANNIVERSARY CONTROLLER SPLIT WAS REMOVED 2026-08-01. It read:
 *
 *     if (eventType === 'anniversary') return communityId == null ? 1 : 2;
 *
 * and it ran BEFORE the phase-set lookups, so a Samahan-owned anniversary
 * (`community_id IS NOT NULL`) was Phase 2 — denied — no matter what the lists
 * said. Adding `anniversary` to PAPIC_ACCESS_PHASE_1_TYPES without deleting
 * this line would have looked like a fix and changed nothing. The owner's
 * "offer Papic everywhere" leaves no controller carve-out, so the split is
 * gone and `communityId` is now unused by the ladder.
 *
 * `communityId` is deliberately KEPT in the signature and on PapicAccessInput:
 * both production callers already join `events.community_id` for it, the
 * controller distinction is real (CHECK `events_community_class_consistency`),
 * and it is the parameter any re-tiering would need back.
 */
function phaseForType(
  eventType: string,
  _communityId: string | null | undefined,
): PapicAccessPhase | null {
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

  // 1) No RSVP surface ⇒ no guest roster ⇒ no named, consenting subject.
  if (!surfaceEnabled(profile, 'rsvp')) {
    return { allowed: false, phase: null, reason: 'no_rsvp_surface' };
  }

  // 2) Positive scope. A type in NO phase set is denied (fail-closed): a new
  //    event type does not inherit the pass by simply having an RSVP surface.
  //
  //    ⚠ THIS NO LONGER DENIES ANY LIVE TYPE (2026-08-01) — all 16 are in
  //    PHASE_1. It is not dead code: it is what stops a SEVENTEENTH type,
  //    created from /admin/event-types with no code change at all, from
  //    inheriting a guest-camera pass nobody has scoped. Widening "everywhere"
  //    to a type that did not exist when the owner said it is a decision, not
  //    an inference.
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
