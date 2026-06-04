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

/** Slugify a label into a stable key (sep '_' for the id, '-' for the slug). */
function slugify(label: string, sep: '_' | '-'): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, sep)
    .replace(new RegExp(`^\\${sep}+|\\${sep}+$`, 'g'), '');
}

/**
 * Admin: add a new tile under a parent — the expandable-taxonomy core. The
 * tile goes live on `/vendors` with no deploy (the catalog reads the snapshot),
 * ready to receive re-mapped canonicals. Audit-logged.
 */
export async function createTaxonomyNode(formData: FormData) {
  const user = await requireAdmin();
  const parentId = String(formData.get('parent_id') ?? '').trim();
  const label = String(formData.get('label_en') ?? '').trim();
  if (!parentId) throw new Error('Missing parent_id');
  if (label.length < 2 || label.length > 80) {
    redirect(`${BASE}?error=${encodeURIComponent('Label must be 2–80 characters.')}`);
  }
  const id = slugify(label, '_');
  const slug = slugify(label, '-');
  if (!id || !slug) {
    redirect(`${BASE}?error=${encodeURIComponent('Label needs letters or numbers.')}`);
  }
  const admin = createAdminClient();
  const { data: parent } = await admin
    .from('service_categories')
    .select('id, tier')
    .eq('id', parentId)
    .maybeSingle();
  if (!parent || parent.tier !== 1) {
    redirect(`${BASE}?error=${encodeURIComponent('Pick a valid parent.')}`);
  }
  const { data: existing } = await admin
    .from('service_categories')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (existing) {
    redirect(`${BASE}?error=${encodeURIComponent(`A node "${id}" already exists — pick a different label.`)}`);
  }
  const { data: lastSibling } = await admin
    .from('service_categories')
    .select('sort_order')
    .eq('parent_id', parentId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = ((lastSibling?.sort_order as number | undefined) ?? -1) + 1;
  const row = {
    id,
    parent_id: parentId,
    tier: 2,
    kind: 'leaf',
    label_en: label,
    slug,
    sort_order: nextSort,
    scope: 'global',
    marketplace_hidden: false,
    status: 'active',
  };
  const { error } = await admin.from('service_categories').insert(row);
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.create',
    target_table: 'service_categories',
    target_id: id,
    after_json: row,
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/vendors');
  redirect(`${BASE}?ok=${encodeURIComponent(`Added tile "${label}" under ${parentId}.`)}`);
}

/**
 * Admin: delete a tile. Guarded against orphans — refuses if it has child nodes
 * or any canonical_service still mapped to it (re-map those first). Parents are
 * owner-managed and not deletable here. Audit-logged.
 */
export async function deleteTaxonomyNode(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) throw new Error('Missing node id');
  const admin = createAdminClient();
  const { data: before } = await admin
    .from('service_categories')
    .select('id, tier, label_en, parent_id')
    .eq('id', id)
    .maybeSingle();
  if (!before) redirect(`${BASE}?error=${encodeURIComponent('Node not found.')}`);
  if (before.tier === 1) {
    redirect(`${BASE}?error=${encodeURIComponent('Parents are owner-managed — can’t delete here.')}`);
  }
  const { count: childCount } = await admin
    .from('service_categories')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', id);
  if ((childCount ?? 0) > 0) {
    redirect(`${BASE}?error=${encodeURIComponent('Has sub-categories — remove them first.')}`);
  }
  const { count: mappedCount } = await admin
    .from('canonical_service_taxonomy')
    .select('canonical_service', { count: 'exact', head: true })
    .eq('tile_id', id);
  if ((mappedCount ?? 0) > 0) {
    redirect(`${BASE}?error=${encodeURIComponent(`${mappedCount} service(s) still mapped here — re-map them first.`)}`);
  }
  const { error } = await admin.from('service_categories').delete().eq('id', id);
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.delete',
    target_table: 'service_categories',
    target_id: id,
    before_json: before,
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/vendors');
  redirect(`${BASE}?ok=${encodeURIComponent(`Deleted "${before.label_en}".`)}`);
}
