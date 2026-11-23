import 'server-only';
import type { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Is this account THE owner? Asked of the database (`public.is_platform_owner`), never decided from a
 * `public.users` row: that row's email is neither unique nor guarded, and an admin session may set its own
 * `is_internal`, so a profile that "looks like" the owner proves nothing. The function reads the sign-in address
 * from `auth.users` (unique, changed only by a confirmed email change) AND `is_internal`.
 *
 * `null` = the answer could not be read. Callers fail closed: no owner powers, and no owner-only refusal skipped.
 */
export async function readIsPlatformOwner(admin: AdminClient, userId: string): Promise<boolean | null> {
  const { data, error } = await admin.rpc('is_platform_owner', { p_user_id: userId });
  if (error) {
    logQueryError('readIsPlatformOwner', error, {}, 'graceful_degrade');
    return null;
  }
  return data === true;
}
