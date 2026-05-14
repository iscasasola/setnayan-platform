import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

// Cheap server-side check used by the signup action to reject blacklisted
// emails before creating an auth.users row. Service-role client bypasses RLS;
// the matching admin UI (apps/web/app/admin/users/page.tsx) reads through
// the same path via the same createAdminClient().
export async function isEmailBlacklisted(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0) return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from('blacklisted_emails')
    .select('id')
    .eq('email', normalized)
    .maybeSingle();
  return Boolean(data);
}
