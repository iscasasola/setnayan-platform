'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { refreshDemandRadar } from '@/lib/demand-radar';

/**
 * Setnayan HQ · Demand Radar server action — the cron-free "Run now" rebuild.
 *
 * refreshDemandRadar() runs through the service-role admin client; the SQL fn
 * re-gates to admin/service_role, and requireAdmin() below re-asserts admin
 * context (defense in depth — the /admin layout already 404s non-admins). No
 * poller: the rollup rebuilds on this button + opportunistically via after().
 */

const BASE = '/admin/demand';

function back(kind: 'ok' | 'error', msg: string): never {
  const p = new URLSearchParams();
  p.set(kind, msg);
  redirect(`${BASE}?${p.toString()}`);
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
}

export async function runDemandRadarRefresh(): Promise<never> {
  await requireAdmin();
  const rows = await refreshDemandRadar();
  revalidatePath(BASE);
  if (rows === null) {
    back('error', 'Refresh failed — please try again.');
  }
  back('ok', `Demand Radar rebuilt — ${rows} rollup ${rows === 1 ? 'cell' : 'cells'}.`);
}
