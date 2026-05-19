import { createClient } from '@/lib/supabase/server';
import { GuidedTour } from '@/app/_components/guided-tour';
import { completeTour } from '@/lib/tour-actions';
import { TOURS, type TourKey } from '@/lib/tours';

// Drop-in server component that mounts a per-surface mini-tour for a
// signed-in user the first time they land on this surface. Reads
// `users.tour_seen_keys` once and renders the centered-modal carousel
// only when the key is missing.
//
// Use from any signed-in page:
//   <MiniTour tourKey="customer_vendors_v1" />
//
// Returns null when:
//   - The user is not signed in
//   - The user has already dismissed (or completed) this tour
//   - We can't read the profile row (defensive — never blocks the page)
export async function MiniTour({ tourKey }: { tourKey: TourKey }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: row } = await supabase
    .from('users')
    .select('tour_seen_keys')
    .eq('user_id', user.id)
    .maybeSingle();

  const seen = (row?.tour_seen_keys ?? []) as string[];
  if (seen.includes(tourKey)) return null;

  const def = TOURS[tourKey];
  if (!def) return null;

  return <GuidedTour tourKey={tourKey} slides={def.slides} completeAction={completeTour} />;
}
