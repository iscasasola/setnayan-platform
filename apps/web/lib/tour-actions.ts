'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TOUR_KEYS, type TourKey } from '@/lib/tours';

function isTourKey(value: unknown): value is TourKey {
  return typeof value === 'string' && (TOUR_KEYS as ReadonlyArray<string>).includes(value);
}

const LEGACY_WELCOME_KEYS: ReadonlyArray<TourKey> = [
  'couple_welcome_v1',
];

// Append `tourKey` to `users.tour_seen_keys` if it's not already present.
// Called when a user finishes or explicitly skips a tour.
//
// The legacy `tour_completed_at` flag is also set when the dismissed tour
// is one of the role welcomes (couple/vendor), so old code paths that
// still check the timestamp keep working until we remove them.
export async function completeTour(tourKey: TourKey) {
  if (!isTourKey(tourKey)) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: row } = await supabase
    .from('users')
    .select('tour_seen_keys, tour_completed_at')
    .eq('user_id', user.id)
    .maybeSingle();

  const seen = (row?.tour_seen_keys ?? []) as string[];
  if (seen.includes(tourKey)) return;

  const update: Record<string, unknown> = {
    tour_seen_keys: [...seen, tourKey],
    updated_at: new Date().toISOString(),
  };
  // Keep the legacy welcome flag in sync so old code that reads
  // `tour_completed_at` keeps suppressing the welcome.
  if (LEGACY_WELCOME_KEYS.includes(tourKey) && !row?.tour_completed_at) {
    update.tour_completed_at = new Date().toISOString();
  }

  await supabase.from('users').update(update).eq('user_id', user.id);

  revalidatePath('/dashboard', 'layout');
  revalidatePath('/vendor-dashboard', 'layout');
  revalidatePath('/admin', 'layout');
}

// Reset one or all tours so they fire again on the next surface visit.
// Accepts either a specific `TourKey` (programmatic call) or `FormData`
// (when wired directly to a server-action <form action> — in that case
// we ignore the body and reset everything). Used by the "Replay
// onboarding tour" Settings affordance.
export async function restartTour(input?: TourKey | FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const tourKey = typeof input === 'string' ? input : undefined;
  if (tourKey && isTourKey(tourKey)) {
    const { data: row } = await supabase
      .from('users')
      .select('tour_seen_keys')
      .eq('user_id', user.id)
      .maybeSingle();
    const seen = (row?.tour_seen_keys ?? []) as string[];
    const next = seen.filter((k) => k !== tourKey);

    const update: Record<string, unknown> = {
      tour_seen_keys: next,
      updated_at: new Date().toISOString(),
    };
    // Clear the legacy flag too if we're un-completing a legacy welcome,
    // otherwise the welcome stays suppressed by the old flag.
    if (LEGACY_WELCOME_KEYS.includes(tourKey)) {
      update.tour_completed_at = null;
    }
    await supabase.from('users').update(update).eq('user_id', user.id);
  } else {
    // No key provided — clear every tour the user has ever dismissed.
    await supabase
      .from('users')
      .update({
        tour_seen_keys: [],
        tour_completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);
  }

  revalidatePath('/dashboard', 'layout');
  revalidatePath('/vendor-dashboard', 'layout');
  revalidatePath('/admin', 'layout');
  redirect('/dashboard/profile?tour_restarted=1');
}
