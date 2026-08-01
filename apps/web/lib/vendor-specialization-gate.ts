/**
 * Vendor SPECIALIZATION gate — the entitlement capability behind the owner's
 * 2026-07-26 lock:
 *
 *   "specializations work only if they are subscribed. if no subscription, stay
 *    as generic vendors."
 *
 * THE SHAPE OF THE RULE. The generic vendor kit is the FLOOR every vendor gets
 * — free, lapsed, unverified, any category. The per-category specializations are
 * the PAID layer on top: the song desk for a band / singer / orchestra, the
 * script-and-cues desk for a host / MC, the floor-command kit (live schedule
 * updater · event QR kit · find-my-seat scanner · requests inbox) for a
 * coordinator. An unsubscribed vendor in ANY category renders the generic kit
 * and nothing more.
 *
 * WHY A PURE MODULE. Same reason as `lib/owner-ribbon.ts`: the interesting part
 * is a DECISION, not markup, and a decision is only trustworthy if a test can
 * hold it down. Every rule lives here as a pure function over
 * (subscription state × category); the DB read lives next door in
 * `vendor-specialization-gate.server.ts`, and the eventual surfaces become thin
 * renderers over {@link resolveVendorSpecializationAccess}.
 *
 * DEGRADE TO THE GENERIC KIT, NEVER TO EMPTY — an explicit owner requirement. A
 * vendor whose subscription lapses MID-EVENT must not be handed a blank or
 * broken day-of console. So `genericKit` is typed as the literal `true`: there
 * is no value this module can return, on any path — no subscription, lapsed
 * subscription, unknown category, garbage input — that denies the generic kit.
 * A future edit that tries to would fail `tsc`.
 *
 * SERVER-SIDE ONLY. This is an entitlement, not a styling hint. Callers must
 * resolve it on the server from the vendor's live subscription row and gate the
 * DATA, not merely hide a tab — the single root cause of the 2026-07-26 security
 * review was treating the UI as the boundary.
 *
 * NO NEW SCHEMA. Subscription state is read from the existing
 * `vendor_profiles.tier_state` / `.tier_expires_at` columns (the same pair
 * `vendor-favorite-gate.ts`, `enterprise-vendor-gate.ts` and `api-vendor.ts`
 * already read); category comes from the existing `vendor_profiles.services[]`
 * canonical taxonomy keys. No table, no column, no migration.
 *
 * Kept free of `import 'server-only'` on purpose — exactly the
 * `vendor-favorite-gate.ts` precedent. Nothing here does I/O and no client is
 * constructed, so the module carries no secret and stays unit-testable under
 * `tsx --test`.
 */
import { isTierAtLeast, type VendorTier } from '@/lib/vendor-tier-caps';
import { MUSIC_CANONICALS } from '@/lib/songs';

/**
 * THE TIER FLOOR — OWNER-LOCKED 2026-07-27: **Solo and up**, i.e. ANY paid tier.
 *
 * The owner had already locked THAT specializations are subscription-gated;
 * this settles WHERE the floor sits. Asked "your cheapest paid plan, or only the
 * higher one?", the owner answered "solo and up". This constant is that ruling,
 * and it is the ONLY place the floor is expressed — every gate in the app
 * follows it.
 *
 * The reasoning behind the recommendation the owner accepted:
 *   • Specializations are what make a solo emcee or a small band USEFUL AT ALL.
 *     A host with no script/cues desk is not a lesser host desk — it is no host
 *     desk. Putting the floor at Pro would price the smallest operators out of
 *     the only tooling that fits their trade, which cuts against the locked
 *     "monetize ACCESS, not deals" posture.
 *   • Pro-and-up is already where cross-event INTELLIGENCE sits — Market Intel
 *     (Demand Radar + Price-Position) is Pro+ per the locked monetization matrix
 *     because it is derived from OTHER businesses' aggregate data. A
 *     specialization is own-trade tooling, not cross-business intelligence, so
 *     it belongs on the lower rung.
 *
 * To move it: change this one value to `'pro'`. Nothing else needs editing.
 */
export const SPECIALIZATION_MIN_TIER: VendorTier = 'solo';

/**
 * The specialization sets. Deliberately a SMALL closed union — these are the
 * three the owner named on 2026-07-26. A category that maps to none of them
 * gets the generic kit, which is a correct outcome and not a gap.
 */
export type VendorSpecializationSet = 'floor_command' | 'song_desk' | 'stage_script';

