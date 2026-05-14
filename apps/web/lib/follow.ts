import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns true when the given user follows the given vendor profile.
 * Safe to call from server components and server actions. RLS already
 * scopes `vendor_follows` reads to the follower or the vendor; for the
 * "do I follow X?" check we pass the explicit user_id so the call works
 * inside privileged contexts too.
 */
export async function isFollowingVendor(
  supabase: SupabaseClient,
  userId: string,
  vendorProfileId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('vendor_follows')
    .select('follower_user_id')
    .eq('follower_user_id', userId)
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (error) throw new Error(`isFollowingVendor failed: ${error.message}`);
  return data !== null;
}

/**
 * Count followers of a vendor profile. Vendors can see this on their own
 * profile via RLS; couples cannot.
 */
export async function countVendorFollowers(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('vendor_follows')
    .select('*', { count: 'exact', head: true })
    .eq('vendor_profile_id', vendorProfileId);
  if (error) throw new Error(`countVendorFollowers failed: ${error.message}`);
  return count ?? 0;
}
