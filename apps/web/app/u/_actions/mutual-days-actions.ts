'use server';

import { createClient } from '@/lib/supabase/server';
import {
  personLifeStoriesEnabled,
  resolveMutualStoryDays,
  type MutualStoryDay,
} from '@/lib/person-life-stories';

// "The days you were both there" — the per-viewer half of a public /u profile.
//
// ⚠ WHY THIS IS AN ACTION AND NOT PART OF THE PAGE. `app/u/[userSlug]/page.tsx`
// sets `export const revalidate = 60`, and its own comments record that the
// signed-in-holder probe is "the ONLY branch that reads auth, so the opted-in
// public render stays cacheable". Rendering a per-VIEWER answer into that body
// would put one visitor's shared days into a cache another visitor is served —
// the worst possible failure for this particular feature. So it resolves out of
// band, after hydration, exactly like the Follow button.
//
// The viewer is taken from the SESSION and never from an argument. The only
// thing a caller may name is whose profile they are looking at, which is
// already in the URL they are on.

export type MutualDaysState = {
  /** Render the section at all? False ⇒ the island renders NOTHING. */
  show: boolean;
  days: MutualStoryDay[];
};

const HIDDEN: MutualDaysState = { show: false, days: [] };

export async function getMutualStoryDays(
  profileUserId: string,
): Promise<MutualDaysState> {
  // Flag-off ⇒ the section does not exist. Checked first and again inside the
  // resolver, because "is it on?" must be answerable without a database.
  if (!personLifeStoriesEnabled()) return HIDDEN;
  if (!profileUserId) return HIDDEN;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // Signed out ⇒ nothing. There is no "you" to intersect with, and a
    // signed-out visitor must never be told who attended what.
    if (!user) return HIDDEN;
    // Your own profile ⇒ nothing. Every day you were at is a day you were at.
    if (user.id === profileUserId) return HIDDEN;

    const days = await resolveMutualStoryDays({
      viewerUserId: user.id,
      profileUserId,
    });
    // `show` is true even at zero days — that state is a written invitation,
    // not a blank. A count of 0 is never printed.
    return { show: true, days };
  } catch {
    // Fail closed: a disclosure surface must never widen on an error.
    return HIDDEN;
  }
}
