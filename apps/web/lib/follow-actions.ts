'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type FollowActionResult =
  | { ok: true; following: boolean }
  | { ok: false; code: 'NOT_AUTHENTICATED' | 'INSERT_FAILED' | 'DELETE_FAILED'; message: string };

/**
 * Insert a follow row for the current user against the given vendor profile.
 * Idempotent — if the row already exists we still return ok with following=true.
 * Caller passes `revalidate` to refresh the page after the toggle (the gated
 * Message button needs to flip without a full reload).
 */
export async function followVendor(
  vendorProfileId: string,
  revalidate?: string,
): Promise<FollowActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: 'NOT_AUTHENTICATED', message: 'Sign in to follow vendors.' };
  }

  const { error } = await supabase.from('vendor_follows').upsert(
    {
      follower_user_id: user.id,
      vendor_profile_id: vendorProfileId,
    },
    { onConflict: 'follower_user_id,vendor_profile_id', ignoreDuplicates: true },
  );
  if (error) {
    return { ok: false, code: 'INSERT_FAILED', message: error.message };
  }

  if (revalidate && revalidate.startsWith('/')) revalidatePath(revalidate);
  return { ok: true, following: true };
}

/**
 * Remove the follow row. Idempotent — deleting a non-existent row still
 * returns ok with following=false. Does NOT cascade to existing chat
 * threads (those survive an un-follow per spec § Gate; only NEW thread
 * creation is gated).
 */
export async function unfollowVendor(
  vendorProfileId: string,
  revalidate?: string,
): Promise<FollowActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: 'NOT_AUTHENTICATED', message: 'Sign in to unfollow vendors.' };
  }

  const { error } = await supabase
    .from('vendor_follows')
    .delete()
    .eq('follower_user_id', user.id)
    .eq('vendor_profile_id', vendorProfileId);
  if (error) {
    return { ok: false, code: 'DELETE_FAILED', message: error.message };
  }

  if (revalidate && revalidate.startsWith('/')) revalidatePath(revalidate);
  return { ok: true, following: false };
}
