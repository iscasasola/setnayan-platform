import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { claimAccountVerdict, type ClaimAccountVerdict } from './claim-account-gate';

/**
 * The three reads `claimAccountVerdict` judges, made ONE way for both callers: the shipped finalize
 * (`app/vendor/claim/[token]/finalize/page.tsx`) and the claim door's finish (`app/open-shop/claim-actions.ts`), which
 * must refuse a couple's own account BEFORE it writes anything, exactly as finalize does. A refused read is `null`
 * and is judged "unmeasured" — never a guess.
 */
export async function readClaimAccountVerdict(admin: SupabaseClient, userId: string, where: string): Promise<ClaimAccountVerdict> {
  const [typeRes, ownedRes, seatRes] = await Promise.all([
    admin.from('users').select('account_type').eq('user_id', userId).maybeSingle(),
    admin.from('vendor_profiles').select('vendor_profile_id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('vendor_team_members').select('vendor_profile_id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  if (typeRes.error) console.error(`[supabase-error] ${where} · from:users.select (account_type)`, typeRes.error);
  if (ownedRes.error) console.error(`[supabase-error] ${where} · from:vendor_profiles.count`, ownedRes.error);
  if (seatRes.error) console.error(`[supabase-error] ${where} · from:vendor_team_members.count`, seatRes.error);
  return claimAccountVerdict({
    accountType: typeRes.error ? null : ((typeRes.data as { account_type?: string | null } | null)?.account_type ?? null),
    hasVendorAccess: ownedRes.error || seatRes.error ? null : (ownedRes.count ?? 0) + (seatRes.count ?? 0) > 0,
  });
}
