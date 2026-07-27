/**
 * Vendor day-of console — THE FRAME.
 *
 * The live console (`app/vendor-dashboard/on-the-day/live/[eventId]/page.tsx`)
 * used to be one flat stack of tools that every vendor saw identically. The
 * owner's model is a **generic kit everyone gets**, plus a **per-category
 * specialization** on top — the song desk for a band, the script-and-cues desk
 * for a host/MC, the floor-command kit for a coordinator.
 *
 * This module is the structure that holds those two halves apart. It is the
 * FRAME only: it decides which sections exist, what they are called, and which
 * state the specialization section is in. It does not build the song desk, the
 * MC script tab or the coordinator tools — those are three separate PRs, each
 * owning its own subdirectory, and none of them needs to touch this file or the
 * page (see "HOW THE NEXT AGENT PLUGS IN" below).
 *
 * WHY A PURE MODULE. Same reason as `lib/owner-ribbon.ts` and the gate this
 * consumes: the interesting part is a DECISION — "does a specialization section
 * exist, is it built yet, and does an upsell belong on the page?" — and a
 * decision is only trustworthy if a test can hold it down. The page becomes a
 * thin renderer over {@link buildDayOfFrame}.
 *
 * ── THE ONE INVARIANT THIS MODULE EXISTS TO PROTECT ────────────────────────
 *
 * **The gate governs the NEW specialization section and NOTHING ELSE.**
 *
 * Free-during-launch is active and every production vendor is on a free tier.
 * If wiring the specialization gate into this console removed even one tool a
 * vendor can use today, the frame would be a regression dressed as a feature.
 * So `genericModuleIds` is passed straight through — the caller's resolved
 * module list, in the caller's order, never filtered, never reordered, on every
 * access path including the below-floor one. `lib/vendor-dayof-frame.test.ts`
 * asserts that identity against EVERY `VendorSpecializationReason`, so a future
 * edit that starts gating an existing tool here fails the suite.
 *
 * The specialization gate's own `genericKit: true` literal type says the same
 * thing one level down. This module is the second lock on the same door.
 *
 * ── HOW THE NEXT AGENT PLUGS IN A SPECIALIZATION ───────────────────────────
 *
 * Two steps. Neither touches this file, and neither touches `page.tsx`.
 *
 *   1. Write the surface as a Server Component in your OWN new subdirectory,
 *      e.g. `live/[eventId]/_components/song-desk/song-desk.tsx`, exporting a
 *      component that takes `SpecializationSurfaceProps` (eventId,
 *      vendorProfileId, coupleName). It may be `async` and read the DB.
 *
 *   2. Add ONE line to the registry in
 *      `live/[eventId]/_components/specialization-registry.tsx`:
 *
 *          song_desk: SongDesk,
 *
 * That is the whole integration. The section header, the entitlement check, the
 * placeholder and the upsell are already wired; registering the component is
 * what flips the section from `coming_soon` to `ready`.
 *
 * The registry is the ONLY shared file the three specialization PRs touch, and
 * they touch one line each — so they can land in any order without conflicting
 * with each other or with the frame.
 *
 * ── WHAT THIS MODULE DELIBERATELY DOES NOT DO ──────────────────────────────
 *
 * It does not resolve entitlement. `VendorSpecializationAccess` arrives already
 * resolved on the SERVER via `resolveVendorSpecializationAccessForVendor` — the
 * gate is an entitlement, and hiding a section is not a boundary (the single
 * root cause of the 2026-07-26 security review). This module reads the decision;
 * it never makes it, and there is no input here a client can set.
 */
import type { DayOfModuleId } from '@/lib/vendor-dayof-modules';
import {
  SPECIALIZATION_MIN_TIER,
  specializationDef,
  type VendorSpecializationAccess,
  type VendorSpecializationSet,
} from '@/lib/vendor-specialization-gate';
import { TIER_LABEL } from '@/lib/vendor-tier-caps';

/** Where a vendor starts an upgrade. The one canonical route (the same href the
 *  subscription surfaces and every other vendor upsell already point at). */
export const SPECIALIZATION_UPGRADE_HREF = '/vendor-dashboard/subscription';

/**
 * The state of the specialization section. Three values, and every one of them
 * renders something honest:
 *
 *   ready       — the vendor holds the set AND a surface is registered for it.
 *   coming_soon — the vendor holds the set, but no surface is built yet. The
 *                 section names what is coming. Never a broken section, never
 *                 an error, never a dead link (owner requirement).
 *   locked      — eligible by category but below the tier floor (or lapsed).
 *                 A quiet upsell, and the generic kit completely untouched.
 *
 * There is no fourth "absent" state on this type: a vendor whose category maps
 * to no set gets `specialization: null` on the model instead, which is a
 * correct outcome and not a gap.
 */
