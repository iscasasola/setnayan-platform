import { redirect } from 'next/navigation';
import { BackButton } from '@/app/_components/back-button';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { readRoomsSeating } from '@/lib/rooms-seating.server';
import { isSection } from '@/lib/rooms-seating';
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const data = await readRoomsSeating(supabase, profile.vendor_profile_id);
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
      <RoomsSeatingScreen initial={data} hallSize={hallSize} show={isSection(sp.show) ? sp.show : 'rooms'} />
    </div>
  );
}