export type VendorSpecializationDef = {
  id: VendorSpecializationSet;
  /** Vendor-facing name. Brand voice, no jargon. */
  label: string;
  blurb: string;
  /**
   * Canonical taxonomy tiles (`lib/taxonomy.ts` · the keys stored in
   * `vendor_profiles.services[]`) whose vendors this set is FOR.
   */
  tiles: ReadonlySet<string>;
};

/**
 * The registry. **Array order IS the priority order** for a vendor who carries
 * tiles across several sets — the same deterministic-priority idiom as
 * `DAY_OF_FAMILY_ORDER` in `vendor-dayof-modules.ts`, and the same call it
 * made: a coordinator who also plays lands on the FLOOR-COMMAND kit (the
 * superset view of the day) rather than the song desk.
 */
export const VENDOR_SPECIALIZATIONS: readonly VendorSpecializationDef[] = [
  {
    id: 'floor_command',
    label: 'Run the floor',
    blurb:
      'Live schedule updater, the event QR kit, a find-my-seat scanner, and the requests inbox.',
    tiles: new Set(['coordinator']),
  },
  {
    id: 'song_desk',
    label: 'Song desk',
    blurb: 'Your repertoire against the couple’s requests, and the set you play on the day.',
    // Reused from lib/songs.ts — the SAME tile set that already decides who the
    // "Your repertoire" surface is for (live_band · choir · orchestra ·
    // wedding_singer · dj). Reused rather than re-listed so the two can never
    // drift into disagreeing about who counts as a music act.
    tiles: MUSIC_CANONICALS,
  },
  {
    id: 'stage_script',
    label: 'Script & cues',
    blurb: 'Your running script, the cue sheet, and where the cards sit on the night.',
    tiles: new Set(['host_mc']),
  },
];

/** Why a vendor is (or is not) holding their category's specializations. */
export type VendorSpecializationReason =
  /** Subscribed at or above the floor, and their category has a set. */
  | 'unlocked'
  /** Their category maps to no specialization set — generic kit is the whole kit. */
  | 'no_specialization_for_category'
  /** Free / verified / no subscription at all — below {@link SPECIALIZATION_MIN_TIER}. */
  | 'below_tier_floor'
  /** Paid tier on the row, but `tier_expires_at` has passed (the mid-event lapse). */
  | 'subscription_lapsed';

/**
 * The model. Small on purpose: it names the kit floor, what is unlocked, and
 * what WOULD be unlocked, and nothing else.
 */
export type VendorSpecializationAccess = {
  /**
   * ALWAYS granted. Typed as the literal `true`, not `boolean`, so the owner's
   * "never degrade to empty or error" requirement is enforced by the compiler
   * rather than by everyone remembering it.
   */
  genericKit: true;
  /**
   * The set this vendor actually holds right now, or `null` → generic kit only.
   * THIS is the entitlement. Gate data on this field.
   */
  unlockedSet: VendorSpecializationSet | null;
  /**
   * The set their category would give them if they subscribed — non-null even
   * while locked. Drives upsell copy ONLY; carries no entitlement whatsoever.
   * `null` means their category has no specializations to sell them.
   */
  eligibleSet: VendorSpecializationSet | null;
  /**
   * EVERY set this vendor holds, in registry order — `unlockedSet` is simply
   * its first element (or `null` when empty).
   *
   * ── WHY THIS EXISTS (owner concept, 2026-08-01) ──────────────────────────
   *
   * A supplier can genuinely be two trades at one wedding — a band that also
   * emcees, a stylist who also hosts. `unlockedSet` answers *"what is this
   * vendor?"*, which has one answer; the true question on the day is *"what is
   * this person doing right now?"*, because the company sends two people or one
   * person changes hats at 6pm. Collapsing to one made the second trade's desk
   * permanently unreachable — a band that emcees could never open the script.
   *
   * ⚠ ADDITIVE ONLY. Nothing reads this yet, and `unlockedSet` keeps its exact
   * meaning, so no surface widens by accident. **Widening who can reach a paid
   * desk must be one visible, reviewed flip per call site — never a side effect
   * of a refactor.** Use {@link holdsAnySpecialization} at a call site you have
   * deliberately decided to open up.
   */
  unlockedSets: readonly VendorSpecializationSet[];
  /** Every set their category WOULD give them. Upsell copy only, no entitlement. */
  eligibleSets: readonly VendorSpecializationSet[];
  reason: VendorSpecializationReason;
};

/**
 * The CATEGORY half: which specialization set does this vendor's category map
 * to, ignoring subscription entirely? `null` for a category with no set —
 * including an unknown, misspelled, retired, or empty one, which is why this
 * never throws.
 *
 * `eventTiles`, when provided, narrows the vendor's tiles to the ones actually
 * booked on THIS event — the same narrowing `resolveDayOfFamily` does, so a
 * multi-category vendor booked only as coordinator gets the floor-command set,
 * not their band's song desk.
 */
