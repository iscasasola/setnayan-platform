import { redirect } from 'next/navigation';
import { SUPPLIER_FLOOR_PLAN_MIN_TIER } from '@/lib/seat-plan-engine';
import { BackButton } from '@/app/_components/back-button';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { readSpaces } from '@/lib/spaces.server';
import { kindForShop } from '@/lib/spaces';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';
import { vendorPaywallApplies } from '@/lib/vendor-feature-gate';
import { getVendorPrices, monthlyPlanPrice } from '@/lib/v2-catalog';
import { PLAN_PERIOD } from '@/lib/vendor-plan-change-words';
import { SpacesScreen } from './_components/spaces-screen';

export const metadata = { title: 'Spaces' };

/**
 * /vendor-dashboard/spaces — 🏛 SHOP › SPACES (owner 19 Nov 2026; build drawing specs
 * `prototypes/spaces_final_screens_2026-11-19.html`; DECISION_LOG "SHOP PAGE FINAL + SPACES COMBINED WITH ROOMS &
 * SEATING"). The shop's halls, rooms and the things it rents out, set once; its cards pick from here. The door is the
 * Spaces tile in Shop › Specialized tools (right after Scanner). It replaces 18 Nov's `/vendor-dashboard/rooms-seating`.
 *
 * ONE read (`readSpaces`) for the shop's spaces, the tables and doors in its halls, and today's holders. A refused read
 * says so with Try again — never "no spaces yet".
 */
export default async function SpacesPage() {
  const supabase = await createClient();
  // One Auth round trip per render (lib/pages-ask-the-account-once.test.ts).
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // The shop's calendar day: a supplier in Manila looks at Manila's today.
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const [read, tierRow, prices] = await Promise.all([
    readSpaces(supabase, profile.vendor_profile_id, today),
    supabase.from('vendor_profiles').select('tier_state').eq('vendor_profile_id', profile.vendor_profile_id).maybeSingle(),
    getVendorPrices(),
  ]);
  // A7-14: the locks name the Plus price from the catalogue (the same reader as /for-suppliers); unread → no figure.
  const soloPrice = monthlyPlanPrice(prices, 'solo');
  const planPrice = soloPrice ? `${soloPrice} ${PLAN_PERIOD.slash}` : null;
  // 🔒 Every paid plan, from Plus (or the paywall switch off): own names, renaming, numbering by floor, the drawn floor plan. A refused
  // tier read reads as below Pro — the lock holds, never a wrong "you have it". The server refuses the same.
  const tier = (tierRow.data as { tier_state?: string | null } | null)?.tier_state ?? null;
  const proOpen = !vendorPaywallApplies(isTierAtLeast(tier, SUPPLIER_FLOOR_PLAN_MIN_TIER));
  // The shop's service keys ("venue", "gowns_barong" …) in words — they only decide which kind is offered FIRST.
  const categories = ((profile.services ?? []) as string[]).map((k) => k.replace(/_/g, ' '));
  // "The first hall opens filled from your shipped Room size & capacity" (drawing screen 4).
  const firstHall =
    profile.venue_width_m != null || profile.capacity_max != null
      ? {
          widthM: profile.venue_width_m != null ? Number(profile.venue_width_m) : null,
          lengthM: profile.venue_length_m != null ? Number(profile.venue_length_m) : null,
          seated: profile.capacity_max ?? null,
        }
      : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-4 sm:px-6 lg:max-w-4xl" data-spaces="">
      <div className="mb-2 flex min-h-11 items-center gap-2">
        <BackButton route="/vendor-dashboard/spaces" />
      </div>
      <h1 className="text-[22px] font-semibold text-ink">Spaces</h1>
      <p className="mt-1 text-[14px] text-ink/70">Set once for the shop. Your cards pick from here.</p>
      <SpacesScreen initial={read} today={today} proOpen={proOpen} shopKind={kindForShop(categories)} firstHall={firstHall} planPrice={planPrice} />
    </div>
  );
}
