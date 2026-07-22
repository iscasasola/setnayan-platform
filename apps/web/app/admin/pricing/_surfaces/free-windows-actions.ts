'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminAction } from '@/lib/admin/require-admin';
import { fetchV2CustomerCatalog } from '@/lib/v2-catalog';

/**
 * Server actions for the Catalog Studio "Free windows" tab
 * (/admin/pricing?tab=free-windows). CRUD over public.promo_free_windows —
 * admin-scheduled "these services are free this weekend" announcements.
 *
 * Every write requireAdminAction()-gates + writes an admin_audit_log row (same
 * {action,target_id,actor_user_id,metadata} shape as saveAllPricing). Redirects
 * back to the tab with a flash param the surface renders as a banner.
 */

const TAB = '/admin/pricing?tab=free-windows';

/** Redirect back to the tab with a single flash param. Never returns (redirect throws). */
function backWith(key: string, value = '1'): never {
  redirect(`${TAB}&${new URLSearchParams({ [key]: value }).toString()}`);
}

/**
 * Parse a <input type="datetime-local"> value as PHILIPPINE time. The input
 * carries NO timezone ("2026-07-25T18:00"); a bare new Date() would read it in
 * the server's zone (UTC on Vercel), silently shifting a 6pm promo to 2am. We
 * anchor it to +08:00 so "6pm" means 6pm in Manila regardless of runtime TZ.
 * Returns null for an empty / unparseable value.
 */
function parsePhLocal(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  // Already zoned (Z or ±hh:mm) → trust it; otherwise anchor to Manila.
  const zoned = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}+08:00`;
  const d = new Date(zoned);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createFreeWindow(formData: FormData): Promise<never> {
  const { userId } = await requireAdminAction();

  const title = String(formData.get('title') ?? '').trim();
  const blurb = String(formData.get('blurb') ?? '').trim();
  const skus = formData
    .getAll('service_keys')
    .map((v) => String(v))
    .filter(Boolean);
  const startsAt = parsePhLocal(String(formData.get('starts_at') ?? ''));
  const endsAt = parsePhLocal(String(formData.get('ends_at') ?? ''));

  if (!title) backWith('createError', 'title');
  if (skus.length === 0) backWith('createError', 'skus');
  if (!startsAt) backWith('createError', 'starts');
  if (!endsAt) backWith('createError', 'ends');
  if (endsAt! <= startsAt!) backWith('createError', 'order');

  // Only real, live couple SKUs may be freed (defense-in-depth: the form is
  // POST-able with arbitrary service_keys). Silently drop anything not in the
  // live catalog; if nothing survives, that's a validation failure.
  const catalog = await fetchV2CustomerCatalog();
  const valid = new Set(catalog.map((s) => s.service_code));
  const covered = skus.filter((s) => valid.has(s));
  if (covered.length === 0) backWith('createError', 'skus');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('promo_free_windows')
    .insert({
      title,
      blurb: blurb || null,
      covered_service_keys: covered,
      audience_type: 'all_couples',
      starts_at: startsAt!.toISOString(),
      ends_at: endsAt!.toISOString(),
      is_active: true,
      show_banner: formData.get('show_banner') === 'on',
      created_by: userId,
    })
    .select('promo_window_id')
    .maybeSingle();

  if (error || !data) backWith('createError', 'db');

  await admin.from('admin_audit_log').insert({
    action: 'promo_free_window_create',
    target_id: data!.promo_window_id,
    actor_user_id: userId,
    metadata: {
      title,
      covered_service_keys: covered,
      audience_type: 'all_couples',
      starts_at: startsAt!.toISOString(),
      ends_at: endsAt!.toISOString(),
    },
  });

  revalidatePath('/admin/pricing');
  backWith('created');
}

export async function setFreeWindowActive(formData: FormData): Promise<never> {
  const { userId } = await requireAdminAction();
  const id = String(formData.get('promo_window_id') ?? '').trim();
  const active = formData.get('is_active') === 'true';
  if (!id) backWith('error');

  const admin = createAdminClient();
  const { error } = await admin
    .from('promo_free_windows')
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq('promo_window_id', id);
  if (error) backWith('error');

  await admin.from('admin_audit_log').insert({
    action: active ? 'promo_free_window_activate' : 'promo_free_window_deactivate',
    target_id: id,
    actor_user_id: userId,
    metadata: { is_active: active },
  });

  revalidatePath('/admin/pricing');
  backWith('saved');
}

export async function deleteFreeWindow(formData: FormData): Promise<never> {
  const { userId } = await requireAdminAction();
  const id = String(formData.get('promo_window_id') ?? '').trim();
  if (!id) backWith('error');

  const admin = createAdminClient();
  const { error } = await admin
    .from('promo_free_windows')
    .delete()
    .eq('promo_window_id', id);
  if (error) backWith('error');

  await admin.from('admin_audit_log').insert({
    action: 'promo_free_window_delete',
    target_id: id,
    actor_user_id: userId,
    metadata: {},
  });

  revalidatePath('/admin/pricing');
  backWith('deleted');
}