export function specializationSetForServices(
  services: readonly string[] | null | undefined,
  eventTiles?: readonly string[] | null,
): VendorSpecializationSet | null {
  return specializationSetsForServices(services, eventTiles)[0] ?? null;
}

/**
 * EVERY set this vendor's tiles map to, in registry order — the plural of
 * {@link specializationSetForServices}, which is now simply its first element.
 *
 * A supplier who is both a band and an emcee genuinely holds two; the singular
 * form answers "which one wins" and was the only thing on offer, which made the
 * second trade's desk unreachable. This returns both and lets the CALLER decide
 * — a picker on the day, a priority default everywhere else.
 *
 * `eventTiles` narrows to what they were actually booked for on THIS event, so a
 * multi-trade supplier booked purely as coordinator still holds exactly one.
 * Absent and empty both mean "the event can't say" and neither may narrow — an
 * empty array is truthy, and treating it as a narrowing set would exclude every
 * tile and silently return nothing.
 *
 * Never throws: an unknown, misspelled, retired or empty tile simply matches no
 * set.
 */
export function specializationSetsForServices(
  services: readonly string[] | null | undefined,
  eventTiles?: readonly string[] | null,
): VendorSpecializationSet[] {
  const eventSet = eventTiles && eventTiles.length > 0 ? new Set(eventTiles) : null;
  const owned = new Set<string>();
  for (const s of services ?? []) {
    if (typeof s !== 'string') continue;
    if (eventSet && !eventSet.has(s)) continue;
    owned.add(s);
  }
  if (owned.size === 0) return [];

  // Registry order is the priority order, so iterating the registry (rather
  // than the vendor's tiles) makes the result deterministic regardless of how
  // `services` happens to be ordered in the row.
  const out: VendorSpecializationSet[] = [];
  for (const def of VENDOR_SPECIALIZATIONS) {
    for (const tile of owned) {
      if (def.tiles.has(tile)) {
        out.push(def.id);
        break;
      }
    }
  }
  return out;
}

/**
 * The vendor's live subscription state — EXACTLY the two existing
 * `vendor_profiles` columns, no more. Structurally identical to
 * `VendorSubRow` in `vendor-favorite-gate.ts`, so a caller that already read
 * that row for favorites can feed the very same object here without a second
 * query.
 */
export type VendorSubscriptionState = {
  tier_state: string | null;
  tier_expires_at: string | null;
};

/**
 * The SUBSCRIPTION half: does this vendor clear the floor as of `now`?
 *
 * `tier_expires_at` is checked EXPLICITLY — the same reasoning as
 * `vendor-favorite-gate.ts` and `enterprise-vendor-gate.ts`: lapse is
 * login-driven (`sweep_vendor_tier_expiry` runs on the vendor's next dashboard
 * visit), so a past-due vendor can still be carrying a paid `tier_state` with an
 * elapsed expiry. A NULL expiry means never expires (admin-granted /
 * off-platform comp tier / an active free-window promotion).
 *
 * `minTier` defaults to {@link SPECIALIZATION_MIN_TIER} — the production path
 * never passes it. It exists so the test suite can prove the constant genuinely
 * drives the outcome by moving the floor and asserting the flip.
 *
 * An UNPARSEABLE `tier_expires_at` reads as "no expiry" rather than "lapsed".
 * This diverges deliberately from the bare `new Date(x).getTime() > now` in the
 * three sibling gates: there, a NaN silently means deny. Here, denying on a
 * malformed timestamp would strip a PAYING vendor's specializations because of a
 * data-format bug, which is the exact failure the owner's degrade requirement is
 * aimed at. A bad timestamp is a data bug, not evidence of non-payment.
 */
export function subscriptionClearsSpecializationFloor(
  subscription: VendorSubscriptionState | null | undefined,
  now: number = Date.now(),
  minTier: VendorTier = SPECIALIZATION_MIN_TIER,
): boolean {
  if (!subscription) return false;
  if (!isTierAtLeast(subscription.tier_state, minTier)) return false;
  return !subscriptionHasLapsed(subscription, now);
}

/** True when a paid `tier_state` is carrying an elapsed `tier_expires_at`. */
function subscriptionHasLapsed(
  subscription: VendorSubscriptionState,
  now: number,
): boolean {
  if (!subscription.tier_expires_at) return false;
  const expiry = new Date(subscription.tier_expires_at).getTime();
  if (Number.isNaN(expiry)) return false; // malformed → treat as no expiry
  return expiry <= now;
}

