'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BASE = '/admin/taxonomy';

/**
 * Defense-in-depth admin gate (the /admin layout already 404s non-admins;
 * server actions re-check). Mirrors /admin/songs + /admin/pricing. Returns the
 * acting user so writes can stamp `admin_audit_log.actor_user_id`.
 */
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

/**
 * Admin: update a `planning_deadlines` row's offset (the recommended lock-by
 * deadline the Home reminders read). RLS (`is_admin()`) gates the write — a
 * non-admin's UPDATE matches zero rows, so this is safe even though the form
 * posts from a page that's already admin-gated by the admin layout.
 */
export async function updatePlanningDeadline(formData: FormData) {
  const deadlineId = formData.get('deadline_id');
  const offsetValue = Number(formData.get('offset_value'));
  const offsetUnit = formData.get('offset_unit');

  if (typeof deadlineId !== 'string' || !deadlineId) {
    throw new Error('Missing deadline_id');
  }
  if (!Number.isInteger(offsetValue) || offsetValue < 0) {
    throw new Error('Offset must be a non-negative whole number');
  }
  if (offsetUnit !== 'day' && offsetUnit !== 'week' && offsetUnit !== 'month') {
    throw new Error('Invalid offset unit');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('planning_deadlines')
    .update({
      offset_value: offsetValue,
      offset_unit: offsetUnit,
      updated_at: new Date().toISOString(),
    })
    .eq('deadline_id', deadlineId);

  if (error) throw new Error(error.message);

  revalidatePath('/admin/taxonomy');
}

/**
 * Admin: rename a taxonomy node (parent or tile) in `service_categories`. The
 * new label is read live by `getTaxonomy()` (no deploy) — the ♾️ "Finalize =
 * permanent live publish" lock. Audit-logged.
 */
export async function renameTaxonomyNode(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const label = String(formData.get('label_en') ?? '').trim();
  if (!id) throw new Error('Missing node id');
  if (label.length < 2 || label.length > 80) {
    redirect(`${BASE}?error=${encodeURIComponent('Label must be 2–80 characters.')}`);
  }
  const admin = createAdminClient();
  const { data: before } = await admin
    .from('service_categories')
    .select('id, label_en')
    .eq('id', id)
    .maybeSingle();
  if (!before) redirect(`${BASE}?error=${encodeURIComponent('Node not found.')}`);
  if (before.label_en === label) redirect(`${BASE}?ok=${encodeURIComponent('No change.')}`);
  const { error } = await admin
    .from('service_categories')
    .update({ label_en: label, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.rename',
    target_table: 'service_categories',
    target_id: id,
    before_json: before,
    after_json: { id, label_en: label },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/vendors');
  redirect(`${BASE}?ok=${encodeURIComponent(`Renamed to "${label}".`)}`);
}

/**
 * Admin: re-map a `canonical_service` to a different tile (+ its parent folder)
 * in `canonical_service_taxonomy`. Read live by `getCanonicalBuckets()` → the
 * /vendors marketplace re-buckets that vendor set with no deploy. Audit-logged.
 */
export async function remapCanonical(formData: FormData) {
  const user = await requireAdmin();
  const canonical = String(formData.get('canonical_service') ?? '').trim();
  const tileId = String(formData.get('tile_id') ?? '').trim();
  if (!canonical || !tileId) throw new Error('Missing canonical_service or tile_id');
  const admin = createAdminClient();
  // The destination must exist + be a tile (tier 2); derive its parent folder.
  const { data: tile } = await admin
    .from('service_categories')
    .select('id, parent_id, tier')
    .eq('id', tileId)
    .maybeSingle();
  if (!tile || tile.tier !== 2 || !tile.parent_id) {
    redirect(`${BASE}?error=${encodeURIComponent('Pick a valid tile.')}`);
  }
  const { data: before } = await admin
    .from('canonical_service_taxonomy')
    .select('canonical_service, folder_id, tile_id')
    .eq('canonical_service', canonical)
    .maybeSingle();
  if (!before) redirect(`${BASE}?error=${encodeURIComponent('Canonical not found.')}`);
  if (before.tile_id === tileId) redirect(`${BASE}?ok=${encodeURIComponent('Already on that tile.')}`);
  const { error } = await admin
    .from('canonical_service_taxonomy')
    .update({
      tile_id: tileId,
      folder_id: tile.parent_id,
      updated_at: new Date().toISOString(),
    })
    .eq('canonical_service', canonical);
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.remap_canonical',
    target_table: 'canonical_service_taxonomy',
    target_id: canonical,
    before_json: before,
    after_json: { canonical_service: canonical, folder_id: tile.parent_id, tile_id: tileId },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/vendors');
  redirect(`${BASE}?ok=${encodeURIComponent('Re-mapped — the marketplace re-buckets live.')}`);
}
