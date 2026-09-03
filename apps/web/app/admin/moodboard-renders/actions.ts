'use server';

/**
 * ADMIN · the featured toggle for Mood Board creations (MB8).
 *
 * The gate is in SQL, not here. `moodboard_set_render_featured` checks
 * `is_admin()` and refuses to feature a render whose event has not given
 * share consent — so this action cannot be the place the rule is enforced,
 * and therefore cannot be the place it is forgotten. What it does is call the
 * function and report honestly whether the answer was yes.
 *
 * 🔑 A REFUSAL IS REPORTED, NOT SWALLOWED. `false` from the RPC means the
 * toggle did NOT happen — most often because the couple has not consented.
 * Silently revalidating and re-rendering an unchanged star would tell an admin
 * they had featured something they had not, and the featured set is what a
 * future public gallery draws from.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type FeatureToggleResult = { ok: boolean; reason: 'refused' | 'error' | null };

export async function setRenderFeatured(args: {
  renderId: string;
  featured: boolean;
}): Promise<FeatureToggleResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('moodboard_set_render_featured', {
    p_render_id: args.renderId,
    p_featured: args.featured,
  });

  if (error) return { ok: false, reason: 'error' };
  if (data !== true) {
    // The function said no. Almost always: the event has not consented, so
    // this creation may not be published. Named so the surface can say it.
    return { ok: false, reason: 'refused' };
  }
  revalidatePath('/admin/moodboard-renders');
  return { ok: true, reason: null };
}
