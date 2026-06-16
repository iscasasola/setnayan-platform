'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Setnayan HQ · Auto-Recap oversight actions.
 *
 * A published recap is a PUBLIC surface carrying guest photos + words, so HQ
 * keeps an RA 10173 recourse lever: take a recap DOWN (status='unpublished',
 * unpublished_by='admin'). It does NOT delete the row — the couple can
 * re-publish, and the takedown stays legible in the history. Patterns mirror
 * /admin/real-stories/actions.ts (requireAdmin defense-in-depth, admin-client
 * write, admin_audit_log row, redirectBack, revalidatePath).
 */

const BASE = '/admin/recaps';
const SAFE_ANCHOR = /[^a-z0-9-]/g;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function redirectBack(kind: 'ok' | 'error', msg: string, anchor?: string): never {
  const p = new URLSearchParams();
  p.set(kind, msg);
  const a = (anchor ?? '').toLowerCase().replace(SAFE_ANCHOR, '').slice(0, 80);
  redirect(`${BASE}?${p.toString()}${a ? `#rc-${a}` : ''}`);
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
  return user;
}

/** Force a published recap offline (RA 10173 recourse). */
export async function adminTakedownRecap(formData: FormData) {
  const user = await requireAdmin();
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!UUID_RE.test(eventId)) redirectBack('error', 'Unknown event.');

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { error } = await admin
    .from('event_recaps')
    .update({ status: 'unpublished', unpublished_by: 'admin', updated_at: nowIso })
    .eq('event_id', eventId);
  if (error) redirectBack('error', error.message, eventId);

  await admin.from('admin_audit_log').insert({
    action: 'recap.takedown',
    target_table: 'event_recaps',
    target_id: eventId,
    after_json: { status: 'unpublished', unpublished_by: 'admin' },
    actor_user_id: user.id,
  });

  const { data: ev } = await admin
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();
  if (ev?.slug) {
    revalidatePath(`/${ev.slug}/recap`);
    revalidatePath(`/api/og/recap/${ev.slug}`);
  }
  revalidatePath(BASE);
  redirectBack('ok', 'Recap taken down. The couple can re-publish from their dashboard.', eventId);
}
