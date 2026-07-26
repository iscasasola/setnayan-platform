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
 * ⚠ THE TIER FLOOR — AN OPEN OWNER DECISION, NOT A RULING. ⚠
 *
 * The owner has locked THAT specializations are subscription-gated. The owner
 * has NOT yet decided WHERE the floor sits: any paid tier (Solo and up) or only
 * Pro and up. This constant is that decision, and it is the ONLY place the
 * floor is expressed — moving it is a one-line change, here, and every gate in
 * the app follows.
 *
 * CURRENT VALUE IS A DEFAULT, NOT A RULING: `'solo'` — any paid tier.
 * Reasoning to hand the owner when they settle it:
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
  const eventSet = eventTiles ? new Set(eventTiles) : null;
  const owned = new Set<string>();
  for (const s of services ?? []) {
    if (typeof s !== 'string') continue;
    if (eventSet && !eventSet.has(s)) continue;
    owned.add(s);
  }
  if (owned.size === 0) return null;
  for (const def of VENDOR_SPECIALIZATIONS) {
    for (const tile of owned) {
      if (def.tiles.has(tile)) return def.id;
    }
  }
  return null;
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
  const eligibleSet = specializationSetForServices(services, eventTiles ?? null);

  // Category first: with no set to unlock, subscription state is irrelevant and
  // there is nothing to upsell. Generic kit is the whole kit.
  if (!eligibleSet) {
    return {
      genericKit: true,
      unlockedSet: null,
      eligibleSet: null,
      reason: 'no_specialization_for_category',
    };
  }

  if (subscriptionClearsSpecializationFloor(subscription, now, minTier)) {
    return {
      genericKit: true,
      unlockedSet: eligibleSet,
      eligibleSet,
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
