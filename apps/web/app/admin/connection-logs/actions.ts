'use server';

/**
 * Connection Logs · admin mutations (resolve / ignore / bulk archive).
 *
 * Server actions are independent POST endpoints — the /admin layout guard does
 * NOT cover them — so each re-verifies the caller is an admin before touching
 * the table. Mutations run through the service-role client so they're immune to
 * the is_admin() vs layout admin-set nuance (see migration header).
 */

import { revalidatePath } from 'next/cache';

import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type ActionResult = { ok: true; count: number } | { ok: false; error: string };

async function assertAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();
  return Boolean(
    profile?.is_internal || profile?.is_team_member || profile?.account_type === 'admin',
  );
}

/** Flip one log to 'resolved' (or 'ignored') and stamp resolved_at. */
export async function setLogStatus(
  id: string,
  status: 'resolved' | 'ignored',
): Promise<ActionResult> {
  if (!(await assertAdmin())) return { ok: false, error: 'unauthorized' };
  if (!id) return { ok: false, error: 'id_required' };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('app_telemetry_logs')
    .update({ status, resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'active')
    .select('id');

  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/connection-logs');
  return { ok: true, count: data?.length ?? 0 };
}

/**
 * Bulk "Archive All Active" — sweeps every active row to 'resolved'. Optionally
 * scoped to a single event_type (so a filtered view archives only what's shown).
 */
export async function resolveAllActive(eventType?: string): Promise<ActionResult> {
  if (!(await assertAdmin())) return { ok: false, error: 'unauthorized' };

  const admin = createAdminClient();
  let query = admin
    .from('app_telemetry_logs')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('status', 'active');

  if (eventType && eventType !== 'all') {
    query = query.eq('event_type', eventType);
  }

  const { data, error } = await query.select('id');
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/connection-logs');
  return { ok: true, count: data?.length ?? 0 };
}