/**
 * THE GATE. Given a vendor's live subscription state and their category, does
 * this vendor get their category's specializations?
 *
 * Returns a model, never a throw and never a null: the generic kit is granted on
 * every path, including a null subscription, a lapsed one, an unknown category,
 * and an empty services array.
 */
export function resolveVendorSpecializationAccess(input: {
  /** The live `vendor_profiles` row (tier_state + tier_expires_at), or null when
   *  the vendor has no subscription state at all. */
  subscription: VendorSubscriptionState | null | undefined;
  /** The vendor's canonical taxonomy tiles — `vendor_profiles.services[]`. */
  services: readonly string[] | null | undefined;
  /** Optional: narrow to the tiles actually booked on this event. */
  eventTiles?: readonly string[] | null;
  now?: number;
  /** Test-only floor override — see {@link subscriptionClearsSpecializationFloor}. */
  minTier?: VendorTier;
}): VendorSpecializationAccess {
  const { subscription, services, eventTiles, now, minTier } = input;
  // Resolve the PLURAL once; the singular is its priority winner. Computing it
  // this way means the two can never disagree about who is eligible.
  const eligibleSets = specializationSetsForServices(services, eventTiles ?? null);
  const eligibleSet = eligibleSets[0] ?? null;

  // Category first: with no set to unlock, subscription state is irrelevant and
  // there is nothing to upsell. Generic kit is the whole kit.
  if (!eligibleSet) {
    return {
      genericKit: true,
      unlockedSet: null,
      eligibleSet: null,
      unlockedSets: [],
      eligibleSets: [],
      reason: 'no_specialization_for_category',
    };
  }

  if (subscriptionClearsSpecializationFloor(subscription, now, minTier)) {
    return {
      genericKit: true,
      unlockedSet: eligibleSet,
      eligibleSet,
      // Subscription is a per-VENDOR floor, not per-set: clearing it unlocks
      // every set their tiles map to, not just the priority winner.
      unlockedSets: eligibleSets,
      eligibleSets,
      reason: 'unlocked',
    };
  }

  // Locked — but still eligible, so the surface can offer the upgrade. Separate
  // the two denial reasons so a lapsed subscriber sees "renew" and a free vendor
  // sees "subscribe".
  const lapsed =
    !!subscription &&
    isTierAtLeast(subscription.tier_state, minTier ?? SPECIALIZATION_MIN_TIER) &&
    subscriptionHasLapsed(subscription, now ?? Date.now());

  return {
    genericKit: true,
    unlockedSet: null,
    eligibleSet,
    // Locked holds NOTHING — the plural must not become a back door around the
    // tier floor. Eligibility is the upsell, entitlement is empty.
    unlockedSets: [],
    eligibleSets,
    reason: lapsed ? 'subscription_lapsed' : 'below_tier_floor',
  };
}

/** Look up a set's presentational metadata. */
export function specializationDef(
  id: VendorSpecializationSet,
): VendorSpecializationDef {
  // Non-null by construction: the registry is exhaustive over the union, pinned
  // by the "registry is exhaustive over the union" case in the test suite.
  return VENDOR_SPECIALIZATIONS.find((d) => d.id === id)!;
}

/**
 * Convenience predicate for a call site that only cares about one set, e.g.
 * `holdsSpecialization(access, 'song_desk')`. Reads the entitlement field, never
 * `eligibleSet`.
 */
export function holdsSpecialization(
  access: VendorSpecializationAccess,
  set: VendorSpecializationSet,
): boolean {
  return access.unlockedSet === set;
}

/**
 * Does this vendor hold `set` AT ALL — even when it is not their priority
 * winner? The plural sibling of {@link holdsSpecialization}.
 *
 * ── WHEN TO USE WHICH, AND WHY IT MATTERS ──────────────────────────────────
 *
 * `holdsSpecialization` asks *"is this THE set"* — one answer per vendor, and a
 * band that also emcees can never reach the script desk with it. This asks
 * *"is this AMONG their sets"*, which is the honest question for a supplier who
 * is two trades at one wedding.
 *
 * ⚠ **This is a WIDER gate. Swapping a call site to it lets more people reach a
 * paid desk, so it is a product decision, not a refactor** — flip one call site
 * at a time, deliberately, and say so in the PR. Both predicates still read the
 * ENTITLEMENT (`unlockedSets`), never `eligibleSets`, so neither can be talked
 * past the tier floor.
 */
export function holdsAnySpecialization(
  access: VendorSpecializationAccess,
  set: VendorSpecializationSet,
): boolean {
  return access.unlockedSets.includes(set);
}
