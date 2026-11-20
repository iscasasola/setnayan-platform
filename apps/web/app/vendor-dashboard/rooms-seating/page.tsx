import { redirect } from 'next/navigation';
import { SUPPLIER_FLOOR_PLAN_MIN_TIER } from '@/lib/seat-plan-engine';
import { BackButton } from '@/app/_components/back-button';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { readRoomsSeating } from '@/lib/rooms-seating.server';
import { isSection } from '@/lib/rooms-seating';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';
import { vendorPaywallApplies } from '@/lib/vendor-feature-gate';
import { RoomsSeatingScreen } from './_components/rooms-seating-screen';

export const metadata = { title: 'Rooms & seating' };

/**
 * /vendor-dashboard/rooms-seating — 🛏 ROOMS & SEATING (Shop › Makers › Specialized tools; piece A of
 * `prototypes/units_rooms_seating_2026-11-18/MAP.md`, owner 2026-11-18). The shop makes its places ONCE here — hotel
 * floors and rooms · the hall's size and doors · dining areas and their tables — and each service card will later only
 * PICK from them (Availability plan Step 5).
 *
 * Supplier-only: couples never see which room or table. A refused read says so with Retry, never "no rooms yet".
 * The drawn plan (tables on a sized room, Grid, Move, Line up) is the SHARED seat-plan core another session is pulling
 * out of the couple seat plan (owner 18 Nov: "they are already coded … improve and adapt them") — this page feeds it
 * `shopPlanOf(...)` and draws no editor of its own.
 */
export default async function RoomsSeatingPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  // One Auth round trip per render (lib/pages-ask-the-account-once.test.ts).
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const data = await readRoomsSeating(supabase, profile.vendor_profile_id);
  // 🗺 Floor plan on Pro and up (DECISION_LOG 2026-11-18, ruling 35) — the same question every supplier gate asks:
  // the plan has it, or the paywall switch is off. Grid is every shop's either way. A refused tier read reads as Free:
  // the Floor plan is offered greyed with its reason, never a wrong "you have it".
  const { data: tierRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  const tier = (tierRow as { tier_state?: string | null } | null)?.tier_state ?? null;
  const floorPlanOpen = !vendorPaywallApplies(isTierAtLeast(tier, SUPPLIER_FLOOR_PLAN_MIN_TIER));
  const hallSize =
    profile.venue_width_m != null && profile.venue_length_m != null
      ? { widthM: Number(profile.venue_width_m), lengthM: Number(profile.venue_length_m) }
      : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-4 sm:px-6" data-rooms-seating="">
      <div className="mb-2 flex min-h-11 items-center gap-2">
        <BackButton route="/vendor-dashboard/rooms-seating" />
      </div>
      <h1 className="text-[22px] font-semibold text-ink">Rooms &amp; seating</h1>
      <p className="mt-1 text-[14px] text-ink/70">Make your rooms, halls and tables once. Each service card then picks the ones it sells.</p>
      <RoomsSeatingScreen initial={data} hallSize={hallSize} show={isSection(sp.show) ? sp.show : 'rooms'} floorPlanOpen={floorPlanOpen} />
    </div>
  );
}
