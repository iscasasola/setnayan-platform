import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import {
  fetchVendorCountsByService,
  canonicalServicesForTile,
  canonicalServicesForFolder,
} from '@/lib/vendor-counts';

/**
 * Onboarding picker category → plan-group id (lib/wedding-plan-groups PLAN_GROUPS).
 *
 * The single source for the onboarding cat→group bridge: the commit-time
 * auto-inquiry fan-out in onboarding/wedding/actions.ts imports this, and
 * `hiddenOnboardingExtraCats()` below uses it to resolve each pickable cat to its
 * live marketplace supply. (Some picker cats — the Booths sub-types coffee /
 * food_cart / henna / … — intentionally have NO plan group: the Booths folder
 * only exposes cocktail_booths[=mobile_bar] + photobooth as planning groups, so
 * those are added from the dashboard Unlock-categories page instead, by design.)
 */
export const PICK_TO_GROUP: Record<string, string> = {
  reception: 'reception_venue',
  ceremony: 'ceremony_venue',
  coordinator: 'coordinator',
  catering: 'catering',
  stations: 'catering',
  cake: 'cake',
  stylist: 'stylist',
  lights_sound: 'lights_sound',
  florist: 'florals_decor',
  dance_floor: 'florals_decor',
  led_wall: 'led_background',
  host_mc: 'host_mc',
  live_band: 'live_band',
  orchestra: 'live_band',
  choir: 'music_entertainment',
  wedding_singer: 'music_entertainment',
  dj: 'music_entertainment',
  performers: 'music_entertainment',
  choreographer: 'dance_instructor',
  photo_video: 'photography',
  bride_attire: 'attire',
  groom_attire: 'attire',
  women_attire: 'attire',
  men_attire: 'attire',
  filipiniana: 'attire',
  grooming: 'hair_makeup',
  hmua: 'hair_makeup',
  jewelry: 'rings',
  photo_booth: 'photobooth',
  mobile_bar: 'cocktail_booths',
  printing: 'invitations_stationery',
  souvenirs: 'invitations_stationery',
  bridal_car: 'bridal_car',
  guest_shuttle: 'guest_shuttle',
};

/** A mapped cat "has supply" when any canonical in its plan group is offered by ≥1 listed vendor. */
function groupHasSupply(
  groupId: string,
  counts: Map<string, { total: number }>,
): boolean {
  const g = PLAN_GROUPS.find((x) => x.id === groupId);
  if (!g) return false;
  const canonicals = g.subcategoryHint
    ? [g.subcategoryHint]
    : g.catalogTile
      ? canonicalServicesForTile(g.catalogTile)
      : canonicalServicesForFolder(g.catalogFolder);
  return canonicals.some((c) => (counts.get(c)?.total ?? 0) > 0);
}

/**
 * The onboarding picker EXTRAS cats to HIDE because their plan group has no live
 * marketplace supply — spec Onboarding_Taxonomy_Driven_Spec_2026-06-04 §0: the
 * acquisition picker shows available categories only ("don't advertise empty
 * inventory"). "Available" = ≥1 vendor (verified or coming_soon, which includes
 * Setnayan first-party listings) offering a canonical service in the group.
 *
 * NEVER-GUT (spec §6 graceful-degrade): returns `[]` — hide nothing — until at
 * least HALF the mapped cats have supply. A thin / founder-only marketplace would
 * otherwise hide the empty majority and gut the picker, so below that threshold
 * the full picker shows; it self-heals to available-only as vendors join, with no
 * deploy. Soft-fails to `[]` on any error so it can never block onboarding.
 *
 * Returned keys are the picker's own cat vocabulary (PICK_TO_GROUP keys); the
 * shell narrows ONLY the extras browser by them (the 4 basics + unmapped cats are
 * never touched — unknown availability is admitted, not hidden).
 */
export async function hiddenOnboardingExtraCats(): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const counts = await fetchVendorCountsByService(admin);
    const mapped = Object.entries(PICK_TO_GROUP);

    const available: string[] = [];
    const unavailable: string[] = [];
    for (const [cat, groupId] of mapped) {
      (groupHasSupply(groupId, counts) ? available : unavailable).push(cat);
    }

    // Never-gut: only narrow once the marketplace covers at least half the mapped
    // categories. Below that the empty majority stays visible (founder-only state).
    if (available.length < Math.ceil(mapped.length / 2)) return [];
    return unavailable;
  } catch {
    return [];
  }
}