export type SpecializationSectionState = 'ready' | 'coming_soon' | 'locked';

/** One jump-nav entry. `href` is always an in-page anchor to a section that is
 *  guaranteed to exist in the same render — see `buildDayOfFrame`. */
export type DayOfFrameNavItem = {
  id: string;
  label: string;
  href: string;
};

/** The specialization half of the frame, or `null` when the vendor's category
 *  maps to no set at all. */
export type DayOfFrameSpecialization = {
  set: VendorSpecializationSet;
  /** Vendor-facing name from the gate's registry — one source of truth for the
   *  wording, so the section, the placeholder and the upsell can never disagree
   *  about what the set is called. */
  label: string;
  blurb: string;
  state: SpecializationSectionState;
  /** DOM id of the section, and the anchor target of its nav item. */
  domId: string;
};

/** The quiet upsell line. Non-null for exactly one situation: the vendor's
 *  category HAS a set and they are not holding it. Carries no entitlement. */
export type DayOfFrameUpsell = {
  set: VendorSpecializationSet;
  label: string;
  blurb: string;
  /** Distinguishes "renew" from "subscribe" — a lapsed subscriber and a
   *  never-subscribed vendor deserve different sentences. */
  lapsed: boolean;
  /** The minimum tier that unlocks it, already humanised ("Solo"). Read from
   *  SPECIALIZATION_MIN_TIER so moving the floor moves this copy for free. */
  minTierLabel: string;
  href: string;
};

export type DayOfFrameModel = {
  /**
   * The generic kit, VERBATIM. Same ids, same order, on every path. This is the
   * invariant described in the module doc; see the identity test.
   */
  genericModuleIds: readonly DayOfModuleId[];
  /** DOM id of the generic section. */
  genericDomId: string;
  specialization: DayOfFrameSpecialization | null;
  upsell: DayOfFrameUpsell | null;
  /**
   * Jump-nav items, in render order. EMPTY when there is only one section —
   * a one-item nav is chrome with no job. Every `href` points at a section this
   * same model renders, so the nav can never produce a dead link.
   */
  nav: DayOfFrameNavItem[];
};

const GENERIC_DOM_ID = 'day-of-generic';
const SPECIALIZATION_DOM_ID = 'day-of-specialization';

/**
 * Build the frame.
 *
 * `registeredSets` is what the component registry currently has surfaces for —
 * passed IN rather than imported so this module stays free of JSX and remains
 * unit-testable under `tsx --test`. It is a presentation input only: it can
 * move a section between `ready` and `coming_soon`, and can never grant or deny
 * the entitlement itself.
 */
export function buildDayOfFrame(input: {
  /** Already resolved on the server. */
  access: VendorSpecializationAccess;
  /** The enabled day-of modules the console resolved, in its own order. */
  genericModuleIds: readonly DayOfModuleId[];
  /** Sets the registry has a component for. Defaults to none. */
  registeredSets?: ReadonlySet<VendorSpecializationSet> | null;
}): DayOfFrameModel {
  const { access, genericModuleIds, registeredSets } = input;

  const base = {
    // Pass-through, not a copy of a filtered list: the gate governs the
    // specialization section only.
    genericModuleIds,
    genericDomId: GENERIC_DOM_ID,
  };

  // No set for this category → generic kit is the whole kit, and there is
  // nothing to upsell. One section, so no nav.
  if (!access.eligibleSet) {
    return { ...base, specialization: null, upsell: null, nav: [] };
  }

  const def = specializationDef(access.eligibleSet);
  const held = access.unlockedSet === access.eligibleSet;

  const specialization: DayOfFrameSpecialization = {
    set: access.eligibleSet,
    label: def.label,
    blurb: def.blurb,
    state: held
      ? registeredSets?.has(access.eligibleSet)
        ? 'ready'
        : 'coming_soon'
      : 'locked',
    domId: SPECIALIZATION_DOM_ID,
  };

  const upsell: DayOfFrameUpsell | null = held
    ? null
    : {
        set: access.eligibleSet,
        label: def.label,
        blurb: def.blurb,
        lapsed: access.reason === 'subscription_lapsed',
        minTierLabel: TIER_LABEL[SPECIALIZATION_MIN_TIER],
        href: SPECIALIZATION_UPGRADE_HREF,
      };

  return {
    ...base,
    specialization,
    upsell,
    nav: [
      { id: GENERIC_DOM_ID, label: 'Your tools', href: `#${GENERIC_DOM_ID}` },
      { id: SPECIALIZATION_DOM_ID, label: def.label, href: `#${SPECIALIZATION_DOM_ID}` },
    ],
  };
}
